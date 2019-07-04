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
const detectSeries = require('async/detectSeries');
const each = require('async/each');
const waterfall = require('async/waterfall');
const map = require('async/map');
// noinspection ES6ConvertVarToLetConst
var exec = require('child_process').exec;

// other packages of ours
const ParallelStream = require('parallel-streams');
const {gateway, ObjectFromEntries} = require("@internetarchive/dweb-archivecontroller/Util.js"); // for Object.fromEntries
//Should always be defined in caller prior to requiring dweb-objects

// other packages in this repo - note it is intentional that this does not depend on config
const HashStore = require('./HashStore');

function multihash58sha1(buf) { return multihashes.toB58String(multihashes.encode(buf, 'sha1')); }


class MirrorFS {
    /*
    Utility subclass that knows about the file system.

    properties:
      hashstores: { directory: hashstore }  esp sha1.filestore

    Common parameters to functions
        algorithm:  Hash algorithm to be used, defaults to 'sha1' and only tested on that
        cacheDirectory: Same as directory
        debugname:  Name to use in debug statements to help see which file/item it refers to.
        directory:  Absolute path to directory where cache stored, may include symlinks, but not Mac Aliases
        filepath:   Absolute path to file, normally must be in "directory"
        format:     Format of result, defaults to 'hex', alternative is 'multihash58'
        noCache:    skip cache on reading, but store results
        noStore:    use cache on reading, but do not store results
        skipNet:    if set then do not try and fetch from the net
        wantStream  The caller wants a stream as the result (the alternative is an object with the results)
        start       The first byte or result to return (default to start of file/result)
        end         The last byte or result to return (default to end of file/result)
     */

    static init({directories, httpServer, preferredStreamTransports=[] }) { // Not a constructor, all methods are static
        this.directories = directories;
        this.httpServer = httpServer;
        this.preferredStreamTransports = preferredStreamTransports; // Order in which to select possible stream transports
        this.hashstores = ObjectFromEntries(               // Mapping
            this.directories.map(d =>                         // of each config.directories
                [d,new HashStore({dir: d+"/.hashStore."})]));   // to a hashstore, Note trailing period - will see files like <config.directory>/<config.hashstore><tablename>
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
                        if (err && !(err.code === "EEXIST")) { // Its quite possible (likely) two attempts to create same directory at same time when loading many files in same dir
                            cb(err)
                        } else {  // Dont know how to tackle error from _mkdir, note that EEXIST would be odd since ENOENT implies it doesnt exist
                            fs.mkdir(dirname, err => {
                                if (err && !(err.code === "EEXIST")) { cb(err) } else { cb(null) }
                            });
                        }
                    })
                } else {
                    cb(err); // Throw any other error
                }
            } else {
                cb();
            }
        })
    }

    static rmdir(path, cb) {
        //var path = '/path/to/the/dir';
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

    static readFile(relFilePath, {copyDirectory}, cb) {
        // like fs.readFile, but checks relevant places first
        this.checkWhereValidFile(relFilePath, {copyDirectory}, (err, existingFilePath) => {
            if (err) cb(err);
            else fs.readFile(existingFilePath, cb);
        });
    }
    static writeFile({copyDirectory=undefined, relFilePath}, data, cb) { //TODO-API copyDirectory and {}
        // Like fs.writeFile but will mkdir the directory before writing the file
        //TODO-MULTI - location in order of preference: copyDirectory; place directory exists; this.directories[0] (which comes from config.directories)
        const filepath = path.join(copyDirectory || this.directories[0], relFilePath);
        const dirpath = path.dirname(filepath);
        this._mkdir(dirpath, (err) => {
            if (err) {
                debug("ERROR: MirrorFS.writeFile: Cannot mkdir %s", dirpath, err.message);
                cb(err);
            } else {
                fs.writeFile(filepath, data, (err) => {
                    if (err) {
                        debug("ERROR: MirrorFS.writeFile: Unable to write to %s: %s", filepath, err.message);
                        cb(err);
                    } else {
                        cb(null);
                    }});
            }});
    }

    static copyFile(sourcePath, destnPath, cb) {
        this._mkdir(path.dirname(destnPath), (err) => {
            if (err) {
                debug("ERROR: MirrorFS.copyFile: Cannot mkdir %s: %s",path.dirname(destnPath), err.message);
                cb(err);
            } else {
                fs.copyFile(sourcePath, destnPath, (err) => {
                    if (err) {
                        debug("ERROR: MirrorFS.copyFile: Unable to copy %s to %s: %s", sourcePath, destnPath, err.message);
                        cb(err);
                    } else {
                        cb(null);
                    }
                });
            }
        });
    }
    static _fileopenwrite({relFilePath, cacheDirectory}={}, cb) { //TODO-API
        /*
        directory top level directory of cache - must exist
        filepath path to file (rooted preferably)
        If fails to open for writing then will check for presence of a root directory, and recursively mkdir before trying again.
        cb(err, fd)     Open file descriptor
         */
        try {
            const filepath = path.join(cacheDirectory, relFilePath);
            fs.open(filepath, 'w', (err, fd) => {
                if (err) {
                    if (err.code === "ENOENT") {    // Doesnt exist, which means the cacheDirectory or subdir -
                        // noinspection JSUnusedLocalSymbols
                        fs.stat(cacheDirectory, (err, unusedStats) => {
                            if (err) throw new Error(`The root directory for mirroring: ${cacheDirectory} is missing - please create by hand`);
                            debug("MirrorFS creating directory: %s", path.dirname(filepath));
                            MirrorFS._mkdir(path.dirname(filepath), err => {
                                if (err) {
                                    console.error("Failed to mkdir for", filepath, err.message);
                                    cb(err);
                                } else {
                                    fs.open(filepath, 'w', (err, fd) => {
                                        if (err) { // This shouldnt happen, we just checked the cacheDirectory.
                                            console.error("Failed to open", filepath, "after mkdir");
                                            cb(err);
                                        } else {
                                            cb(null, fd);
                                        }
                                    });
                                }
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

    static checkWhereValidFileRotatedScaled( {relFileDir=undefined, file=undefined, scale=undefined, rotate=undefined,
                                                 noCache=undefined, copyDirectory=undefined}, cb) { //TODO-API noCache
        /*
            relFileDir: Item's dir
            file:       File within dir
            scale:      scale wanted at
            rotate:     rotation wanted
            noCache:    Dont check cache for it
            cb(err, filepath) - Careful, its err,undefined if not found unlike checkWhereValidFile
         */
        const scales = [];
        for(let i=Math.floor(scale); i>0; i--) { scales.push(i); }  // A = e.g. [ 8...1 ]
        detectSeries(scales.map(s => `${relFileDir}/scale${s}/rotate${rotate}/${file}`),
            (rel, cb2) => this.checkWhereValidFile(rel, {noCache, copyDirectory}, (err, unusedRes) => cb2(null, !err)), // Find the first place having a file bigger or same size as
            cb
        )
    }
    static checkWhereValidFile(relFilePath, {existingFilePath=undefined, noCache=false, digest=undefined,
        format=undefined, algorithm=undefined, copyDirectory=undefined}, cb) { //TODO-API
        /*
        digest      Digest of file to find
        format      hex or multihash - how hash formatted
        existingFilePath  Something else found the file already
        noCache     Dont check the cache (note digest overrides noCache, as will confirm file's sha1)
        algorithm   e.g. 'sha1'
        relFilePath <Identifier>/<Filename>

        Note - either relFilePath or digest/format/algorithm can be omitted,
        If relFilePath && !digest it just checks the cache directories
        If digest && !relFilePath it will try and locate file in hashstores
        if relPath && digest the hash will be recalculated and checked.

        cb(err, filepath)
         */
        if (noCache && !digest) {
          cb(new Error("no-cache")); // Dont use cached version
        } else if (existingFilePath) {
          cb(null, existingFilePath); // Got it
        } else {
          detect( copyDirectory ? [].concat(copyDirectory, this.directories) : this.directories, // If copyDirectory specified then look there first whether or not its in this.directories
            (cacheDirectory, cb2) => { // Looking for first success
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
                            if (actual !== digest) { debug("multihash %s %s %s doesnt match file %s which is %s", format, algorithm, digest, filepath, actual); err=true} // Just test boolean anyway
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
    }

    static cacheAndOrStream({ relFilePath=undefined, //TODO-API noCache, copyDirectory
                                existingFilePath=undefined,
                                debugname="UNDEFINED", urls=undefined,
                                expectsize=undefined, sha1=undefined, ipfs=undefined, skipFetchFile=false,
                                wantStream=false, wantBuff=false, wantSize=false,
                                noCache=false, skipNet=false,
                                start=0, end=undefined,
                                copyDirectory=undefined } = {},
                                cb) {
        /*
        Complicated function to encapsulate in one place the logic around the cache.

        Returns a stream from the cache, or the net if start/end unset cache it
        relFilePath:    Path, relative to  cache, to a file.
        existingFilePath:    If found, something else found where this file was
        urls:           Single url or array to retrieve (optional, if not supplied it will only check locally)
        debugname:      Name for this item to use in debugging typically ITEMID/FILENAME
        expectsize:     If defined, the result must match this size or will be rejected (it comes from metadata)
        sha1:           If defined, the result must match this sha1 or will be rejected (it comes from metadata)
        skipFetchFile:  If true, then dont actually fetch the file (used for debugging)
        ipfs:           IPFS hash if known
        wantStream:     True if want an open stream to the contents, (set to false, when crawling)
        wantBuff:       True if want a buffer of data (not stream)
        wantSize:       Want the size of the data (cached or from net)
        noCache:        Dont read local cache, but will still store and maybe use cache if cant get from net (overridden by sha1)
        skipNet:        Dont check the net
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
        const cacheDirectory = copyDirectory || this.directories[0]; // Where the file should be put if creating it
        this.checkWhereValidFile(relFilePath, {existingFilePath, noCache, digest: sha1, format: 'hex', algorithm: 'sha1', copyDirectory},
          (err, existingFilePath) => {
            if (err) {  //Doesn't match
                if (!urls || (Array.isArray(urls) && !urls.length) || skipNet) {
                    cb(err); // Dont have it (which is reasonable, as caller such as AF.cacheOrStream might then find URLS and try again)
                } else { // Have urls, retrieve and cache
                    _notcached.call(this);
                }
            } else { // sha1 matched, skip fetching, just stream from saved
                haveExistingFile.call(this, existingFilePath, sha1)
            }
        });
        function haveExistingFile(existingFilePath, sha1) {
            if (copyDirectory && !existingFilePath.startsWith(copyDirectory)) {
                // We have the right file, but in the wrong place
                const copyFilePath = path.join(copyDirectory, relFilePath);
                this.copyFile(existingFilePath, copyFilePath , (err) => {
                    if (err) {
                        debug("ERROR: MirrorFS.cacheAndOrStream of %s failed %s", relFilePath, err.message);
                    } else {
                        debug("Copied existing file %sfrom %s to %s", sha1 ? "with matching sha1 " : "", existingFilePath, copyFilePath);
                        callbackEmptyOrDataOrStream(existingFilePath, sha1);
                    }
                })
            } else {
                // Write file and either right place, or we dont care where
                debug("Already cached existing file %s%s %s", sha1 ? "with matching sha1 " : "", existingFilePath);
                callbackEmptyOrDataOrStream(existingFilePath, sha1);
            }
        }
       function callbackEmptyOrData(existingFilePath) {
            if (wantBuff) {
                fs.readFile(existingFilePath, cb); //TODO check if its a string or a buffer or what
            } else if (wantSize) {
                fs.stat(existingFilePath, (err, stats) => {
                    cb(err, stats && stats.size);
                });
            } else {
                cb();
            }
        }
        function callbackEmptyOrDataOrStream(existingFilePath, sha1) {
            if (wantStream) {
                debug("streaming %s from cache", existingFilePath);
                cb(null, fs.createReadStream(existingFilePath, {start, end}));   // Already cached and want stream - read from file
            } else {
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
                    DwebTransports.createReadStream(urls, {start, end, preferredTransports: this.preferredStreamTransports}, cb); // Dont cache a byte range, just return it
                } else {
                    DwebTransports.createReadStream(urls, {start, end, preferredTransports: this.preferredStreamTransports}, (err, s) => { //Returns a promise, but not waiting for it
                        if (err) {
                            debug("cacheAndOrStream had error reading", debugname, err.message);
                            cb(err); // Note if dont want to trigger an error when used in streams, then set justReportError=true in stream
                            // Dont try and write it
                        } else {
                            // Now create a stream to the file
                            const newFilePath = path.join(cacheDirectory, relFilePath);
                            const relFilePathTemp = relFilePath + ".part";
                            const filepathTemp = path.join(cacheDirectory, relFilePathTemp);
                            MirrorFS._fileopenwrite({ relFilePath: relFilePathTemp, cacheDirectory }, (err, fd) => { // Will make directory if reqd
                                if (err) {
                                    debug("ERROR MirrorFS.cacheAndOrStream: Unable to write to %s: %s", filepathTemp, err.message);
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
                                                    this.hashstores[cacheDirectory].put("sha1.relfilepath", multihash58sha1(hashstream.actual), relFilePath, (err)=>{
                                                        debug(`Closed ${debugname} size=${writable.bytesWritten} %s`,err ? err.message : "");
                                                        this.seed({relFilePath, directory: cacheDirectory}, (unusedErr, unusedRes) => { }); // Seed to IPFS, WebTorrent etc
                                                        //Ignore err & res, its ok to fail to seed and will be logged inside seed()
                                                        // Also - its running background, we are not making caller wait for it to complete
                                                        // noinspection JSUnresolvedVariable
                                                        if (!wantStream) {  // If wantStream then already called cb, otherwise cb signifies file is written
                                                            callbackEmptyOrData(newFilePath);
                                                        }
                                                    });
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

    static readDirRecursive(basedir, relpath, cb) {
        fs.readdir(path.join(basedir, relpath), (err, files) => {
            if (err) {  // Probably a directory
                cb(null, [relpath])
            } else {
                map( files.map(f => path.join(relpath, f)),
                  (relpathfile, cb1) => this.readDirRecursive(basedir, relpathfile, cb1),
                  (err, res) => {  // res = [ [ ]* ]
                      if (err) {
                          cb(err);
                      } else {
                          cb(null, [].concat(...res)); // Flatten and return array via cb
                      }
                  })
            }
        });
    }

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
                  .map((identifier, cb) => this.readDirRecursive(cacheDirectory, identifier, cb),  // Stream of arrays - it does it recursively
                        {name: "Read files dirs", async: true, paralleloptions: {limit:100, silentwait: true}})                                         //  [ /foo/mirrored/<item>/<file>* ]
                    // Stream of arrays of [IDENTIFIER/FILENAME or IDENTIFIER/SUBDIRNAME/FILENAME] to whatever depth required
                    .flatten({name: "Flatten arrays"})                                                  //  /foo/mirrored/<item>/<file>
                    // Stream of FILENAME (unlikely) and IDENTIFIER/FILENAME and IDENTIFIER/SUBDIRNAME/FILENAME
                    // Flatten once more to handle subdirs
                    .pipe(s);
        });
        return s;
    }

    //maybe redo to use async.each etc
    static maintenance({cacheDirectories = undefined, algorithm = 'sha1', ipfs = false}, cb) {
        /*
        Stores hashes of files under cacheDirectory to hashstore table=<algorithm>.filepath
        Runs in parallel 100 at a time,
        It catches the following issues.
        - rebuilds hash tables at top of each volume (no report as we just rebuild it)
        - Unlinks any files ending in part
        */
        const tablename = `${algorithm}.relfilepath`;
        const errs = [ ];
        each( (cacheDirectories && cacheDirectories.length) ? cacheDirectories : this.directories,
            (cacheDirectory, cb1) => {
                this.hashstores[cacheDirectory].destroy(tablename, (err, unusedRes)=> {
                    if (err) {
                        debug("Unable to destroy hashstore %s in %s", tablename,cacheDirectory);
                        cb1(err);
                    } else {
                        MirrorFS._streamOfCachedItemPaths({cacheDirectory}) // Stream of relative file paths //TODO should be a stream of AF
                            .filter(relFilePath => {
                                if (relFilePath.endsWith('.part')) {
                                    // Note the unlink is async, but we are not waiting for it.
                                    fs.unlink(path.join(cacheDirectory, relFilePath), (err) => debug("unlink %s %s", relFilePath, err ? "Failed " + err.message : ""));
                                    errs.push({cacheDirectory, relFilePath, err: new Error("found file ending in .part")});
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
                                        errs.push({cacheDirectory, relFilePath, err});
                                        cb2(err);
                                    } else {
                                        this.hashstores[cacheDirectory].put(tablename, multiHash, relFilePath, (err, unusedRes) => {
                                            if (err) { debug("failed to put table:%s key:%s val:%s %s", tablename, multiHash, relFilePath, err.message); cb2(err); } else {
                                                cb2(null, relFilePath)
                                            }
                                        });
                                    }
                                }),
                                {name: "Hashstore", async: true, paralleloptions: {limit: 100, silentwait: true}})
                            .map((relFilePath, cb3) => { if (ipfs && !this.isSpecialFile(relFilePath)) {
                                this.seed({directory: cacheDirectory, relFilePath}, cb3); } else { cb3(); }},
                                {name: "seed", async: true, justReportError: true, paralleloptions: {limit: 0}})
                            .reduce(undefined, undefined, unusedRes => cb1(null));
                    }
                })
            },
          (err, unusedRes) => {
              if (err) {
                  debug("maintenance failed with err = %o", err);
              } else {
                  debug("maintenance completed successfully");
              }
              debug("===== Completed last directory, error summary ==========");
              //TODO make sure catch all errors here, (all should push to errs)
              errs.forEach(e => debug("%s/%s %o", e.cacheDirectory, e.relFilePath, err));
              cb();
          })
    }

    static seed({directory, relFilePath, ipfs}, cb) {
        const pp = relFilePath.split(path.sep);
        DwebTransports.seed( {
            directoryPath: path.join(directory, pp[0]), // e.g. /Volumes/x/archiveorg/<IDENTIFIER>
            fileRelativePath: path.join(...pp.slice(1)),    // e.g. <FILENAME> or thumbs/image001.jpg
            ipfsHash: ipfs,
            urlToFile: [this.httpServer + gateway.urlDownload, relFilePath].join('/'), // Normally http://localhost:4244/arc/archive.org/download/IDENTIFIER/FILE
        }, (unusederr, res) => {
            cb(null, res);
        });
    }

    static isSpecialFile(relFilePath) { // Note special files should match between MirrorFS.isSpecialFile and ArchiveItemPatched.save

        return ["_meta.json", "_extra.json", "_member.json", "_cached.json", "_members.json","_files.json","_extra.json","_reviews.json", ".part", "_related.json", "_playlist.json", "_bookreader.json"].some(ending=>relFilePath.endsWith(ending));
    }
}

exports = module.exports = MirrorFS;
