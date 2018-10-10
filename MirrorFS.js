//process.env.NODE_DEBUG="fs";    // Uncomment to test fs
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const debug = require('debug')('dweb-mirror:MirrorFS');

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

}
exports = module.exports = MirrorFS;
