const stream = require('readable-stream');
const ArchiveItem = require('dweb-archive/ArchiveItem');  //TODO-MIRROR move to repo

class MirrorSearch extends ArchiveItem {
    constructor(options) {
        /*
        itemid:     the item to fetch - required if "item" not specified
        item:       if already fetched, usually not
        */
        super(options); // Note not passing item
        delete options.item;    // Handled by super
        delete options.itemid;  // Handled by super
        this.query = options.query; // Used by ArchiveItem.fetch
        this.sort = options.sort || "-downloads";   // Used by ArchiveItem.fetch
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
        // noinspection JSUnresolvedFunction
        let through = new stream.PassThrough({objectMode: true, highWaterMark: 3});
        let self = this; // this is unavailable in _p_crawl
        try {
            if (limit) this.limit = limit;
            this.page = 0;                      // Reset page count, _p_crawl will call itself repeatedly until reaches maxpages
            // noinspection JSIgnoredPromiseFromCall
            _p_crawl();      // Don't wait on result of async call, as can exit under backpressure  \
        } catch(err) {
            // Would be unexpected to see error here, more likely _p_crawl will catch it asynchronously
            console.error(err);
            //Dont destroy, this may be reading a stream of collections.
            //through.destroy(new Error("Failure in p_crawl:" + err.message))
        }
        return through;

        async function _p_crawl() {
            /* Crawl a collection, calls itself repeatedly after pushback
                Note maxpages and limit are defined in enclosing function
                maxpages:   Max number of times to do a search, so max items is maxpages*limit  //TODO-MIRROR increase maxpages default
                limit:      How many items to fetch each time. 100 is probably about optimal //TODO-@IA check

                The ArchiveItem will have numFound, start, page  set after each fetch
             */
            console.log("Continuing _p_crawl");
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
                //Dont end, this may be reading a stream of collections.
                //through.end();
            } catch(err) {
                console.error(err);
                //Dont destroy, this may be reading a stream of collections.
                //through.destroy(new Error("Failure in _p_crawl:" + err.message))
            }
        }
    }

    async s_searchitems2(cb, {limit=100, maxpages=5}) {
        /* Crawl a collection, pass output as array of ArchiveItems as sequence of calls to cb
            maxpages:   Max number of times to do a search, so max items is maxpages*limit  //TODO-MIRROR increase maxpages default
            limit:      How many items to fetch each time. 100 is probably about optimal //TODO-@IA check
            returns:    Promise

            The ArchiveItem will have numFound, start, page  set after each fetch
         */
        // noinspection JSUnresolvedFunction
        try {
            this.page = 0;                      // Reset page count
            while (this.page <= maxpages && ((typeof(this.numFound) === "undefined") || ((this.start + limit) < this.numFound))) {
                this.page++;
                await this.fetch(); // Should fetch next page of search, won't re-fetch metadata after first tie
                if (verbose) console.log("XXXXXXXXX Check this>", this.identifier, this.start, this.items[0].identifier);
                cb(this.items); // Array of ArchiveItems
            }
        } catch(err) {
            console.error(err);
        }
        console.log(this.identifier, "searchitems ending");
    }

    static async test() {
        try {
            let itemid = "prelinger";
            let foo = new MirrorCollection({itemid});
            await foo.fetch(); // Note this hasn't been passed the "item" just the itemid
            console.log("Completed test");
        } catch(err) {
            console.error(err);
        }
    }

}

exports = module.exports = MirrorSearch;