ArchiveItem = require('dweb-archive/ArchiveItem'); //TODO-MIRROR move to repo
const stream = require('readable-stream');

XXX uncompleted template

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
            ai.fetch().then(() =>  cb(null, ai)); // Async Gets metadata
        } catch(err) {
            cb(err);
        }
    }
}
exports = module.exports = MirrorItemFromStream;