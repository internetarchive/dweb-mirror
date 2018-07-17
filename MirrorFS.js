process.env.NODE_DEBUG="fs";    //TODO-MIRROR comment out when done testing FS
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const MirrorBaseStream = require('./MirrorBaseStream');
const errors = require('./Errors.js');

class MirrorFS extends MirrorBaseStream {

    constructor(options={}) {
        super(options);
        this.directory = options.directory;
    }

    _afopen(root, dir, f, cb){  // cb(fd)
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
                            fs.mkdir(dirname, err => {
                                if (err) {console.log("Failed to mkdir", dirname); throw err; }
                                fs.open(filename, 'w', (err, fd) => {
                                    if (err) { console.log("Failed to open", filename, "after mkdir"); throw err; }
                                    cb(null, fd)
                                });
                            });
                        });
                    } else {
                        throw(err); // Not specifically handling it - so throw it up
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
            this._afopen(this.directory, archivefile.itemid, archivefile.metadata.name, (err, fd) => {
                console.log("XXX after _afopen",err,fd);
                fs.close(fd);
            })
            cb();
        } catch(err) {
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