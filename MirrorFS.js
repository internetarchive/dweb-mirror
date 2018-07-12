process.env.NODE_DEBUG="fs";    //TODO-MIRROR comment out when done testing FS
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const MirrorBaseStream = require('./MirrorBaseStream');

class MirrorFS extends MirrorBaseStream {

    constructor(options={}) {
        super(options);
        this.directory = options.directory;
    }

    _transform(archivefile, encoding, cb) {    // A search result got written to this stream
        if (typeof encoding === 'function') { // Allow for skipping encoding parameter (which is unused anyway)
            cb = encoding;
            encoding = null;
        }
        try {
            filename = `{this.directory}/${archivefile.itemid}/${archivefile.metadata.name}`;
            console.log("XXX@MirrorFS",filename)
            stats = fs.statSync(filename);  // Comment out after testing - its slow and sync
            console.log(`stats: ${JSON.stringify(stats)}`);
            //fs.open()

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