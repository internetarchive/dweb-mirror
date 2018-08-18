process.env.NODE_DEBUG="fs";    //TODO-MIRROR comment out when done testing FS
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const ParallelStream = require('./ParallelStream');
const errors = require('./Errors.js');
const ArchiveFile = require('@internetarchive/dweb-archive/ArchiveFile.js');
const DwebTransports = require('@internetarchive/dweb-transports');
const DTerrors = require('@internetarchive/dweb-transports/Errors.js');
const path = require('path');
const sha = require('sha');

class MirrorFS extends ParallelStream {
    /*
    Input: Stream of ArchiveFile (may extend to other types later
    Output: Stream of {archivefile, size read (-1 if skipped)}

    Fetchs an ArchiveFile and writes to disk
    Optimised by checking the sha first and skipping if matches
     */

    constructor(options={}) {
        const defaultoptions = {
            paralleloptions: {limit: 10, retryms: 100},
            name: "MirrorFS",
            silentwait: true, // Expecting this to be waiting a bunch
        };
        super(Object.assign(defaultoptions, options));
        this.directory = options.directory;
    }
    async _streamFrom(source, cb) {
        /*
            Takes an ArchiveFile, may extend to other types
            source:   Data source, currently supports ArchiveFile only.
            cb(err, stream): Called with open stream.
            TODO-MIRROR move this to ArchiveFile, its generally useful - if so, make it return a promise if cb not defined
         */
        if (source instanceof ArchiveFile) {
            let urls = await source.p_urls();
            try {
                let crs = await DwebTransports.p_f_createReadStream(urls);
                let temp = await crs({start:0});
                cb(null, temp ); //TODO-MIRROR check that await crs works if crs is not a promise
            } catch(err) {
                if (err instanceof DTerrors.TransportError) {
                    console.warn("MirrorFS._streamFrom caught", err.message);
                } else {
                    console.error("MirrorFS._streamFrom caught", err);
                }
                cb(err);
            }
        } else {
            cb(new Error("Cannot _streamFrom "+source))
        }

    }

    _mkdir(dirname, cb) {
        fs.mkdir(dirname, err => {
            if (err) {
                if (err.code === "ENOENT") { // missing parent dir
                    let parentdir = path.dirname(dirname);
                    this._mkdir(parentdir, err => {
                        if (err) cb(err); // Dont know how to tackle error from _mkdir
                        fs.mkdir(dirname, cb);
                    })
                } else {
                    cb(err); // Throw any other error
                }
            }
            cb();
        })
    }
    _fileopen(filename, cb){  // cb(err, fd)
        try {
            fs.open(filename, 'w', (err, fd) => {
                if (err) {
                    if (err.code === "ENOENT") {    // Doesnt exist, which means the directory or subdir -
                        // noinspection JSUnusedLocalSymbols
                        fs.stat(this.directory, (err, stats) => {
                            if (err) throw new errors.MissingDirectoryError(`The root directory for mirroring: ${this.directory} is missing - please create by hand`);
                            //TODO-MIRROR-LATER check directory writable from the stats
                            console.log("MirrorFS creating directory: ", path.dirname(filename));
                            this._mkdir(path.dirname(filename), err => {
                                if (err) { console.log("Failed to mkdir for", filename); cb(err); }
                                fs.open(filename, 'w', (err, fd) => {
                                    if (err) { console.log("Failed to open", filename, "after mkdir"); throw err; }
                                    cb(null, fd)
                                });
                            });
                        });
                    } else {
                        cb(err); // Not specifically handling it - so throw it up
                    }
                } else {
                    cb(null, fd);
                }
            });
        } catch(err) {
            cb(err);
        }
    }
    _final(cb) {
        if (this.paralleloptions.count) {
            console.log("MirrorFS: Waiting on", this.paralleloptions.count,"of max",this.paralleloptions.max,"threads to close");
            setTimeout(()=>this._final(cb), 1000);
            return;
        }
        console.log("MirrorFS: Closed parallel streams was max=", this.paralleloptions.max);
        cb();
    }


    _parallel(archivefile, encoding, cb) {    // A archivefile got written to this stream, fetch and store
        /*
        _parallel has same profile as _transform except is run in parallel
        All paths through this must end with a cb with an optional final data.
        It is allowable to use this.push() before the final cb() but not after.
        */
        //
        if (typeof encoding === 'function') { // Allow for skipping encoding parameter (which is unused anyway)
            cb = encoding;
            encoding = null;
        }
        try {
            let filepath = path.join(this.directory, archivefile.itemid, archivefile.metadata.name);
            sha.check(filepath, archivefile.metadata.sha1, (err) => {
                if (err) {
                    // noinspection JSIgnoredPromiseFromCall
                    this._streamFrom(archivefile, (err, s) => { //Returns a promise, but not waiting for it
                        if (err) {
                            console.warn("MirrorFS._transform ignoring error on", archivefile.itemid, err.message);
                            cb(null); // Dont pass error on, will trigger a Promise rejection not handled message
                            // Dont try and write it
                        } else {
                            this._fileopen(filepath, (err, fd) => {
                                if (err) {
                                    console.log("MirrorFS._transform passing on error for",archivefile.itemid, err.message);
                                    cb(err);
                                } else {
                                    // fd is the file descriptor of the newly opened file;
                                    let writable = fs.createWriteStream(null, {fd: fd});
                                    writable.on('close', () => {
                                        let expected = archivefile.metadata.size;
                                        let bytesWritten = writable.bytesWritten;
                                        // noinspection EqualityComparisonWithCoercionJS
                                        if (expected != bytesWritten) {  // Intentionally != as expected is a string
                                            console.warn(`File ${archivefile.itemid}/${archivefile.metadata.name} size=${bytesWritten} doesnt match expected ${expected}`)
                                        } else {
                                            console.log(`Closing ${archivefile.itemid}/${archivefile.metadata.name} size=${writable.bytesWritten}`)
                                        }
                                        cb(null, {archivefile, size: writable.bytesWritten});
                                    });
                                    s.pipe(writable);   // Pipe the stream from the HTTP or Webtorrent read etc to the stream to the file.
                                    //fs.close(fd); Should be auto closed
                                    // Note at this point file is neither finished, nor closed, its being written.
                                }
                            })
                        }
                    });
                } else { // sha1 matched, skip
                    console.log("Skipping", filepath, "as sha1 matches");
                    cb(null,  {archivefile, size: -1});
                }
            });
        } catch(err) {
            console.error("MirrorFS._parallel caught error", err.message);
            cb(err);
        }
    }

}
exports = module.exports = MirrorFS;
