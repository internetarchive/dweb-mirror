const ParallelStream = require('parallel-streams');

class MirrorCollectionSearchStream extends ParallelStream {
    /*
    MirrorCollectionStream is a stream to run paged searches

    input:  Instance of MirrorSearch (which is extended by MirrorCollection
    output: A series of arrays of search results, corresponding to pages

    Options:    from data
    limit       col.limit || opt.limit || 100   How many items to fetch each time. 100 is probably about optimal
    maxpages    opt.maxpages || 5               Max number of search pages, so max items is maxpages*limit
    name        opt.name || "CollectionStream"  Name used in debugging
    directory   root directory in which items stored

    Inherited from ParallelStream:
    parallel    0                               Max number of threads to run in paralell
    retryms     opt.retryms || 500              How fast to loop waiting for a thread if running in parallel

    */

    constructor(options) {
        options.retryms = options.retryms || 2000; // How long to wait if threads busy
        options.name = options.name || "MirrorCollectionSearchStream";
        super(options);
        this.limit = options.limit || 100;
        this.maxpages = options.maxpages || 5; //
	    this.directory = options.directory || undefined;
    }

    // TODO obsolete this, its one line, can be merged into mirroring *but* for some reason doesnt work that way
    _parallel(data, encoding, cb) {
        /* Crawl a collection, pass output as array of ArchiveItems as sequence of calls to cb
            data: MirrorCollection (subclass of MirrorSearch & ArchiveItem)
                The ArchiveItem will have numFound, start, page  set after each fetch

         */

        data.fetch_metadata((err, d) => {
            if (err) { cb(err);  }
            else {
                let s = d.streamResults({limit: this.limit, maxpages: this.maxpages});
                cb(null, s);
            }
        })
    }
}


exports = module.exports = MirrorCollectionSearchStream;
