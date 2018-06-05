ArchiveItem = require('../../dweb-archive/ArchiveItem'); //TODO-MIRROR move to repo
const stream = require('readable-stream');


class MirrorItemFromStream extends stream.Transform {
    /* Turn a stream of search results (and possibly other things) into a stream of ArchiveItems

     */
    constructor(options) {
        options.objectMode = true;
        super(options);
    }
    _transform(searchres, encoding, cb) {    // A search result got written to this stream
        // TODO may be other kinds of things we want to accept a stream of
        if (typeof encoding === 'function') {
            cb = encoding;
            encoding = null;
        }
        try {
            let itemid = searchres.identifier;
            let ai = new ArchiveItem({itemid});
            console.log("XXX@MIFS_t after AI");
            ai.fetch().then(() =>  cb(null, ai)); // Async Gets metadata
        } catch(err) {
            cb(err);
        }
    }
}

/*
class MirrorItem extends ArchiveItem {

    constructor(options) {
        /-*
        itemid:     the item to fetch - required if "item" not specified
        item:       if already fetched, usually not
        *-/
        super(options); // Note not passing item
        delete options.item;    // Handled by super
        delete options.itemid;  // Handled by super
        this.options = options;
    }







    async p_crawl({readstream=undefined, writestream=undefined}={}) {
        while (read.read()) {  // Check if this works to wait

        }
    }

    crawl_stream({read=undefined}) {
        /-* Create a stream and pass it the items read from the collection.
            options see p_crawl
         *-/
        options.writestream = new stream.PassThrough({objectMode: true, highWaterMark: 3}); //TODO-MIRROR high water mark higher in practice
        this.p_crawl(options);                  // Note, not waiting on it
        return options.writestream;                   // Readable Stream
    }


}
*/
exports = module.exports = MirrorItemFromStream;