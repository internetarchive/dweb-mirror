//process.env.NODE_DEBUG="fs";    // Uncomment to test fs
// Node packages
const crypto = require('crypto');
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
// noinspection JSUnresolvedVariable
const Transform = require('stream').Transform || require('readable-stream').Transform;
const debug = require('debug')('dweb-mirror:MirrorFS');
const multihashes = require('multihashes');
const detect = require('async/detect');
const each = require('async/each');

// other packages of ours
const ParallelStream = require('parallel-streams');

// other packages in this repo
const config = require('./config');
const HashStore = require('./HashStore');

function multihash58sha1(buf) { return multihashes.toB58String(multihashes.encode(buf, 'sha1')); }


class MirrorFS {
    /*
    Utility subclass that knows about the file system.

    properties:
      copyDirectory:  place to put a copy TODO-MULTI handle case of is cached but in wrong place
      hashstore:      mappings esp sha1.filestore

     */

    static _copyDirectory() {
        return this.copyDirectory || config.directories[0];
    }

    static _mkdir(dirname, cb) {
        /* Recursively make a directory
        dirname: String representing file path
        cb(err):     Call back, with error if unable to complete
        */
        fs.mkdir(dirname, err => {
            if (err && !(err.code === "EEXIST")) {
                if (err.code === "ENOENT") { // missing parent dir
                    const parentdir = path.dirname(dirname);
                    MirrorFS._mkdir(parentdir, err => {
                        if (err) cb(err); // Dont know how to tackle error from _mkdir, note that EEXIST would be odd since ENOENT implies it doesnt exist
                        fs.mkdir(dirname, cb);
                    })
                } else {
                    cb(err); // Throw any other error
                }
            }
            cb();
        })
    }

    static quickhash(str, options={}) {
        const hash = crypto.createHash(options.algorithm || 'sha1').update(str);
        return  options.format === "multihash58" ? multihash58sha1(hash.digest()) : hash.digest('hex');
    }

    static _streamhash(s, options={}, cb) {
        /*  Calculate hash on a stream, which it consumes
            algorithm: Hash algorithm to be used, (only tested with sha1)
            cb will be called once, when stream is done
        */
        if (typeof options === "function") { cb = options; options = {}; }
        const algorithm=options.algorithm || 'sha1';
        console.assert(options.format, 'Format of digest - should be defined as multihash58|hex');
        const hash = crypto.createHash(algorithm);
        let errState = null;
        return s
        .on('error', err =>   { if (!errState) cb(errState = err) }) // Just send errs once
        .on('data',  chunk => { if (!errState) hash.update(chunk)  })
        .on('end', () => { if (!errState) cb(null, options.format === "multihash58" ? multihash58sha1(hash.digest()) : hash.digest('hex'))});
    }

    static _hashstream({algorithm='sha1'}={}) {
        /*
        Return a hashstream which can be piped through, it stores the digest of the stream in ".actual" after its ._flush is called
         */
        const hash = crypto.createHash(algorithm);
        const stream = new Transform();
        stream._transform = function (chunk, encoding, cb) {
            hash.update(chunk);
            stream.push(chunk);
            cb()
        };
        stream._flush = function (cb) {
            stream.actual = hash.digest(); // digest('hex').toLowerCase().trim() is what can compare with with sha1 in metadata
            cb(null);
        };
        return stream
    }

    static readFile(relFilePath, cb) {
        // like fs.readFile, but checks relevant places first
        checkWhereValidFile(relFilePath, {}, (err, existingFilePath) => {
            fs.readFile(existingFilePath, cb);
        });
    }
    static writeFile(relFilePath, data, cb) { //TODO-MULTI TODO-API
        // Like fs.writeFile but will mkdir the directory before writing the file
        const filepath = path.join(this._copyDirectory(), relFilePath);
        const dirpath = path.dirname(filepath);
        MirrorFS._mkdir(dirpath, (err) => {
            if (err) {
                debug("MirrorFS.writeFile: Cannot mkdir %s", dirpath, err.message);
                cb(err);
            } else {
                fs.writeFile(filepath, data, (err) => {
                    if (err) {
                        debug("MirrorFS.writeFile: Unable to write to %s: %s", filepath, err.message);
                        cb(err);
                    } else {
                        cb(null);
                    }});
            }});
    }

    static _fileopenwrite(directory, filepath, cb) {  // cb(err, fd)
        /*
        directory top level directory of cache - must exist
        filepath path to file (rooted preferably)
        If fails to open for writing then will check for presence of a root directory, and recursively mkdir before trying again.
        cb(err, fd)     Open file descriptor
         */
        try {
            fs.open(filepath, 'w', (err, fd) => {
                if (err) {
                    if (err.code === "ENOENT") {    // Doesnt exist, which means the directory or subdir -
                        // noinspection JSUnusedLocalSymbols
                        fs.stat(directory, (err, stats) => {
                            if (err) throw new Error(`The root directory for mirroring: ${directory} is missing - please create by hand`);
                            debug("MirrorFS creating directory: %s", path.dirname(filepath));
                            MirrorFS._mkdir(path.dirname(filepath), err => {
                                if (err) {
                                    console.error("Failed to mkdir for", filepath, err.message);
                                    cb(err);
                                }
                                fs.open(filepath, 'w', (err, fd) => {
                                    if (err) { // This shouldnt happen, we just checked the directory.
                                        console.error("Failed to open", filepath, "after mkdir");
                                        throw err;
                                    }
                                    cb(null, fd)
                                });
                            });
                        });
                    } else {
                        debug("Failed to open %s for writing:", filepath, err.message);
                        cb(err); // Not specifically handling it - so throw it up
                    }
                } else {
                    cb(null, fd);
                }
            });
        } catch (err) {
            cb(err);
        }
    }

    /* Not currently used
    // noinspection JSUnusedGlobalSymbols
    static writableStreamTo(directory, filepath, cb) {
        this._fileopenwrite(directory, filepath, (err, fd) => {
            if (err) {
                debug("Unable to write to %s: %s", filepath, err.message);
                cb(err);
            } else {
                // fd is the file descriptor of the newly opened file;
                const writable = fs.createWriteStream(null, {fd: fd});
                cb(null, writable);
                // Note at this point file is neither finished, nor closed, its a stream open for writing.
                //fs.close(fd); Should be auto closed when stream to it finishes
            }
        });
    }
    */

    static maybeCheckSha(filepath, {digest=undefined, format=undefined, algorithm=undefined}, cb) { //TODO-API add this
        /*
        Check file is readable, or if digest offered check matches that of file
        cb(err) If doesn't match
         */
        if (digest) {
            // noinspection JSPotentiallyInvalidUsageOfClassThis
            this._streamhash(fs.createReadStream(filepath), {format, algorithm}, (err, actual) => {
                if (err || (actual !== digest)) { cb(err || new Error(`multihash ${format} ${algorithm} ${actual} doesnt match ${digest}`)); }
                else { cb(); }
            });
        } else { //
            // noinspection JSUnresolvedVariable
            fs.access(filepath, fs.constants.R_OK, cb);
        }
    }

    static checkWhereValidFile(relFilePath, {digest=undefined, format=undefined, algorithm=undefined}, cb) { //TODO-API add this
        // Return filepath to a file if it exists in one of the cache Directories.
        config.directories.detect( d ,cb2 =>
            this.maybeCheckSha(path.join(d, relFilePath),
                                digest, format, algorithm},
                                (err, unused) => cb2(null, !err)));
    }


    static cacheAndOrStream({relFilePath=undefined,
                                  debugname="UNDEFINED", urls=undefined,
                                  expectsize=undefined, sha1=undefined, skipFetchFile=false, wantStream=false, wantBuff=false,
                                  start=0, end=undefined} = {}, cb) {
        /*
        Complicated function to encapsulate in one place the logic around the cache.

        Returns a stream from the cache, or the net if start/end unset cache it
        relFilePath:    Path, relative to  cache, to a file.
        urls:           Single url or array to retrieve
        debugname:      Name for this item to use in debugging typically ITEMID/FILENAME
        expectsize:     If defined, the result must match this size or will be rejected (it comes from metadata)
        sha1:           If defined, the result must match this sha1 or will be rejected (it comes from metadata)
        skipFetchFile:  If true, then dont actually fetch the file (used for debugging)
        wantStream:     True if want an open stream to the contents, (set to false, when crawling)
        wantBuff:       True if want a buffer of data (not stream)
        start,end       First and last bytes wanted
        cb(err, s|undefined) if wantStream will call with a stream (see below)

        TypicalUsages:
        in mirroring    wantStream, start,end undefined
        in browsing     wantStream=true, start & end may be set or be set to 0,undefined.

        cb behavior needs explanation !
            If wantStream, then cb will call back as soon as a stream is ready from the net
            If !wantStream, then cb will only call back (with undefined) when the file has been written to disk and the file renamed.
            In particular this means that wantStream will not see a callback if one of the errors occurs after the stream is opened.
        */
        console.assert(urls);
        this.checkWhereValidFile(relFilePath, {digest: sha1, format: 'hex', algorithm: 'sha1'}, (err, existingFilePath) => {
            if (err) { //Doesn't match
                _notcached.call(this);
            } else { // sha1 matched, skip fetching, just stream from saved
                if (wantStream) {
                    debug("streaming from cached", existingFilePath, "as sha1 matches");
                    cb(null, fs.createReadStream(existingFilePath, {start, end}));   // Already cached and want stream - read from file
                } else {
                    debug("Already cached", existingFilePath, "with correct sha1");
                    callbackEmptyOrData(existingFilePath);
                }
            }
        });
        function callbackEmptyOrData(existingFilePath) {
            if (wantBuff) {
                fs.readFile(existingFilePath, cb); //TODO check if its a string or a buffer or what
            } else {
                cb();
            }
        }

        function _notcached() {
            /*
            Four possibilities - wantstream &&|| partialrange
            ws&p: net>stream; ws&!p: net>disk, net>stream; !ws&p; unsupported, though could be in callbackEmptyOrData; !ws&!p caching
             */
            if (skipFetchFile) {
                debug("skipFetchFile set (testing) would fetch: %s", debugname);
                cb();
            } else {
                const partial = (start>0 || end<Infinity);
                console.assert(wantStream || !partial,"ArchiveFile.cacheAndOrStream - it makes no sense to request a partial fetch without a stream output");
                if (partial) {  // start or end undefined dont satisfy this test
                    debug("Not caching %s because specifying a range %s:%s and wantStream", debugname, start, end);
                    DwebTransports.createReadStream(urls, {start, end}, cb); // Dont cache a byte range, just return it
                } else {
                    DwebTransports.createReadStream(urls, {start, end}, (err, s) => { //Returns a promise, but not waiting for it
                        if (err) {
                            debug("cacheAndOrStream had error reading", debugname, err.message);
                            cb(err); // Note if dont want to trigger an error when used in streams, then set justReportError=true in stream
                            // Dont try and write it
                        } else {
                            // Now create a stream to the file
                            const newFilePath = path.join(this._copyDirectory(), relFilePath);
                            const filepathTemp = newFilePath + ".part");
                            MirrorFS._fileopenwrite(copyDir, filepathTemp, (err, fd) => { // Will make directory if reqd
                                if (err) {
                                    debug("Unable to write to %s: %s", filepathTemp, err.message);
                                    cb(err);
                                } else {
                                    // fd is the file descriptor of the newly opened file;
                                    // noinspection JSPotentiallyInvalidUsageOfClassThis
                                    const hashstream = this._hashstream();
                                    const writable = fs.createWriteStream(null, {fd: fd});
                                    // Note at this point file is neither finished, nor closed, its a stream open for writing.
                                    //fs.close(fd); Should be auto closed when stream to it finishes
                                    writable.on('close', () => {
                                        // noinspection EqualityComparisonWithCoercionJS
                                        const hexhash = hashstream.actual.toString('hex');
                                        // noinspection EqualityComparisonWithCoercionJS
                                        if ((expectsize && (expectsize != writable.bytesWritten)) || ((typeof sha1 !== "undefined") && (hexhash !== sha1))) { // Intentionally != as metadata is a string
                                            // noinspection JSUnresolvedVariable
                                            debug("File %s size=%d sha1=%s doesnt match expected %s %s, deleting", debugname, writable.bytesWritten, hexhash, expectsize, sha1);
                                            fs.unlink(filepathTemp, (err) => {
                                                if (err) { console.error(`Can't delete ${filepathTemp}`); } // Shouldnt happen
                                                if (!wantStream) cb(err); // Cant send err if not wantStream as already done it
                                            })
                                        } else {
                                            fs.rename(filepathTemp, newFilePath, (err) => {
                                                if (err) {
                                                    console.error(`Failed to rename ${filepathTemp} to ${newFilePath}`); // Shouldnt happen
                                                    if (!wantStream) cb(err); // If wantStream then already called cb
                                                } else {
                                                    //TODO-MULTI check right to correct hashstore, and then change to relative path
                                                    this.hashstore.put("sha1.filepath", multihash58sha1(hashstream.actual), newFilePath);
                                                    // noinspection JSUnresolvedVariable
                                                    debug(`Closed ${debugname} size=${writable.bytesWritten}`);
                                                    if (!wantStream) {  // If wantStream then already called cb, otherwise cb signifies file is written
                                                        callbackEmptyOrData(newFilePath);
                                                    }
                                                }
                                            })
                                        }
                                    });
                                    s.on('error', (err) => debug("Failed to read %o from net err=%s", urls, err.message));
                                    try {
                                        s.pipe(hashstream).pipe(writable);   // Pipe the stream from the HTTP or Webtorrent read etc to the stream to the file.
                                        if (wantStream) cb(null, s);
                                    } catch(err) {
                                        console.error("ArchiveFilePatched.cacheAndOrStream failed ",err);
                                        if (wantStream) cb(err);
                                    }
                                }
                            });


                        }
                    });
                }
            }
        }

    };

    //TODO-MULTI and check usages of cacheDirectory
    static _streamOfCachedItemPaths({cacheDirectory = undefined}) {
        // Note returns s immediately, then asynchronous reads directories and pipes into s.
        // Runs in parallel 100 at a time,
        let s = new ParallelStream({name: "Cached Item Paths"});
        fs.readdir(cacheDirectory, (err, files) => {
            if (err) {
                debug("Failed to read directory %s", cacheDirectory);
                cb(err); // Just pass up to caller
            } else {
                return ParallelStream.from(files.filter(f=>!f.startsWith(".")), {name: "stream of item directories"})
                    .map(filename => `${cacheDirectory}/${filename}`, {name: "build filename"})       //   /foo/mirrored/<item>
                    .map((pathstr, cb) => fs.readdir(pathstr,
                        (err, files) => {
                            if (err) { cb(null, pathstr) }      // Just pass on paths that aren't directories
                            else { cb(null, files.filter(f=>!f.startsWith(".")).map(f=>`${pathstr}/${f}`)) }} ),
                        {name: "Read files dirs", async: true, paralleloptions: {limit:100}})                                         //  [ /foo/mirrored/<item>/<file>* ]
                    .flatten({name: "Flatten arrays"})                                                  //  /foo/mirrored/<item>/<file>
                    // Flatten once more to handle subdirs
                    .map((pathstr, cb) => fs.readdir(pathstr,
                        (err, files) => {
                            if (err) { cb(null,pathstr) }      // Just pass on paths that aren't directories
                            else { cb(null, files.filter(f=>!f.startsWith(".")).map(f=>`${pathstr}/${f}`)) }} ),
                        {name: "Read files dirs", async: true, paralleloptions: {limit:100}})                                         //  [ /foo/mirrored/<item>/<file>* ]
                    .flatten({name: "Flatten arrays level 2"})                                                 //  /foo/mirrored/<item>/<file>
                    .pipe(s);
            }
        });
        return s;
    }

    //TODO-MULTI - redo to use async.each etc and multiple hashstores
    static loadHashTable({cacheDirectories = undefined, algorithm = 'sha1'}, cb) {
        // Normally before running this, will delete the old hashstore
        // Stores hashes of files under cacheDirectory to hashstore table=<algorithm>.filepath
        // Runs in parallel 100 at a time,
        const tablename = `${algorithm}.filepath`;
        each( cacheDirectories.length ? cacheDirectories : config.directories,
            (cacheDirectory,cb1) => {
                MirrorFS._streamOfCachedItemPaths({cacheDirectory})
                .map((filepath, cb2) =>  this._streamhash(fs.createReadStream(filepath), {format: 'multihash58', algorithm}, (err, multiHash) => {
                        if (err) { debug("loadHashTable saw error: %s", err.message); cb2(); }
                        else { this.hashstore.put(tablename, multiHash, filepath, cb2); }
                    }),
                    {name: "Hashstore", async: true, paralleloptions: {limit:100}})
                .reduce(undefined, undefined, cb1);
            })
    }

}
//TODO-MULTI - move so MirrorFS can depend on config
MirrorFS.hashstore = HashStore.init({dir: `${config.directory}/.hashStore.`}); // Note trailing period - will see files like <config.directory>/<config.hashstore><tablename>

exports = module.exports = MirrorFS;
