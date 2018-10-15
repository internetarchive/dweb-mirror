//process.env.NODE_DEBUG="fs";    // Uncomment to test fs
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const debug = require('debug')('dweb-mirror:MirrorFS');
const sha = require('sha');

class MirrorFS {
    /*
    Utility subclass that knows about the file system.
     */

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
                        if (err) cb(err); // Dont know how to tackle error from _mkdir, note that EEXIST wouldbe odd since ENOENT implies it doesnt exist
                        fs.mkdir(dirname, cb);
                    })
                } else {
                    cb(err); // Throw any other error
                }
            }
            cb();
        })
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
                            if (err) throw new errors.MissingDirectoryError(`The root directory for mirroring: ${directory} is missing - please create by hand`);
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

    static cacheAndOrStream({cacheDirectory = undefined, filepath=undefined, debugname="UNDEFINED", urls=undefined,
                                  expectsize=undefined, sha1=undefined, skipfetchfile=false, wantStream=false,
                                  start=0, end=undefined} = {}, cb) {
        /*
        Complicated function to encapsulate in one place the logic around the cache.

        Returns a stream from the cache, or the net if start/end unset cache it
        cacheDirectory: root directory of cache
        filepath:       Full path to file, should be inside cacheDirectory
        urls:           Single url or array to retrieve
        debugname:      Name for this item to use in debugging typically ITEMID/FILENAME
        expectsize:     If defined, the result must match this size or will be rejected (it comes from metadata)
        sha1:           If defined, the result must match this sha1 or will be rejected (it comes from metadata)
        skipfetchfile:  If true, then dont actually fetch the file (used for debugging)
        wantStream:     True if want an open stream to the contents, (set to false, when crawling)
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
        // noinspection JSUnresolvedVariable
        maybeCheckSha(filepath, sha1, (err) => {
            if (err) { //Doesn't match
                _notcached.call(this);
            } else { // sha1 matched, skip fetching, just stream from saved
                if (wantStream) {
                    debug("streaming from cached", filepath, "as sha1 matches");
                    cb(null, fs.createReadStream(filepath, {start, end}));   // Already cached and want stream - read from file
                } else {
                    debug("Already cached", filepath, "with correct sha1");
                    cb();
                }
            }
        });
        function maybeCheckSha(filepath, sha1, cb) {
            /*
            Check file is readable, or if sha1 offered check sha matches
            cb(err) If doesn't match
             */
            if (sha1) {
                sha.check(filepath, sha1, cb);
            } else { //
                fs.access(filepath, fs.constants.R_OK, cb);
            }
        }
        function _notcached() {
            /*
            Four possibilities - wantstream &&|| partialrange
            ws&p: net>stream; ws&!p: net>disk, net>stream; !ws&p; nonsense; !ws&!p caching
             */
            if (skipfetchfile) {
                debug("skipfetchfile set (testing) would fetch: %s", debugname);
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
                            const filepathTemp = filepath + ".part"
                            MirrorFS._fileopenwrite(cacheDirectory, filepathTemp, (err, fd) => {
                                if (err) {
                                    debug("Unable to write to %s: %s", filepath, err.message);
                                    cb(err);
                                } else {
                                    // fd is the file descriptor of the newly opened file;
                                    const writable = fs.createWriteStream(null, {fd: fd});
                                    // Note at this point file is neither finished, nor closed, its a stream open for writing.
                                    //fs.close(fd); Should be auto closed when stream to it finishes
                                    writable.on('close', () => {
                                        // noinspection EqualityComparisonWithCoercionJS
                                        if (expectsize && (expectsize != writable.bytesWritten)) { // Intentionally != as metadata is a string
                                            debug("File %s size=%d doesnt match expected %s, deleting", debugname, writable.bytesWritten, expectsize);
                                            fs.unlink(filepathTemp, (err) => {
                                                if (err) { console.error(`Can't delete ${filepathTemp}`); } // Shouldnt happen
                                                if (!wantStream) cb(err); // Cant send err if not wantStream as already done it
                                            })
                                        } else {
                                            fs.rename(filepathTemp, filepath, (err) => {
                                                if (err) {
                                                    console.error(`Failed to rename ${filepathTemp} to ${filepath}`); // Shouldnt happen
                                                    if (!wantStream) cb(err); // If wantStream then already called cb
                                                } else {
                                                    debug(`Closed ${debugname} size=${writable.bytesWritten}`);
                                                    if (!wantStream) cb(); // If wantStream then already called cb, otherwise cb signifies file is written
                                                }
                                            })
                                        }
                                    });
                                    s.on('error', (err) => debug("Failed to read %s from net err=%s", debugname, err.message));
                                    try {
                                        s.pipe(writable);   // Pipe the stream from the HTTP or Webtorrent read etc to the stream to the file.
                                        if (wantStream) cb(null, s);
                                    } catch(err) {
                                        console.log("XXX @ ArchiveFilePatched - catching error with save() in s.pipe shouldnt happen",s);
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




}
exports = module.exports = MirrorFS;
