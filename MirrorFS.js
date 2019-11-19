/* global DwebTransports */
//process.env.NODE_DEBUG="fs";    // Uncomment to test fs
// Node packages
const crypto = require('crypto');
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const canonicaljson = require('@stratumn/canonicaljson');
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
var ReadableStreamClone = require("readable-stream-clone"); // Allow safe duplication of readable-stream

// other packages of ours
const ParallelStream = require('parallel-streams');
const {gateway, ObjectFromEntries} = require("@internetarchive/dweb-archivecontroller/Util.js"); // for Object.fromEntries

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
    digest      Digest (hash) of file to find
    directory:  Absolute path to directory where cache stored, may include symlinks, but not Mac Aliases
    directories: Array of directories to check for caches - note this is a pointer into MirrorConfig's array, changing that will change here as well
    expectsize: If defined, the result must match this size or will be rejected (it comes from metadata)
    existingFilePath:  Something else found the file already passed to save looking for it twice
    file:       Name of file
    filepath:   Absolute path to file, normally must be in "directory"
    format:     Format of result or submitted digest, defaults to 'hex', alternative is 'multihash58'
    httpServer: Server to use for http (for seeding)
    ipfs:       IPFS hash if known
    noCache:    If true will skip reading cache, but will write back to it and not trash it if unable to read file
    preferredStreamTransports:  Array of transport names to use in order of preference for streaming
    relFileDir  Path to directory, typically IDENTIFIER
    relFilePath A path relative to any of the directories, typically IDENTIFIER/FILENAME
    scale       Factor to scale down an image
    sha1:           If defined, the result must match this sha1 or will be rejected (it comes from metadata)
    rotate      Factor to rotate an image
    skipFetchFile:  If true, then dont actually fetch the file (used for debugging)
    noCache:    if set then do not check cache for results
    noStore:    if set then do not store in the cache
    skipNet:    if set then do not try and fetch from the net
    url:        Single url (or in most cases array of urls) to retrieve
    wantBuff:   True if want a buffer of data (not stream)
    wantSize:   Want the size of the data (cached or from net)
    wantStream  The caller wants a stream as the result (the alternative is an object with the results)
    start       The first byte or result to return (default to start of file/result)
    end         The last byte or result to return (default to end of file/result)
     */

    static init({directories, httpServer, preferredStreamTransports=[] }) {
        /**
         * Initialize MirrorFS, should be called before using any other function to tell MirrorFS where to find or get things
         * httpServer:  start of URL of server to tell IPFS to get files from typically localhost
         * See top of this file for other parameters
         */
        // Not a constructor, all methods are static
        this.directories = directories; //note this is a pointer into MirrorConfig's array, changing that will change here as well
        this.httpServer = httpServer;
        this.preferredStreamTransports = preferredStreamTransports; // Order in which to select possible stream transports
        this.hashstores = {}; // Empty - populated lazily by hashstore(dir)
    }

    static setState({directories=undefined}) {
        //Indicate to MirrorFS that state has changed, specifically causes it to set its directories property.
        //directories: [PATH]
        if (directories) this.directories = directories;
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

    static _hashstore(dir) {
        /**
         * returns: hashstore data structure, create if reqd, cache in .hashstores
         */
        if (typeof this.hashstores[dir] === "undefined") {
            this.hashstores[dir] = new HashStore({dir: dir+"/.hashStore."}); // Note trailing period - will see files like <config.directory>/<config.hashstore><tablename>
        }
        return this.hashstores[dir];
    }
    static _rmdir(path, cb) {
        //var path = '/path/to/the/dir';
        // Remove a directory using the system function because can do so recursively
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
    static writeFile({copyDirectory=undefined, relFilePath}, data, cb) {
      /**
       * like fs.writeFile but will mkdir the directory before writing the file
       * checks where to put the file, first choice copyDirectory, 2nd somewhere the item is already stored, 3rd first of config.directories
       */
      // See https://github.com/internetarchive/dweb-mirror/issues/193
      if (!(copyDirectory || MirrorFS.directories.length))
          cb(new Error(`writeFile: Nowhere to write ${relFilePath} to`));
      waterfall([
        cb1 => {
          if (copyDirectory) {
            cb1(null, copyDirectory);
          } else {
            this.checkWhereValidFile(relFilePath.split('/')[0], {},
              (err, res) =>
                cb1(null, err
                ? this.directories[0]  // Didn't find it, use first directory.
                :  path.dirname(res))) ;  //Found a path, return directory its in
          }
        },
        (dir, cb2) => {
          const filepath = path.join(dir, relFilePath);
          this._mkdir(path.dirname(filepath), (err) => cb2(err, filepath));
        },
        (filepath, cb3) => fs.writeFile(filepath, data, cb3)
      ], err => {
          if (err) {
            debug("ERROR: MirrorFS.writeFile failed to write %s %s: %s", copyDirectory, relFilePath, err.message);
          }
          cb(err); // May be null
        });
    }

    static _copyFile(sourcePath, destnPath, cb) {
        /*
        Copy sourcePath to destnPath but create directory first if reqd
         */
        this._mkdir(path.dirname(destnPath), (err) => {
            if (err) {
                debug("ERROR: MirrorFS._copyFile: Cannot mkdir %s: %s",path.dirname(destnPath), err.message);
                cb(err);
            } else {
                fs.copyFile(sourcePath, destnPath, (err) => {
                    if (err) {
                        debug("ERROR: MirrorFS._copyFile: Unable to copy %s to %s: %s", sourcePath, destnPath, err.message);
                        cb(err);
                    } else {
                        cb(null);
                    }
                });
            }
        });
    }
    static _fileopenwrite({relFilePath, cacheDirectory}={}, cb) {
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
                                  debug("ERROR: Failed to mkdir for", filepath, err.message);
                                  cb(err);
                                } else {
                                    fs.open(filepath, 'w', (err, fd) => {
                                        if (err) { // This shouldnt happen, we just checked the cacheDirectory.
                                            debug("ERROR: Failed to open", filepath, "after mkdir");
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

    static checkWhereValidFileRotatedScaled( {bestEffort=false, relFileDir=undefined, file=undefined, scale=undefined, rotate=undefined,
                                                 noCache=undefined, copyDirectory=undefined}, cb) {
        /*
            Look for appropriate cached file such as RELFILEDIR/scale2/rotate4/FILE and return its path if found.

            relFileDir: Item's dir
            file:       File within dir
            scale:      scale wanted at
            rotate:     rotation wanted
            noCache:    Dont check cache for it
            bestEffort: if set, then return the best file we have first looking for larger files, then smaller.
            cb(err, filepath) - Careful, its err,undefined if not found unlike checkWhereValidFile
         */
        const scales = [];
        const idealScale = Math.floor(scale);
        for(let i=idealScale; i>0; i--) { scales.push(i); }  // A = e.g. [ 8...1 ]
        if (bestEffort) { //typically this is the test to do if fails
            for(let i=idealScale+1; i<=32; i++) { scales.push(i); } // A = e.g. [ 9..32 ]
        }
        detectSeries(scales.map(s => `${relFileDir}/scale${s}/rotate${rotate}/${file}`),
            (rel, cb2) => this.checkWhereValidFile(rel, {noCache, copyDirectory}, (err, unusedRes) => cb2(null, !err)), // Find the first place having a file bigger (i.e. smaller 'scale') or same size as
            cb
        )
    }
    static checkWhereValidFile(relFilePath, {existingFilePath=undefined, noCache=false, digest=undefined,
        format=undefined, algorithm=undefined, copyDirectory=undefined}, cb) {
        //TODO follow this up the stack and start passing size to it where possible.
        /*
        See common parameters above
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
                    } else if (!digest) {
                      cb3(true);
                    } else { // Didn't find the file, but have a digest so can look for it cache
                      this._hashstore(cacheDirectory).get(algorithm + ".relfilepath", digest, (err,res) => {
                          relFilePath = res; // poss undefined - saving over relFilePath parameter which is undefined
                          cb3(err || !relFilePath); // Shouldnt be error but fail this waterfall if didn't find hash in this cache.
                      });
                    }
                },
                (cb4) => { // Check file readable
                    // noinspection JSUnresolvedVariable
                    fs.access(path.join(cacheDirectory, relFilePath), fs.constants.R_OK, cb4);
                },
                (cb5) => { // Check its not zero-size
                    const existingFilePath = path.join(cacheDirectory, relFilePath);
                    fs.stat(existingFilePath, (err, stats) => {
                        if (!err && (stats.size === 0)) {
                          err = new Error(`Zero length file at ${existingFilePath} ignoring`);
                          debug("ERROR %s",err.message);
                        }
                        cb5(err);
                    });
                },
                (cb6) => { // if digest, then test its correct
                    if (!digest) {
                        cb6();
                    } else {
                        const filepath = path.join(cacheDirectory, relFilePath);
                        this._streamhash(fs.createReadStream(filepath), {format, algorithm}, (err, actual) => {
                            if (err) debug("Error from streamhash for %s: %s", filepath, err.message); // log as error lost in waterfall
                            if (actual !== digest) {
                              const errmsg = `multihash ${format} ${algorithm} ${digest} doesnt match file ${filepath} which is ${actual} - will delete`;
                              debug(errmsg);
                              err = new Error(errmsg);
                              fs.unlink(filepath, err2 => {
                                if (err2) {
                                  debug(err2.message);  // Log failure to unlinke
                                  err = err2
                                }; // Return most recent error (which will be lost after testing)
                              });
                            }
                            cb6(err); // not err may be null
                        });
                    }
                }
              ], (err, unused) => cb2(null, !err)) // Did the detect find one
            }, (err, res) => {
                // Three possibilities - err (something failed) res (found) !err && !res (not found), but return error on fail anyway
                if (err && (err instanceof Error))
                    cb(err);
                else if (!res)
                    cb (new Error(`${relFilePath} not found in caches`));
                else
                    cb(null, path.join(res, relFilePath)); // relFilePath should have been set by time get here
            });
        }
    }

    static cacheAndOrStream({ relFilePath=undefined,
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
        See Common parameters above.

        Returns a stream from the cache, or the net if start/end unset cache it
        cb(err, s|undefined) if wantStream will call with a stream (see below)

        TypicalUsages:
        in mirroring    wantStream, start,end undefined
        in browsing     wantStream=true, start & end may be set or be set to 0,undefined.

        cb behavior needs explanation !
            If wantStream, then cb will call back as soon as a stream is ready from the net
            If !wantStream, then cb will only call back (with undefined) when the file has been written to disk and the file renamed.
            In particular this means that wantStream=true will not see a callback if one of the errors occurs after the stream is opened.

        Behavior on error if wantStream:
            Handling errors on streams is hard as the stream can open, but then never pass data.
            For this reason the stream is only returned via cb(null, stream) when data starts to be received,
            otherwise an cb(err) allows consumer to take a fallback behavior
        */
        const cacheDirectory = copyDirectory || this.directories[0]; // Where the file should be put if creating it
        let cbCalledOnFirstData = false;
        if (noCache) {
          tryNetThenCache.call(this, cb);
        } else {
          tryCacheThenNet.call(this, cb);
        }
      function tryNetThenCache(cb) {
        _notcached.call(this, (err, s) => {
          if (!err) { // Great - read it
            cb(null, s);
          } else {
            this.checkWhereValidFile(relFilePath, {existingFilePath, noCache: false, digest: sha1, format: 'hex', algorithm: 'sha1', copyDirectory},
              (err, existingFilePath) => {
                if (err) {
                  cb(err); // Not on net, and not in cache either, so fail
                } else {
                  haveExistingFile.call(this, existingFilePath, sha1, cb)
                }
              });
          }
        });
      }

      function tryCacheThenNet(cb) {
        this.checkWhereValidFile(relFilePath, {existingFilePath, noCache, digest: sha1, format: 'hex', algorithm: 'sha1', copyDirectory},
          (err, existingFilePath) => {
            if (err) {  //Doesn't match cache
              // retrieve and cache (will fail if no urls, which is readable as consumer such as AF.cacheOrStream might then find URLS and try again
                _notcached.call(this, cb);
            } else { // sha1 matched, skip fetching, just stream from saved
              haveExistingFile.call(this, existingFilePath, sha1, cb)
            }
          });
      }
        function haveExistingFile(existingFilePath, sha1, cb) {
            if (copyDirectory && !existingFilePath.startsWith(copyDirectory)) {
                // We have the right file, but in the wrong place
                const copyFilePath = path.join(copyDirectory, relFilePath);
                this._copyFile(existingFilePath, copyFilePath , (err) => {
                    if (err) {
                        debug("ERROR: MirrorFS.cacheAndOrStream of %s failed %s", relFilePath, err.message);
                    } else {
                        debug("Copied existing file %sfrom %s to %s", sha1 ? "with matching sha1 " : "", existingFilePath, copyFilePath);
                        callbackEmptyOrDataOrStream(existingFilePath, sha1, cb);
                    }
                })
            } else {
                // Write file and either right place, or we dont care where
                debug("Already cached existing file %s%s %s", sha1 ? "with matching sha1 " : "", existingFilePath);
                callbackEmptyOrDataOrStream(existingFilePath, sha1, cb);
            }
        }
       function callbackEmptyOrData(existingFilePath, cb) {
            if (wantBuff) {
                fs.readFile(existingFilePath, cb); // No encoding specified so cb(err, buffer)
            } else if (wantSize) {
                fs.stat(existingFilePath, (err, stats) => {
                    cb(err, stats && stats.size);
                });
            } else {
                cb();
            }
        }
        function callbackEmptyOrDataOrStream(existingFilePath, sha1, cb) {
            if (wantStream) {
                debug("streaming %s from cache", existingFilePath);
                cb(null, fs.createReadStream(existingFilePath, {start, end}));   // Already cached and want stream - read from file
            } else {
                callbackEmptyOrData(existingFilePath, cb);
            }
        }
        function _cleanupOnFail(filepathTemp, mess, cb) {
            //TODO See https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options re closing the writable on error
          if (filepathTemp) {
            fs.unlink(filepathTemp, (err) => {
              if (err) { debug("ERROR: Can't delete %s", filepathTemp); } // Shouldnt happen
            });
          }
          if (!wantStream || !cbCalledOnFirstData) cb(new Error(mess)); // Cant send err if wantStream && cbCalledOnFirstData as already done it

        }
      function _closeWriteToCache({hashstreamActual, writable, filepathTemp, newFilePath}, cb) {
        // noinspection JSCheckFunctionSignatures
        // The hashstream is upstream so should have flushed first.
        const hexhash = hashstreamActual.toString('hex');
        // noinspection EqualityComparisonWithCoercionJS
        if ((expectsize && (expectsize != writable.bytesWritten)) || ((typeof sha1 !== "undefined") && (hexhash !== sha1))) { // Intentionally != as metadata is a string
          // noinspection JSUnresolvedVariable
          const message = `File ${debugname} size=${writable.bytesWritten} sha1=${hexhash} doesnt match expected ${expectsize} ${sha1}, deleting`;
          debug("ERROR %s", message);
          _cleanupOnFail(filepathTemp, message, cb);
        } else {
          fs.rename(filepathTemp, newFilePath, (err) => {
            if (err) {
              debug('ERROR: Failed to rename %s to %s', filepathTemp, newFilePath); // Shouldnt happen
              if (!wantStream) cb(err); // If wantStream then already called cb
            } else {
              this._hashstore(cacheDirectory).put("sha1.relfilepath", multihash58sha1(hashstreamActual), relFilePath, (err) => {
                debug(`Closed ${debugname} size=${writable.bytesWritten} %s`, err ? err.message : "");
                this.seed({
                  relFilePath,
                  directory: cacheDirectory
                }, (unusedErr, unusedRes) => {
                }); // Seed to IPFS, WebTorrent etc
                //Ignore err & res, its ok to fail to seed and will be logged inside seed()
                // Also - its running background, we are not making caller wait for it to complete
                // noinspection JSUnresolvedVariable
                if (!wantStream) {  // If wantStream then already called cb, otherwise cb signifies file is written
                  callbackEmptyOrData(newFilePath, cb);
                }
              });
            }
          })
        }
      }

      function _notcached(cb) {
            /*
            Four possibilities - wantstream &&|| partialrange
            ws&p: net>stream; ws&!p: net>disk, net>stream; !ws&p; unsupported, though could be in callbackEmptyOrData; !ws&!p caching
             */
            if (skipFetchFile) {
              debug("skipFetchFile set (testing) would fetch: %s", debugname);
              cb();
            } else if (!urls || (Array.isArray(urls) && !urls.length) || skipNet) {
              cb(new Error("No urls or skipNet specified to cacheAndOrStream")); // This might be totally normal, if looking for only local
            } else {
                const partial = (start>0 || end<Infinity);
                console.assert(wantStream || !partial,"ArchiveFile.cacheAndOrStream - it makes no sense to request a partial fetch without a stream output");
                if (partial) {  // start or end undefined dont satisfy this test
                    debug("Not caching %s because specifying a range %s:%s and wantStream", debugname, start, end);
                    DwebTransports.createReadStream(urls, {start, end, preferredTransports: this.preferredStreamTransports}, cb); // Dont cache a byte range, just return it
                } else {
                    DwebTransports.createReadStream(urls, {start, end, preferredTransports: this.preferredStreamTransports, silentFinalError: true}, (err, s) => {
                        //Returns a promise, but not waiting for it
                        // For HTTP s is result of piping .body from fetch (a stream) to a through stream
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
                                    const hashstream = this._hashstream();
                                    const writable = fs.createWriteStream(null, {fd: fd});
                                    // Note at this point file is neither finished, nor closed, its a stream open for writing.
                                    writable.on('close', () => {
                                      //fs.close(fd); Should be auto closed when stream to it finishes
                                      _closeWriteToCache.call(this, {hashstreamActual: hashstream.actual, writable, newFilePath, filepathTemp}, cb)
                                    });
                                    try {
                                        const s1 = new ReadableStreamClone(s); // Will be stream to file
                                        const s2 = new ReadableStreamClone(s); // Will be stream for consumer
                                        //TODO consider only opening hashstream and writable if the stream starts (i.e. 'readable')
                                        s1.pipe(hashstream).pipe(writable);   // Pipe the stream from the HTTP or Webtorrent read etc to the stream to the file.
                                        s1.once('error', (err) => {
                                            // Dont report error - its already reported
                                            s1.destroy(); // Dont pass error down as will get unhandled error message unless implement on hashstream
                                        })
                                        s2.once('error', (err) => {
                                          const message = `Failed to read ${urls} from net err=${err.message}`;
                                          debug("ERROR %s", message);
                                          _cleanupOnFail(filepathTemp, message, cb);
                                          s2.destroy(); // Dont pass error down as will get unhandled error message unless implement on hashstream
                                        })
                                        s2.once('readable', () => {
                                          // If !wantStream the callback happens when the file is completely read
                                          // If !wantStream the callback happens when the file is completely read
                                          if (wantStream && !cbCalledOnFirstData)  { cbCalledOnFirstData = true; debug('XXX'); cb(null, s2); }
                                        })
                                    } catch(err) {
                                        debug('ERROR: ArchiveFilePatched.cacheAndOrStream failed %o',err);
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

    static _readDirRecursive(basedir, relpath, cb) {
        fs.readdir(path.join(basedir, relpath), (err, files) => {
            if (err) {  // Probably a directory
                cb(null, [relpath])
            } else {
                map( files.map(f => path.join(relpath, f)),
                  (relpathfile, cb1) => this._readDirRecursive(basedir, relpathfile, cb1),
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
                  .map((identifier, cb) => this._readDirRecursive(cacheDirectory, identifier, cb),  // Stream of arrays - it does it recursively
                        {name: "Read files dirs", async: true, paralleloptions: {limit:100, silentwait: true}})                                         //  [ /foo/mirrored/<item>/<file>* ]
                    // Stream of arrays of [IDENTIFIER/FILENAME or IDENTIFIER/SUBDIRNAME/FILENAME] to whatever depth required
                    .flatten({name: "Flatten arrays"})                                                  //  /foo/mirrored/<item>/<file>
                    // Stream of FILENAME (unlikely) and IDENTIFIER/FILENAME and IDENTIFIER/SUBDIRNAME/FILENAME
                    // Flatten once more to handle subdirs
                    .pipe(s);
        });
        return s;
    }

  static _maintainCachedItem({identifier=undefined, cacheDirectory=undefined}, cb) {
    //debug("maintaining %s", identifier);
    fs.readFile([cacheDirectory, identifier, `${identifier}_meta.json`].join('/'), (err, jsonstring) => {
      if (!err) {
        const aiMeta = canonicaljson.parse(jsonstring);
        if (aiMeta.licenseurl) {
          debug("maintaining %s licenceurl=%s", identifier, aiMeta.licenseurl);
        } else {
          //debug("maintaining %s", identifier);
        }
      }
      cb();
    });
  }

  static _arrayOfIdentifiers(dir, cb) {
   // Return array of items in a cacheDirectory
    fs.readdir(dir, (err, files) => {
      if (err) {
        debug("Failed to read directory %s", cacheDirectory);
        cb(err);
      } else {
        cb(null, files.filter(f => !f.startsWith(".")));
      }
    });
  }

  static _maintainCacheDirectory(cacheDirectory, cb) {
    // UNUSED SO FAR SHOULD BE PART OF TODO REBUILD MAINTENANCE W/O PARALLELSTREAMS
    debug("maintaining: %s", cacheDirectory);
    this._arrayOfIdentifiers(cacheDirectory, (err, identifiers) => {
      each(identifiers,
        (identifier, cb) => this._maintainCachedItem({identifier, cacheDirectory}, cb),
        (err) => {
          if (err) debug("maintainCacheDirectory failed %o", err);
          cb(err);
        })
    })
  }

  static maintenance({cacheDirectories = undefined}, cb) {
    debug("Maintaining File Sytem");
    each(cacheDirectories,
      (cacheDirectory, cb) => this._maintainCacheDirectory(cacheDirectory, cb),
      (err) => {
        if (err) debug("maintenance failed %o", err);
        cb(err);
      });
  }

  //maybe redo to use async.each etc
    static maintenanceOLD({cacheDirectories = undefined, algorithm = 'sha1', ipfs = false}, cb) {
        /*
        Perform maintenance on the system.
        Clear out old hashes and load all the hashes in cacheDirectories or config.directories into hashstores table='<algorithm>.filepath'.
        Make sure all applicable files are in IPFS.
        Delete any .part files (typically these come from a server crash while something is partially streamed in)

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
                this._hashstore(cacheDirectory).destroy(tablename, (err, unusedRes)=> {
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
                                        this._hashstore(cacheDirectory).put(tablename, multiHash, relFilePath, (err, unusedRes) => {
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
            urlToFile: [this.httpServer + "/download", relFilePath].join('/'), // Normally http://localhost:4244/download/IDENTIFIER/FILE
        }, (unusederr, res) => {
            cb(null, res);
        });
    }

    static isSpecialFile(relFilePath) { // Note special files should match between MirrorFS.isSpecialFile and ArchiveItemPatched.save
      // SEE-OTHER-ADD-METADATA-API-TOP-LEVEL in dweb-mirror and dweb-archivecontroller
      return ["_meta.json", "_extra.json", "_member.json", "_cached.json", "_members.json","_files.json","_extra.json","_reviews.json", ".part", "_related.json", "_playlist.json", "_bookreader.json", "_speech_vs_music_asr"].some(ending=>relFilePath.endsWith(ending));
    }
}

exports = module.exports = MirrorFS;
