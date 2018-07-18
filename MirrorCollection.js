const stream = require('readable-stream');
const ArchiveItem = require('dweb-archive/ArchiveItem');  //TODO-MIRROR move to repo

class MirrorCollection extends ArchiveItem {
    constructor(options) {
        /*
        itemid:     the item to fetch - required if "item" not specified
        item:       if already fetched, usually not
        */
        super(options); // Note not passing item
        delete options.item;    // Handled by super
        delete options.itemid;  // Handled by super
        this.query = 'collection:'+this.itemid;
        this.sort = options.sort;
        delete options.sort;
        this.options = options;
    }



    s_searchitems({limit=100, maxpages=5}) {
        /* Crawl a collection, pass output to a stream
            maxpages:   Max number of times to do a search, so max items is maxpages*limit  //TODO-MIRROR increase maxpages default
            limit:      How many items to fetch each time. 100 is probably about optimal //TODO-@IA check
            returns:    PassThrough stream to read from which will be a stream of ArchiveItem

            The ArchiveItem will have numFound, start, page  set after each fetch
         */
        let through = new stream.PassThrough({objectMode: true, highWaterMark: 3});
        let self = this; // this is unavailable in _p_crawl
        try {
            if (limit) this.limit = limit;
            this.page = 0;                      // Reset page count, _p_crawl will call itself repeatedly until reaches maxpages
            _p_crawl({maxpages, through}); // Don't wait on result of async call, as can exit under backpressure
        } catch(err) {
            // Would be unexpected to see error here, more likely _p_crawl will catch it asynchronously
            console.error(err);
            through.destroy(new Error("Failure in p_crawl:" + err.message))
        }
        console.log("XXX@p_crawl ending");
        return through;

        async function _p_crawl() {
            /* Crawl a collection, calls itself repeatedly after pushback
                maxpages:   Max number of times to do a search, so max items is maxpages*limit  //TODO-MIRROR increase maxpages default
                limit:      How many items to fetch each time. 100 is probably about optimal //TODO-@IA check

                The ArchiveItem will have numFound, start, page  set after each fetch
             */
            console.log("Continuing _p_crawl")
            try {
                while (self.page <= maxpages && ((typeof(self.numFound) === "undefined") || ((self.start + self.limit) < self.numFound))) {
                    self.page++;
                    await self.fetch(); // Should fetch next page of search, won't re-fetch metadata after first tie
                    if (verbose) console.log(self.start, self.items[0].identifier);
                    let freeflowing;
                    self.items.map(i => {
                        freeflowing = through.write(i);
                        if (!freeflowing) console.error(`Pushback at ${i.identifier} from stream=========================`);
                        //if (freeflowing) console.log(`Success writing ${i.identifier} to stream >>>>>>>>>>>>>>>`)
                    }); //map
                    // Slightly unorthodox, keep writing one set of results even if backpressure, but if exit still under
                    // backpressure then wait for the drain event.
                    if (!freeflowing) {
                        through.once("drain", _p_crawl);
                        return; // Without finishing
                    }
                } //while
                // Notice the return above will exit if sees backpressure
                through.end('FINISHED');
            } catch(err) {
                console.error(err);
                through.destroy(new Error("Failure in _p_crawl:" + err.message))
            }
        }
    }

    static async test() {
        try {
            let itemid = "prelinger";
            let foo = new MirrorCollection({itemid});
            await foo.fetch() // Note this hasn't been passed the "item" just the itemid
            console.log("Completed test");
        } catch(err) {
            console.error(err);
        }
    }

}
exports = module.exports = MirrorCollection;