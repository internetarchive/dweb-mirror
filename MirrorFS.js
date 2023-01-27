/* global DwebTransports */
/* eslint-disable no-use-before-define,no-console,no-unused-vars */
// process.env.NODE_DEBUG="fs";    // Uncomment to test fs
// Node packages
const crypto = require('crypto');
const fs = require('fs'); // See https://nodejs.org/api/fs.html
const path = require('path');
const canonicaljson = require('@stratumn/canonicaljson');
// noinspection JSUnresolvedVariable
// readable-stream isn't needed since MirrorFS only runs in node, which already has require('stream').Transform
// so dependency removed. If needed, the code known to work is v3.4.0, v4.3.0 may have problems as
// reflects breaking changes in later versions of node.
const Transform = require('stream').Transform; // || require('readable-stream').Transform;
const debug = require('debug')('dweb-mirror:MirrorFS');
const multihashes = require('multihashes');
const detect = require('async/detect');
const detectSeries = require('async/detectSeries');
const each = require('async/each');
const waterfall = require('async/waterfall');
const map = require('async/map');
// noinspection ES6ConvertVarToLetConst
const exec = require('child_process').exec;
const ReadableStreamClone = require('readable-stream-clone'); // Allow safe duplication of readable-stream

// other packages of ours
const { routed } = require('@internetarchive/dweb-archivecontroller'); // for Object.fromEntries

// other packages in this repo - note it is intentional that this does not depend on config
const HashStore = require('./HashStore');

function multihash58sha1(buf) {
  return multihashes.toB58String(multihashes.encode(buf, 'sha1'));
}

/**
    Utility subclass that knows about the file system.

    All the methods of MirrorFS are static

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
    skipFetchFile:  If true, then do not actually fetch the file (used for debugging)
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

class MirrorFS {
  /**
   * Initialize MirrorFS, should be called before using any other function to tell MirrorFS where to find or get things
   * httpServer:  start of URL of server to tell IPFS to get files from typically localhost
   * See top of this file for other parameters
   */
  static init({ directories, httpServer, preferredStreamTransports = [] }) {
    // Not a constructor, all methods are static
    this.directories = directories; // note this is a pointer into MirrorConfig's array, changing that will change here as well
    this.httpServer = httpServer;
    this.preferredStreamTransports = preferredStreamTransports; // Order in which to select possible stream transports
    this.hashstores = {}; // Empty - populated lazily by hashstore(dir)
  }

  static setState({ directories = undefined }) {
    // Indicate to MirrorFS that state has changed, specifically causes it to set it's directories property.
    // directories: [PATH]
    if (directories) this.directories = directories;
  }

  static _mkdir(dirname, cb) {
    /* Recursively make a directory
        dirname: String representing file path
        cb(err):     Call back, with error if unable to complete
        */
    fs.mkdir(dirname, err => {
      if (err && !(err.code === 'EEXIST')) {
        if (err.code === 'ENOENT') { // missing parent dir
          const parentdir = path.dirname(dirname);
          MirrorFS._mkdir(parentdir, err2 => {
            if (err2 && !(err2.code === 'EEXIST')) { // it is quite possible (likely) two attempts to create same directory at same time when loading many files in same dir
              cb(err2);
            } else { // Do not know how to tackle error from _mkdir, note that EEXIST would be odd since ENOENT implies it does not exist
              fs.mkdir(dirname, err1 => {
                if (err1 && !(err1.code === 'EEXIST')) { cb(err1); } else { cb(null); }
              });
            }
          });
        } else {
          cb(err); // Throw any other error
        }
      } else {
        cb();
      }
    });
  }

  static _hashstore(dir) {
    /**
         * returns: hashstore data structure, create if reqd, cache in .hashstores
         */
    if (typeof this.hashstores[dir] === 'undefined') {
      this.hashstores[dir] = new HashStore({ dir: dir + '/.hashStore.' }); // Note trailing period - will see files like <config.directory>/<config.hashstore><tablename>
    }
    return this.hashstores[dir];
  }

  static _rmdir(dirpath, cb) {
    // var dirpath = '/path/to/the/dir';
    // Remove a directory using the system function because can do so recursively
    exec('rm -r ' + dirpath, (err, unusedstdout, unusedstderr) => {
      if (err) {
        debug('failed to rm -r %s', dirpath);
        cb(err);
      } else {
        cb(null);
      }
    });
  }

  /**
   * Synchronous calculation of hash
   * @param str         string to get the hash of
   * @param options  { algorithm, format }
   * @returns {string}
   */
  /*
  // This does not appear to be used
  static quickhash(str, options = {}) {
    const hash = crypto.createHash(options.algorithm || 'sha1').update(str);
    return options.format === 'multihash58' ? multihash58sha1(hash.digest()) : hash.digest('hex');
  }
  */
  static _streamhash(s, options = {}, cb) {
    /*  Calculate hash on a stream, which it consumes
            algorithm: Hash algorithm to be used, (only tested with sha1)
            cb will be called once, when stream is done
        */
    if (typeof options === 'function') { cb = options; options = {}; }
    const algorithm = options.algorithm || 'sha1';
    console.assert(options.format, 'Format of digest - should be defined as multihash58|hex');
    const hash = crypto.createHash(algorithm);
    let errState = null;
    return s
      .on('error', err => { if (!errState) cb(errState = err); }) // Just send errs once
      .on('data', chunk => { if (!errState) hash.update(chunk); })
      .on('end', () => { if (!errState) cb(null, options.format === 'multihash58' ? multihash58sha1(hash.digest()) : hash.digest('hex')); });
  }

  /*
  static _hashstream_TransformStream({algorithm = 'sha1' } = {}) {
    // Had a problem with some libraries -e.g. fetch now returning a ReadableStream instead of a ReadStream (like node)
    // This was part of a solution to the problem, this part worked but overall solution failed, keeping in case try again
    // new kinds of ReadableStreams https://developer.mozilla.org/en-US/docs/Web/API/TransformStream/TransformStream
    const hash = crypto.createHash(algorithm);
    const stream = new TransformStream({
      start() {}, // required
      async transform(chunk, controller) {
        hash.update(chunk);
        controller.enqueue(chunk);
      },
      flush() {
        stream.actual = hash.digest(); // digest('hex').toLowerCase().trim() is what can compare with sha1 in metadata
      }
    })
    return stream;
  }
  */
  static _hashstream({ algorithm = 'sha1' } = {}) {
    /*
        Return a hashstream which can be piped through, it stores the digest of the stream in ".actual" after it is ._flush is called
        Note this is a node style transform stream, not a TransformStream as in https://developer.mozilla.org/en-US/docs/Web/API/TransformStream
    */
    const hash = crypto.createHash(algorithm);
    const stream = new Transform();
    stream._transform = function (chunk, encoding, cb) {
      hash.update(chunk);
      stream.push(chunk);
      cb();
    };
    stream._flush = function (cb) {
      stream.actual = hash.digest(); // digest('hex').toLowerCase().trim() is what can compare with sha1 in metadata
      cb(null);
    };
    return stream;
  }

  /**
   * Look for a path in one of the directories, and return (via fs.readFile)
   * @param relFilePath
   * @param copyDirectory
   * @param cb
   */
  static readFile(relFilePath, { copyDirectory }, cb) {
    this.checkWhereValidFile(relFilePath, { copyDirectory }, (err, existingFilePath) => {
      if (err) cb(err);
      else fs.readFile(existingFilePath, cb);
    });
  }

  /**
   * Like fs.writeFile but will mkdir the directory in copyDirectory or first configured directory before writing the file
   * @param copyDirectory
   * @param relFilePath
   * @param data  anything that fs.writeFile accepts
   * @param cb
   */
  static writeFile({ copyDirectory = undefined, relFilePath }, data, cb) {
    /**
     * like fs.writeFile but will mkdir the directory before writing the file
     * checks where to put the file, first choice copyDirectory, 2nd somewhere the item is already stored, 3rd first of config.directories
     */
    // See https://github.com/internetarchive/dweb-mirror/issues/193
    if (!(copyDirectory || MirrorFS.directories.length)) {
      cb(new Error(`writeFile: Nowhere to write ${relFilePath} to`));
    } else {
      waterfall([
        cb1 => {
          if (copyDirectory) {
            cb1(null, copyDirectory);
          } else {
            this.checkWhereValidFile(
              relFilePath.split('/')[0],
              {},
              (err, res) => cb1(null, err
                ? this.directories[0] // Didn't find it, use first directory.
                : path.dirname(res))
            ); // Found a path, return directory it is in
          }
        },
        (dir, cb2) => {
          const filepath = path.join(dir, relFilePath);
          this._mkdir(path.dirname(filepath), (err) => cb2(err, filepath));
        },
        (filepath, cb3) => fs.writeFile(filepath, data, cb3)
      ], err => {
        if (err) {
          debug('ERROR: MirrorFS.writeFile failed to write %s %s: %s', copyDirectory, relFilePath, err.message);
        }
        cb(err); // May be null
      });
    }
  }

  static _copyFile(sourcePath, destnPath, cb) {
    /*
        Copy sourcePath to destnPath but create directory first if reqd
         */
    this._mkdir(path.dirname(destnPath), (err) => {
      if (err) {
        debug('ERROR: MirrorFS._copyFile: Cannot mkdir %s: %s', path.dirname(destnPath), err.message);
        cb(err);
      } else {
        fs.copyFile(sourcePath, destnPath, (err1) => {
          if (err1) {
            debug('ERROR: MirrorFS._copyFile: Unable to copy %s to %s: %s', sourcePath, destnPath, err1.message);
            cb(err1);
          } else {
            cb(null);
          }
        });
      }
    });
  }

  static _fileopenwrite({ relFilePath, cacheDirectory } = {}, cb) {
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
          if (err.code === 'ENOENT') { // Does not exist, which means the cacheDirectory or subdir -
            // noinspection JSUnusedLocalSymbols
            fs.stat(cacheDirectory, (err1, unusedStats) => {
              if (err1) throw new Error(`The root directory for mirroring: ${cacheDirectory} is missing - please create by hand`);
              debug('MirrorFS creating directory: %s', path.dirname(filepath));
              MirrorFS._mkdir(path.dirname(filepath), err3 => {
                if (err3) {
                  debug('ERROR: Failed to mkdir for', filepath, err.message);
                  cb(err3);
                } else {
                  fs.open(filepath, 'w', (err2, fd1) => {
                    if (err2) { // This should not happen, we just checked the cacheDirectory.
                      debug('ERROR: Failed to open', filepath, 'after mkdir');
                      cb(err2);
                    } else {
                      cb(null, fd1);
                    }
                  });
                }
              });
            });
          } else {
            debug('Failed to open %s for writing:', filepath, err.message);
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

  /**
     * Look for appropriate cached file such as RELFILEDIR/scale2/rotate4/FILE and return it is path if found.
     * @param bestEffort  if set, then return the best file we have first looking for larger files, then smaller.
     * @param relFileDir  Item's dir
     * @param file        File within dir
     * @param scale       scale wanted at
     * @param rotate      rotation wanted
     * @param noCache     Do not check cache for it
     * @param copyDirectory
     * @param cb(err, filepath) Careful, it is err,undefined if not found unlike checkWhereValidFile
     */
  static checkWhereValidFileRotatedScaled({
    bestEffort = false, relFileDir = undefined, file = undefined, scale = undefined, rotate = undefined,
    noCache = undefined, copyDirectory = undefined
  }, cb) {
    const scales = [];
    const idealScale = Math.floor(scale);
    // See also ArchiveItemPatched.pageParms
    for (let i = idealScale; i > 0; i--) { scales.push(i); } // A = e.g. [ 8...1 ]
    if (bestEffort) { // typically this is the test to do if fails
      for (let i = idealScale + 1; i <= 32; i++) { scales.push(i); } // A = e.g. [ 9..32 ]
    }
    detectSeries(
      scales.map(s => `${relFileDir}/scale${s}/rotate${rotate}/${file}`),
      (rel, cb2) => this.checkWhereValidFile(rel, { noCache, copyDirectory }, (err, unusedRes) => cb2(null, !err)), // Find the first place having a file bigger (i.e. smaller 'scale') or same size as
      cb
    );
  }

  /**
     * Checks if file or digest exists in one of the cache Directories.
     *
     * Note - either relFilePath or digest/format/algorithm can be omitted,
     * If relFilePath && !digest it just checks the cache directories
     * If digest && !relFilePath it will try and locate file in hashstores
     * if relPath && digest the hash will be recalculated and checked.
     *
     * @param relFilePath
     * @param existingFilePath
     * @param noCache
     * @param digest
     * @param format
     * @param algorithm
     * @param copyDirectory
     * @param cb(err, filepath)
     */
  static checkWhereValidFile(relFilePath, {
    existingFilePath = undefined, noCache = false, digest = undefined,
    format = undefined, algorithm = undefined, copyDirectory = undefined
  }, cb) {
    // TODO follow this up the stack and start passing size to it where possible.
    /*
        See common parameters above
        Note - either relFilePath or digest/format/algorithm can be omitted,
        If relFilePath && !digest it just checks the cache directories
        If digest && !relFilePath it will try and locate file in hashstores
        if relPath && digest the hash will be recalculated and checked.
        cb(err, filepath)
         */
    if (noCache && !digest) {
      cb(new Error('no-cache')); // Do not use cached version
    } else if (existingFilePath) {
      cb(null, existingFilePath); // Got it
    } else {
      detect(
        copyDirectory ? [].concat(copyDirectory, this.directories) : this.directories, // If copyDirectory specified then look there first whether or not it is in this.directories
        (cacheDirectory, cb2) => { // Looking for first success
          waterfall([
            (cb3) => { // if no relFilePath check the hashstore
              if (relFilePath) {
                cb3(null);
              } else if (!digest) {
                cb3(true);
              } else { // Didn't find the file, but have a digest so can look for it cache
                this._hashstore(cacheDirectory).get(algorithm + '.relfilepath', digest, (err, res) => {
                  relFilePath = res; // poss undefined - saving over relFilePath parameter which is undefined
                  cb3(err || !relFilePath); // Should not be error but fail this waterfall if did not find hash in this cache.
                });
              }
            },
            (cb4) => { // Check file readable
              // noinspection JSUnresolvedVariable
              fs.access(path.join(cacheDirectory, relFilePath), fs.constants.R_OK, cb4);
            },
            (cb5) => { // Check it is not zero-size
              const existingFilePath1 = path.join(cacheDirectory, relFilePath);
              fs.stat(existingFilePath1, (err, stats) => {
                if (!err && (stats.size === 0)) {
                  err = new Error(`Zero length file at ${existingFilePath1} ignoring`);
                  debug('ERROR %s', err.message);
                }
                cb5(err);
              });
            },
            (cb6) => { // if digest, then test it is correct
              if (!digest) {
                cb6();
              } else {
                const filepath = path.join(cacheDirectory, relFilePath);
                this._streamhash(fs.createReadStream(filepath), { format, algorithm }, (err, actual) => {
                  if (err) debug('Error from streamhash for %s: %s', filepath, err.message); // log as error lost in waterfall
                  if (actual !== digest) {
                    const errmsg = `multihash ${format} ${algorithm} ${digest} doesnt match file ${filepath} which is ${actual} - will delete`;
                    debug(errmsg);
                    err = new Error(errmsg);
                    fs.unlink(filepath, err2 => {
                      if (err2) {
                        debug(err2.message); // Log failure to unlink
                        err = err2;
                      } // Return most recent error (which will be lost after testing)
                    });
                  }
                  cb6(err); // not err may be null
                });
              }
            }
          ], (err, unused) => cb2(null, !err)); // Did the detect find one
        },
        (err, res) => {
          // Three possibilities - err (something failed) res (found) !err && !res (not found), but return error on fail anyway
          if (err && (err instanceof Error)) cb(err);
          else if (!res) cb(new Error(`${relFilePath} not found in caches`));
          else cb(null, path.join(res, relFilePath)); // relFilePath should have been set by time get here
        }
      );
    }
  }

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
       otherwise a cb(err) allows consumer to take a fallback behavior
   */
  static cacheAndOrStream(
    {
      relFilePath = undefined,
      existingFilePath = undefined,
      debugname = 'UNDEFINED',
      urls = undefined,
      expectsize = undefined,
      sha1 = undefined,
      // ipfs = undefined, // unused
      skipFetchFile = false,
      wantStream = false,
      wantBuff = false,
      wantSize = false,
      noCache = false,
      skipNet = false,
      start = 0,
      end = undefined,
      copyDirectory = undefined
    } = {},
    cb
  ) {
    const cacheDirectory = copyDirectory || this.directories[0]; // Where the file should be put if creating it
    let cbCalledOnFirstData = false;
    if (noCache) {
      tryNetThenCache.call(this, cb);
    } else {
      tryCacheThenNet.call(this, cb);
    }
    function tryNetThenCache(cb1) {
      _notcached.call(this, (err, s) => {
        if (!err) { // Great - read it
          cb1(null, s);
        } else {
          this.checkWhereValidFile(
            relFilePath,
            {
              existingFilePath, noCache: false, digest: sha1, format: 'hex', algorithm: 'sha1', copyDirectory
            },
            (err1, existingFilePath1) => {
              if (err1) {
                cb1(err1); // Not on net, and not in cache either, so fail
              } else {
                haveExistingFile.call(this, existingFilePath1, sha1, cb1);
              }
            }
          );
        }
      });
    }

    function tryCacheThenNet(cb1) {
      this.checkWhereValidFile(
        relFilePath,
        {
          existingFilePath, noCache, digest: sha1, format: 'hex', algorithm: 'sha1', copyDirectory
        },
        (err, existingFilePath1) => {
          if (err) { // Doesn't match cache
          // retrieve and cache (will fail if no urls, which is readable as consumer such as AF.cacheOrStream might then find URLS and try again
            _notcached.call(this, cb1);
          } else { // sha1 matched, skip fetching, just stream from saved
            haveExistingFile.call(this, existingFilePath1, sha1, cb1);
          }
        }
      );
    }
    function haveExistingFile(existingFilePath1, sha11, cb1) {
      if (copyDirectory && !existingFilePath1.startsWith(copyDirectory)) {
        // We have the right file, but in the wrong place
        const copyFilePath = path.join(copyDirectory, relFilePath);
        this._copyFile(existingFilePath1, copyFilePath, (err) => {
          if (err) {
            debug('ERROR: MirrorFS.cacheAndOrStream of %s failed %s', relFilePath, err.message);
          } else {
            debug('Copied existing file %sfrom %s to %s', sha11 ? 'with matching sha1 ' : '', existingFilePath1, copyFilePath);
            callbackEmptyOrDataOrStream(existingFilePath1, sha11, cb1);
          }
        });
      } else {
        // Write file and either right place, or we do not care where
        debug('Already cached existing file %s%s %s', sha11 ? 'with matching sha1 ' : '', existingFilePath1);
        callbackEmptyOrDataOrStream(existingFilePath1, sha11, cb1);
      }
    }
    function callbackEmptyOrData(existingFilePath1, cb1) {
      if (wantBuff) {
        fs.readFile(existingFilePath1, cb1); // No encoding specified so cb(err, buffer)
      } else if (wantSize) {
        fs.stat(existingFilePath1, (err, stats) => {
          cb1(err, stats && stats.size);
        });
      } else {
        cb1();
      }
    }
    function callbackEmptyOrDataOrStream(existingFilePath1, sha11, cb1) {
      if (wantStream) {
        debug('streaming %s from cache', existingFilePath1);
        cb1(null, fs.createReadStream(existingFilePath1, { start, end })); // Already cached and want stream - read from file
      } else {
        callbackEmptyOrData(existingFilePath1, cb1);
      }
    }
    function _cleanupOnFail(filepathTemp, mess, cb1) {
      // TODO See https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options re closing the writable on error
      if (filepathTemp) {
        fs.unlink(filepathTemp, (err) => {
          if (err) { debug("ERROR: Can't delete %s", filepathTemp); } // Should not happen
        });
      }
      if (!wantStream || !cbCalledOnFirstData) cb1(new Error(mess)); // Cant send err if wantStream && cbCalledOnFirstData as already done it
    }

    function _closeWriteToCache({
      hashstreamActual, writable, filepathTemp, newFilePath
    }, cb1) {
      // The hashstream is upstream so should have flushed first.
      // noinspection JSCheckFunctionSignatures
      const hexhash = hashstreamActual.toString('hex');
      // noinspection EqualityComparisonWithCoercionJS
      // eslint-disable-next-line eqeqeq
      if ((expectsize && (expectsize != writable.bytesWritten)) || ((typeof sha1 !== 'undefined') && (hexhash !== sha1))) { // Intentionally != as metadata is a string
        // noinspection JSUnresolvedVariable
        const message = `File ${debugname} size=${writable.bytesWritten} sha1=${hexhash} doesnt match expected ${expectsize} ${sha1}, deleting`;
        debug('ERROR %s', message);
        _cleanupOnFail(filepathTemp, message, cb1);
      } else {
        fs.rename(filepathTemp, newFilePath, (err) => {
          if (err) {
            debug('ERROR: Failed to rename %s to %s', filepathTemp, newFilePath); // Should not happen
            if (!wantStream) cb1(err); // If wantStream then already called cb1
          } else {
            this._hashstore(cacheDirectory).put('sha1.relfilepath', multihash58sha1(hashstreamActual), relFilePath, (err1) => {
              debug(`Closed ${debugname} size=${writable.bytesWritten} %s`, err1 ? err1.message : '');
              this.seed({
                relFilePath,
                directory: cacheDirectory
              }, (unusedErr, unusedRes) => {
              }); // Seed to IPFS, WebTorrent etc
              // Ignore err1 & res, it is ok to fail to seed and will be logged inside seed()
              // Also - it is running background, we are not making caller wait for it to complete
              // noinspection JSUnresolvedVariable
              if (!wantStream) { // If wantStream then already called cb1, otherwise cb1 signifies file is written
                callbackEmptyOrData(newFilePath, cb1);
              }
            });
          }
        });
      }
    }

    function _notcached(cb1) {
      /*
            Four possibilities - wantstream &&|| partialrange
            ws&p: net>stream; ws&!p: net>disk, net>stream; !ws&p; unsupported, though could be in callbackEmptyOrData; !ws&!p caching
             */
      const routedUrls = routed(urls);
      if (skipFetchFile) {
        debug('skipFetchFile set (testing) would fetch: %s', debugname);
        cb1();
      } else if (!routedUrls.length || skipNet) {
        cb1(new Error('No urls or skipNet specified to cacheAndOrStream')); // This might be totally normal, if looking for only local
      } else {
        const partial = (start > 0 || end < Infinity);
        console.assert(wantStream || !partial, 'ArchiveFile.cacheAndOrStream - it makes no sense to request a partial fetch without a stream output');
        if (partial) { // start or end undefined do not satisfy this test
          debug('Not caching %s because specifying a range %s:%s and wantStream', debugname, start, end);
          DwebTransports.createReadStream(routedUrls, { start, end, preferredTransports: this.preferredStreamTransports }, cb1); // Do not cache a byte range, just return it
        } else {
          DwebTransports.createReadStream(routedUrls, {
            start, end, preferredTransports: this.preferredStreamTransports, silentFinalError: true
          }, (err, s) => {
            // Returns a promise, but not waiting for it
            // For HTTP s is result of piping .body from fetch (a stream) to a through stream
            if (err) {
              debug('cacheAndOrStream had error reading', debugname, err.message);
              cb1(err); // Note if you do not want to trigger an error when used in streams, then set justReportError=true in stream
              // Do not try and write it
            } else if (!cacheDirectory) {
              // Note - hard to see how this makes sense if !wantStream
              if (!wantStream) {
                cb1(new Error('No Cache Directory, do not want a stream so fail in MirrorFScacheAndOrStream'));
              } else {
                debug('WARNING: No Cache Directory but still returning stream');
                if (wantStream && !cbCalledOnFirstData) {
                  cbCalledOnFirstData = true;
                  cb1(null, s);
                }
              }
            } else {
              // Now create a stream to the file
              const newFilePath = path.join(cacheDirectory, relFilePath);
              const relFilePathTemp = relFilePath + '.part';
              const filepathTemp = path.join(cacheDirectory, relFilePathTemp);

              MirrorFS._fileopenwrite({ relFilePath: relFilePathTemp, cacheDirectory }, (err1, fd) => { // Will make directory if reqd
                if (err1) {
                  debug('ERROR MirrorFS.cacheAndOrStream: Unable to write to %s: %s', filepathTemp, err1.message);
                  cb1(err1);
                } else {
                  // fd is the file descriptor of the newly opened file;
                  const hashstream = this._hashstream();
                  const writable = fs.createWriteStream(null, { fd });
                  // Note at this point file is neither finished, nor closed, it is a stream open for writing.
                  writable.on('close', () => {
                    // fs.close(fd); Should be auto closed when stream to it finishes
                    _closeWriteToCache.call(this, {
                      hashstreamActual: hashstream.actual,
                      writable,
                      newFilePath,
                      filepathTemp
                    }, cb1);
                  });
                  try {
                    const s1 = new ReadableStreamClone(s); // Will be stream to file
                    const s2 = new ReadableStreamClone(s); // Will be stream for consumer
                    // TODO consider only opening hashstream and writable if the stream starts (i.e. 'readable')
                    s1.pipe(hashstream).pipe(writable); // Pipe the stream from the HTTP or Webtorrent read etc to the stream to the file.
                    s1.once('error', (unusederr) => {
                      // Do not report error - it is already reported
                      s1.destroy(); // Do not pass error down as will get unhandled error message unless implement on hashstream
                    });
                    s2.once('error', (err2) => {
                      const message = `Failed to read ${routedUrls} from net err=${err2.message}`;
                      debug('ERROR %s', message);
                      _cleanupOnFail(filepathTemp, message, cb1);
                      s2.destroy(); // Do not pass error down as will get unhandled error message unless implement on hashstream
                    });
                    s2.once('readable', () => {
                      // If !wantStream the callback happens when the file is completely read
                      // If !wantStream the callback happens when the file is completely read
                      if (wantStream && !cbCalledOnFirstData) {
                        cbCalledOnFirstData = true;
                        cb1(null, s2);
                      }
                    });
                  } catch (err2) {
                    debug('ERROR: ArchiveFilePatched.cacheAndOrStream failed %o', err2);
                    if (wantStream) cb1(err2);
                  }
                }
              });
            }
          });
        }
      }
    }
  }

  static _readDirRecursive(basedir, relpath, cb) {
    fs.readdir(path.join(basedir, relpath), (err, files) => {
      if (err) { // Probably a directory
        cb(null, [relpath]);
      } else {
        map(
          files.map(f => path.join(relpath, f)),
          (relpathfile, cb1) => this._readDirRecursive(basedir, relpathfile, cb1),
          (err3, res) => { // res = [ [ ]* ]
            if (err3) {
              cb(err3);
            } else {
              cb(null, [].concat(...res)); // Flatten and return array via cb
            }
          }
        );
      }
    });
  }

  static _maintainCachedItem({ identifier = undefined, cacheDirectory = undefined }, cb) {
    // debug("maintaining %s", identifier);
    fs.readFile([cacheDirectory, identifier, `${identifier}_meta.json`].join('/'), (err, jsonstring) => {
      if (!err) {
        const aiMeta = canonicaljson.parse(jsonstring);
        if (aiMeta.licenseurl) {
          debug('maintaining %s licenceurl=%s', identifier, aiMeta.licenseurl);
        } else {
          // debug("maintaining %s", identifier);
        }
      }
      cb();
    });
  }

  static _arrayOfIdentifiers(dir, cb) {
    // Return array of items in a cacheDirectory
    fs.readdir(dir, (err, files) => {
      if (err) {
        debug('Failed to read directory %s', dir);
        cb(err);
      } else {
        cb(null, files.filter(f => !f.startsWith('.')));
      }
    });
  }

  static _maintainCacheDirectory(cacheDirectory, cb) {
    debug('maintaining: %s', cacheDirectory);
    this._arrayOfIdentifiers(cacheDirectory, (err, identifiers) => {
      each(
        identifiers,
        (identifier, cb1) => this._maintainCachedItem({ identifier, cacheDirectory }, cb1),
        (err4) => {
          if (err4) debug('maintainCacheDirectory failed %o', err4);
          cb(err4);
        }
      );
    });
  }

  /**
   * Perform maintenance on the system.
   * Clear out old hashes and load all the hashes in cacheDirectories or config.directories into hashstores table='ALGORITHM.filepath'.
   * Make sure all applicable files are in IPFS.
   * Delete any .part files (typically these come from a server crash while something is partially streamed in)
   *
   * @param cacheDirectories
   * @param cb
   */
  static maintenance({ cacheDirectories = undefined }, cb) {
    debug('Maintaining File System');
    each(
      cacheDirectories,
      (cacheDirectory, cb1) => this._maintainCacheDirectory(cacheDirectory, cb1),
      (err) => {
        if (err) debug('maintenance failed %o', err);
        cb(err);
      }
    );
  }

  /**
   * Passes args to `DwebTransports.seed` which - depending on transports,
   * WEBTORRENT: seed an entire directory to WebTorrent,
   * IPFS seed just the file, check the ipfs hash if supplied.
   * @param directory
   * @param relFilePath
   * @param ipfs
   * @param cb
   */
  static seed({ directory, relFilePath, ipfs }, cb) {
    const pp = relFilePath.split(path.sep);
    DwebTransports.seed({
      directoryPath: path.join(directory, pp[0]), // e.g. /Volumes/x/archiveorg/<IDENTIFIER>
      fileRelativePath: path.join(...pp.slice(1)), // e.g. <FILENAME> or thumbs/image001.jpg
      ipfsHash: ipfs,
      urlToFile: [this.httpServer + '/download', relFilePath].join('/'), // Normally http://localhost:4244/download/IDENTIFIER/FILE
    }, (unusederr, res) => {
      cb(null, res);
    });
  }

  /**
     * True if it is one of the files used by ArchiveItem, ArchiveFile, ArchiveMember that should not be seeded.
     * @param relFilePath
     * @returns {boolean}
   */
  static isSpecialFile(relFilePath) { // Note special files should match between MirrorFS.isSpecialFile and ArchiveItemPatched.save
    // SEE-OTHER-ADD-METADATA-API-TOP-LEVEL in dweb-mirror and dweb-archivecontroller
    return ['_meta.json', '_extra.json', '_member.json', '_cached.json', '_members.json', '_files.json', '_extra.json', '_reviews.json', '.part', '_related.json', '_playlist.json', '_bookreader.json', '_speech_vs_music_asr'].some(ending => relFilePath.endsWith(ending));
  }
}

exports = module.exports = MirrorFS;
