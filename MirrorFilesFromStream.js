const stream = require('readable-stream');

class MirrorFilesFromStream extends stream.Transform {
    /*
    input stream - search results or collection as ArchiveItems with metadata fetched TODO maybe accept other things
    output stream of ArchiveFile suitable for retrieving
     */
    constructor(options) {
        /*
        options: { highWaterMark: number of items in stream before start pushing back}
         */
        options.objectMode = true;
        super(options);
    }
    _transform(archiveitem, encoding, cb) {    // A search result got written to this stream
        if (typeof encoding === 'function') { // Allow for skipping encoding parameter (which is unused anyway)
            cb = encoding;
            encoding = null;
        }
        try {
            console.log("Trying",archiveitem.itemid)
            let self=this;
            //this.push(archiveitem._list[0]) //Works
            if (archiveitem._list) {  // Will be undefined if no files
                archiveitem._list.forEach(archivefile => console.log("XXX", archivefile.metadata.name)); //Fails
                archiveitem._list.forEach(archivefile => self.push(archivefile)); //Fails
            }
            cb();
        } catch(err) {
            cb(err);
        }
    }
}
exports = module.exports = MirrorFilesFromStream;