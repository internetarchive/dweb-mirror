process.env.NODE_DEBUG="fs";    //TODO-MIRROR comment out when done testing FS
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const ParallelStream = require('./ParallelStream');
const path = require('path');

class MirrorFS extends ParallelStream {
    /*
    Common subclass to SaveFiles and SaveItems
     */

    constructor(options = {}) {
        const defaultoptions = {
            name: "MirrorFS",
        };
        super(Object.assign(defaultoptions, options));
        this.directory = options.directory;
    }


    _mkdir(dirname, cb) {
        /* Recursively make a directory
        dirname: String representing file path
        cb(err):     Call back, with error if unable to complete
        */
        fs.mkdir(dirname, err => {
            if (err && !(err.code === "EEXIST")) {
                if (err.code === "ENOENT") { // missing parent dir
                    let parentdir = path.dirname(dirname);
                    this._mkdir(parentdir, err => {
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

    _fileopen(filepath, cb) {  // cb(err, fd)
        /*
        filepath path to file (rooted preferably)
        If fails to open for writing then will check for presence of a root directory, and recursively mkdir before trying again.
         */
        try {
            fs.open(filepath, 'w', (err, fd) => {
                if (err) {
                    if (err.code === "ENOENT") {    // Doesnt exist, which means the directory or subdir -
                        // noinspection JSUnusedLocalSymbols
                        fs.stat(this.directory, (err, stats) => {
                            if (err) throw new errors.MissingDirectoryError(`The root directory for mirroring: ${this.directory} is missing - please create by hand`);
                            //TODO-MIRROR-LATER check directory writable from the stats
                            this.debug("MirrorFS creating directory: %s", path.dirname(filepath));
                            this._mkdir(path.dirname(filepath), err => {
                                if (err) {
                                    console.error("Failed to mkdir for", filepath);
                                    cb(err);
                                }
                                fs.open(filepath, 'w', (err, fd) => {
                                    if (err) {
                                        console.error("Failed to open", filepath, "after mkdir");
                                        throw err;
                                    }
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
        } catch (err) {
            cb(err);
        }
    }

    _final(cb) {
        if (this.paralleloptions.count) {
            this.debug("MirrorFS: Waiting on %d of max %d threads to close", this.paralleloptions.count, this.paralleloptions.max);
            setTimeout(() => this._final(cb), 1000);
            return;
        }
        cb();
    }


}
exports = module.exports = MirrorFS;
