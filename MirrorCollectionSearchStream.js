const ParallelStream = require('./ParallelStream');

class MirrorCollectionSearchStream extends ParallelStream {
    /*
    MirrorCollectionStream is a stream to run paged searches

    input:  Instance of MirrorSearch (which is extended by MirrorCollection
    output: A series of arrays of search results, corresponding to pages

    Options:    from data
    limit       col.limit || opt.limit || 100   How many items to fetch each time. 100 is probably about optimal
    maxpages    opt.maxpages || 5               Max number of search pages, so max items is maxpages*limit  //TODO-MIRROR increase maxpages default    */
    name        opt.name || "CollectionStream"  Name used in debugging

    Inherited from ParallelStream:
    parallel    0                               Max number of threads to run in paralell
    retryms     opt.retryms || 500              How fast to loop waiting for a thread if running in parallel

    */

    constructor(options) {
        options.retryms = options.retryms || 500; // How long to wait if threads busy
        options.name = options.name || "CollectionSearchStream";
        super(options);
        this.limit = options.limit || 100; // limit:      //TODO-@IA check
        this.maxpages = options.maxpages || 5; //
    }

    _parallel(data, encoding, cb) {
        /* Crawl a collection, pass output as array of ArchiveItems as sequence of calls to cb

            The ArchiveItem will have numFound, start, page  set after each fetch
         */
        if (typeof encoding === 'function') { cb = encoding; encoding = null; } //Allow missing enc
        let col = data;
        if (typeof col.page === "undefined") col.page = 0;
        if ((typeof col.limit === "undefined") && (typeof this.limit !== "undefined")) col.limit = this.limit;
        if (col.page < this.maxpages && ((typeof(col.numFound) === "undefined") || ((col.start + this.limit) < col.numFound))) {
            col.page++;
            // Should fetch next page of search, and metadata on first time.
            col.fetch()
                .then(() => {
                    if (verbose) console.log(col.itemid, col.items.length, "starting at", col.start );
                    this.push(col.items); // Array of ArchiveItems // col.items will get rewritten by next search, but with a new array so this passed on array is ok
                    this._parallel(col, encoding, cb) // Loop by recursion in cb (could cause stack overflow if maxpages is large, but it shouldnt be)
                })
        } else {
            cb(); // Close stream on innermost recursion
            console.log("searchitems of", col.itemid, "ending");
        }
    }
}


exports = module.exports = MirrorCollectionSearchStream;
