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
const waterfall = require('async/waterfall');
var exec = require('child_process').exec;

// other packages of ours
const ParallelStream = require('parallel-streams');
const ACUtil = require("@internetarchive/dweb-archivecontroller/Util.js"); // for Object.fromEntries
//Should always be defined in caller prior to requiring dweb-objects
const httptools = require('@internetarchive/dweb-transports/httptools');

// other packages in this repo
const HashStore = require('./HashStore');

function multihash58sha1(buf) { return multihashes.toB58String(multihashes.encode(buf, 'sha1')); }


class MirrorFS {
    /*
    Utility subclass that knows about the file system.

    properties:
      copyDirectory:  place to put a copy
      hashstores: { directory: hashstore }  esp sha1.filestore

     */

    static init({directories, httpServer, urlUrlstore, }) { // Not a constructor, all methods are static
        this.directories = directories;
        this.httpServer = httpServer;
        this.urlUrlstore = urlUrlstore;
        this.hashstores = Object.fromEntries(               // Mapping
            this.directories.map(d =>                         // of each config.directories
                [d,new HashStore({dir: d+"/.hashStore."})]));   // to a hashstore, Note trailing period - will see files like <config.directory>/<config.hashstore><tablename>
    }
    static _copyDirectory() {
        return this.copyDirectory || this.directories[0];
    }
    static setCopyDirectory(dir) {
        this.copyDirectory = dir;
        this.hashstores[dir] = new HashStore({dir: dir+"/.hashStore."}); // Note trailing "." is intentional"
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

    static rmdir(path, cb) {
        var path = '/path/to/the/dir';
        exec('rm -r ' + path, function (err, stdout, stderr) {
            if (err) {
                debug ("failed to rm -r %s", path);
                cb(err);
            } else {
                cb(null);
            }
        });
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
        this.checkWhereValidFile(relFilePath, {}, (err, existingFilePath) => {
            if (err) cb(err);
            else fs.readFile(existingFilePath, cb);
        });
    }
    static writeFile(relFilePath, data, cb) {
        // Like fs.writeFile but will mkdir the directory before writing the file
        //TODO-MULTI - location in order of preference: copyDirectory; place directory exists; this.directories[0] (which comes from config.directories)
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

    static _fileopenwrite(relFilePath, cb) {
        /*
        directory top level directory of cache - must exist
        filepath path to file (rooted preferably)
        If fails to open for writing then will check for presence of a root directory, and recursively mkdir before trying again.
        cb(err, fd)     Open file descriptor
         */
        try {
            const directory = this._copyDirectory();
            const filepath = path.join(directory, relFilePath);
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
        this._fileopenwrite(relFilePath, (err, fd) => {
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

    static checkWhereValidFile(relFilePath, {digest=undefined, format=undefined, algorithm=undefined}, cb) {
        /*
        digest      Digest of file to find
        format      hex or multihash - how hash formatted
        algorithm   e.g. 'sha1'
        relFilePath <Identifier>/<Filename>

        Note - either relFilePath or digest/format/algorithm can be omitted,
        If relFilePath && !digest it just checks the cache directories
        If digest && !relFilePath it will try and locate file in hashstores
        if relPath && digest the hash will be recalculated and checked.

        cb(err, filepath)
         */
        detect( this.directories, (cacheDirectory, cb2) => {
            waterfall([
                (cb3) => { // if no relFilePath check the hashstore
                    if (relFilePath) {
                            cb3(null);
                    } else {
                        this.hashstores[cacheDirectory].get(algorithm + ".relfilepath", digest, (err,res) => {
                            relFilePath = res; // poss undefined - saving over relFilePath parameter which is undefined
                            cb3(err || !relFilePath); // Shouldnt be error but fail this waterfall if didn't find hash in this cache.
                        });
                    }
                },
                (cb4) => { // Check file readable
                    // noinspection JSUnresolvedVariable
                    fs.access(path.join(cacheDirectory, relFilePath), fs.constants.R_OK, cb4);
                },
                (cb5) => { // if digest, then test its correct
                    if (!digest) {
                        cb5();
                    } else {
                        const filepath = path.join(cacheDirectory, relFilePath);
                        this._streamhash(fs.createReadStream(filepath), {format, algorithm}, (err, actual) => {
                            if (err) debug("Error from streamhash for %s: %s", filepath, err.message); // log as error lost in waterfall
                            if (actual !== digest) { debug("multihash %s %s %s doesnt match %s %s", format, algorithm, digest, filepath, digest); err=true} // Just test boolean anyway
                            cb5(err);
                        });
                    }
                }
            ], (err, unused) => cb2(null, !err)) // Did the detect find one
        }, (err, res) => {
            // Three possibilities - err (something failed) res (found) !err && !res (not found)
            if (err)
                cb(err);
            else if (!res)
                cb (new Error(`${relFilePath} not found in caches`));
            else
                cb(null, path.join(res, relFilePath)); // relFilePath should have been set by time get here
        });
    }

    static cacheAndOrStream({relFilePath=undefined,
                                  debugname="UNDEFINED", urls=undefined,
                                  expectsize=undefined, sha1=undefined, ipfs=undefined, skipFetchFile=false, wantStream=false, wantBuff=false,
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
        ipfs:           IPFS hash if known
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
                if (this.copyDirectory && !existingFilePath.startsWith(this.copyDirectory)) {
                    const copyFilePath = path.join(this.copyDirectory, relFilePath);
                    fs.copyFile(existingFilePath, copyFilePath , (err) => {
                        if (err) {
                            debug("Failed to copy %s to %s", relFilePath, copyFilePath);
                        } else {
                            debug("copied cached file to %s", copyFilePath);
                        }
                        callbackEmptyOrDataOrStream(existingFilePath);
                    })
                } else {
                    callbackEmptyOrDataOrStream(existingFilePath);
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
        function callbackEmptyOrDataOrStream(existingFilePath) {
            if (wantStream) {
                debug("streaming from cached", existingFilePath, "as sha1 matches");
                cb(null, fs.createReadStream(existingFilePath, {start, end}));   // Already cached and want stream - read from file
            } else {
                debug("Already cached", existingFilePath, "with correct sha1");
                callbackEmptyOrData(existingFilePath);
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
                            const relFilePathTemp = relFilePath + ".part";
                            const filepathTemp = path.join(this._copyDirectory(), relFilePathTemp);
                            MirrorFS._fileopenwrite(relFilePathTemp, (err, fd) => { // Will make directory if reqd
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
                                        // noinspection JSCheckFunctionSignatures
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
                                                    this.hashstores[this._copyDirectory()].put("sha1.relfilepath", multihash58sha1(hashstream.actual), relFilePath);
                                                    this.addIPFS({relFilePath}, (err, res) => { });
                                                    //Ignore err & res, its ok to fail to add to IPFS and will be logged inside addIPFS()
                                                    // Also - its running background, we arent waiting for it to complete
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

    static _streamOfCachedItemPaths({cacheDirectory = undefined}) {
        // Note returns stream 's' immediately, then asynchronous reads directories and pipes relFilePath <item>/<file> or <item>/<subdir>/<file> into s.
        // Runs in parallel 100 at a time,
        let s = new ParallelStream({name: "Cached Item Paths"});
        fs.readdir(cacheDirectory, (err, files) => {
            if (err) {
                debug("Failed to read directory %s", cacheDirectory);
                files=[];
            }
                return ParallelStream.from(files.filter(f=>!f.startsWith(".")), {name: "stream of item directories", paralleloptions: {silentwait: true}}) // Can exclude other non hashables here
                    .map((identifier, cb) => fs.readdir(path.join(cacheDirectory, identifier),
                        (err, files) => {
                            if (err) { cb(null, path.join(cacheDirectory, identifier) );}      // Just pass on relPaths (identifiers) that aren't directories
                            else { cb(null, files.filter(f=>!f.startsWith(".")).map(f=>path.join(identifier, f))) }} ),
                        {name: "Read files dirs", async: true, paralleloptions: {limit:100, silentwait: true}})                                         //  [ /foo/mirrored/<item>/<file>* ]
                    // Stream of <filename> (unlikely) and [<identifier>/<filename||subdirname>*]
                    .flatten({name: "Flatten arrays"})                                                  //  /foo/mirrored/<item>/<file>
                    // Stream of <filename> (unlikely) and <identifier>/<filename||subdirname>
                    // Flatten once more to handle subdirs
                    .map((relFilePath, cb) => fs.readdir(path.join(cacheDirectory, relFilePath),
                        (err, files) => {
                            if (err) { cb(null,relFilePath) }      // Just pass on paths that aren't directories (should all be hashable files)
                            else { cb(null, files.filter(f=>!f.startsWith(".")).map(f=> path.join(cacheDirectory, f))) }} ),
                        {name: "Read files sub dirs", async: true, paralleloptions: {limit:100, silentwait: true}})                                         //  [ /foo/mirrored/<item>/<file>* ]
                    .flatten({name: "Flatten arrays level 2"})                                                 //  <item>/<file> & <item>/<subdir>/<file>
                    .pipe(s);
        });
        return s;
    }

    //maybe redo to use async.each etc
    static maintenance({cacheDirectories = undefined, algorithm = 'sha1', ipfs = false}, cb) {
        // Normally before running this, will delete the old hashstore
        // Stores hashes of files under cacheDirectory to hashstore table=<algorithm>.filepath
        // Runs in parallel 100 at a time,
        const tablename = `${algorithm}.relfilepath`;
        each( (cacheDirectories && cacheDirectories.length) ? cacheDirectories : this.directories,
            (cacheDirectory, cb1) => {
                this.hashstores[cacheDirectory].destroy(tablename, (err, res)=> {
                    if (err) {
                        debug("Unable to destroy hashstore %s in %s", tablename,cacheDirectory);
                        cb1(err);
                    } else {
                        MirrorFS._streamOfCachedItemPaths({cacheDirectory})
                            .filter(relFilePath => {
                                if (relFilePath.endsWith('.part')) {
                                    // Note the unlink is async, but we are not waiting for it.
                                    fs.unlink(path.join(cacheDirectory, relFilePath), (err) => debug("unlink %s %s", relFilePath, err ? "Failed "+err.message : ""))
                                    return false; // Dont hash or add to IPFS
                                } else {
                                    return true;
                                }
                            })
                            .map((relFilePath, cb2) => this._streamhash(fs.createReadStream(path.join(cacheDirectory, relFilePath)), {
                                    format: 'multihash58',
                                    algorithm
                                },
                                (err, multiHash) => {
                                    if (err) {
                                        debug("loadHashTable saw error: %s", err.message);
                                        cb2(err);
                                    } else {
                                        this.hashstores[cacheDirectory].put(tablename, multiHash, relFilePath, (err, res) => {
                                            if (err) { debug("failed to put table:%s key:%s val:%s %s", tablename, multiHash, relFilePath, err.message); cb2(err); } else {
                                                cb2(null, relFilePath)
                                            }
                                        });
                                    }
                                }),
                                {name: "Hashstore", async: true, paralleloptions: {limit: 100, silentwait: true}})
                            .map((relFilePath, cb3) => { if (ipfs && !this.isSpecialFile(relFilePath)) { this.addIPFS({relFilePath}, cb3); } else { cb3(); }},
                                {name: "addIPFS", async: true, justReportError: true, paralleloptions: {limit: 0}})
                            .reduce(undefined, undefined, cb1);
                    }
                })
            },
            cb)
    }

    static addIPFS({relFilePath, ipfs}, cb) {
        /* Add a file to IPFS, it should end up with a hash that matches that generated on dweb.me, allowing IPFS network splits to be healed.
        TODO document args
        Working around IPFS limitation in https://github.com/ipfs/go-ipfs/issues/4224
        relFilePath: ITEMID/FILENAME
        ipfs:       IPFS hash if known (usually not known)
         */
        /*
        check if filename is relative to $HOME
        if not then symlink and convert path to use symlink
        call js-api to write it
        check hash matches that in the metadata
         */

        // This is the URL that the IPFS server uses to get the file from the local mirrorHttp
        if (!this.urlUrlstore) { // Not doing IPFS
            cb(null,undefined); // OK not to do it
        } else {
            const url2file = [this.httpServer + ACUtil.gateway.urlDownload, relFilePath].join('/'); // This is arc/archive.org/download/
            const url = `${this.urlUrlstore}?arg=${encodeURIComponent(url2file)}`
            // Have to be careful to avoid loops, the call to addIPFS should only be after file is retrieved and cached, and then addIPFS shouldnt be called if already cached
            // TODO-IPFS pass a parameter to p_GET that tells it not to loop retrying
            httptools.p_GET(url, (err, res) => {
                if (err) {
                    debug("addIPFS for %s failed in http: %s", url2file, err.message);
                    cb(err);
                } else {
                    debug("Added %s to IPFS key=", relFilePath, res.Key);
                    if (ipfs && ipfs != res.Key) {  debug("ipfs hash doesnt match expected metadata has %s daemon returned %s", ipfs, res.Key); }
                    //TODO-IPFS store res.Key in metadata - though not using for anything currently
                    cb(null, res)
                }
            })
        }
    }
    static isSpecialFile(relFilePath) { // Note special files should match between MirrorFS.isSpecialFile and ArchiveItemPatched.save
        return ["_meta.json", "_extra.json", "_member.json", "_members_cached.json", "_members.json","_files.json","_extra.json","_reviews.json", ".part", "_related.json"].some(ending=>relFilePath.endsWith(ending));
    }
}

exports = module.exports = MirrorFS;
