process.env.NODE_DEBUG="fs";    //TODO-MIRROR comment out when done testing FS
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const MirrorBaseStream = require('./MirrorBaseStream');
const errors = require('./Errors.js');
const ArchiveFile = require('dweb-archive/ArchiveFile.js');
const DwebTransports = require('dweb-transports');
const DTerrors = require('dweb-transports/Errors.js');
const path = require('path');

class MirrorFS extends MirrorBaseStream {

    constructor(options={}) {
        super(options);
        this.directory = options.directory;
        this.parallel = options.parallel;
    }
    async _streamFrom(source, cb) {
        /*
            Takes an archivefile, may extend to other types
            source:   Data source, currently supports ArchiveFile only.
            cb(err, stream): Called with open stream.
            TODO-MIRROR move this to ArchiveFile, its generally useful - if so, make it return a promise if cb not defined
         */
        if (source instanceof ArchiveFile) {
            let urls = await source.p_urls();
            try {
                let crs = await DwebTransports.p_f_createReadStream(urls, {verbose});
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
            cb(new Error("Cannot _streamFrom", source))
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
    _fileopen(root, dir, f, cb){  // cb(err, fd)
        try {
            let dirname = `${root}/${dir}`;
            let filename = `${root}/${dir}/${f}`;
            fs.open(filename, 'w', (err, fd) => {
                if (err) {
                    if (err.code === "ENOENT") {    // Doesnt exist, which means the directory or subdir -
                        fs.stat(this.directory, (err, stats) => {
                            if (err) throw new errors.MissingDirectoryError(`The root directory for mirroring: ${this.directory} is missing - please create by hand`);
                            //TODO-MIRROR-LATER check directory writable from the stats
                            console.log("MirrorFS creating directory: ")
                            this._mkdir(path.dirname(filename), err => {
                                if (err) {
                                    console.log("Failed to mkdir", dirname); cb(err); }
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
    _transform(archivefile, encoding, cb) {    // A search result got written to this stream
        if (typeof encoding === 'function') { // Allow for skipping encoding parameter (which is unused anyway)
            cb = encoding;
            encoding = null;
        }
        try {
            console.log("XXX@MirrorFS");
            this._streamFrom(archivefile, (err, s) => {
                if (err) {
                    console.warn("MirrorFS._transform ignoring error",err.message);
                    cb(null); // Dont pass error on, will trigger a Promise rejection not handled message
                    // Dont try and write it
                } else {
                    this._fileopen(this.directory, archivefile.itemid, archivefile.metadata.name, (err, fd) => {
                        if (err) {
                            console.log("MirrorFS._transform passing on error", err.message);
                            cb(err);
                        } else {
                            // fd is the file descriptor of the newly opened file;
                            console.log("XXX after _afopen", err, fd);
                            let writable = fs.createWriteStream(null, {fd: fd});
                            writable.on('close', () => {
                                let expected = archivefile.metadata.size;
                                let bytesWritten = writable.bytesWritten;
                                if (expected != bytesWritten) {  // Intentionally != as expected is a string
                                    console.warn(`File ${archivefile.itemid}/${archivefile.metadata.name} size=${bytesWritten} doesnt match expected ${expected}`)
                                } else {
                                    console.log(`Closing ${archivefile.itemid}/${archivefile.metadata.name} size=${writable.bytesWritten}`)
                                }
                                if (! this.parallel) {
                                    cb(null, {archivefile, size: writable.bytesWritten});
                                } else {
                                    //this.push({archivefile, size: writable.bytesWritten})); //TODO-MIRROR wont work - as pushes after stream closed
                                }});
                            s.pipe(writable);
                            if (this.parallel) {
                                cb(null);   // Return quickly and allow push to pass it on
                            }
                            //fs.close(fd); Should be auto closed
                            // Note at this point file is neither finished, nor closed, its being written.
                        }
                    })
                }
            });
        } catch(err) {
            console.log("MirrorFS caught error", err.message)
            cb(err);
        }
    }
}
exports = module.exports = MirrorFS;

/*
fs.open(Buffer.from('/open/some/file.txt'), 'r', (err, fd) => {
  if (err) throw err;
  fs.close(fd, (err) => {
    if (err) throw err;
  });
});
fs.open('myfile', 'wx', (err, fd) => {
  if (err) {
    if (err.code === 'EEXIST') {
      console.error('myfile already exists');
      return;
    }

    throw err;
  }

  writeMyData(fd);
});

 */