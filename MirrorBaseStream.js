const stream = require('readable-stream');

class MirrorBaseStream extends stream.Transform {
    /* Turn a stream of search results (and possibly other things) into a stream of ArchiveItems

     */
    constructor(options) {
        const defaultopts = {
            objectMode: true, // Default to object mode rather than stream of bytes
            highWaterMark: 3
        }   // Default to pushback after 3, will probably raise this
        super(Object.assign(defaultopts, options));
    }
}

exports = module.exports = MirrorBaseStream;