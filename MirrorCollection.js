ArchiveItem = require('../../dweb-archive/ArchiveItem');  //TODO-MIRROR move to repo
const stream = require('readable-stream');

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

    async p_crawl({limit=100, maxpages=5, through=undefined}) {
        /* Crawl a collection, calls a cb repetitively if provided
            maxpages:   Max number of times to do a search, so max items is maxpages*limit  //TODO-MIRROR increase maxpages default
            limit:      How many items to fetch each time. 100 is probably about optimal //TODO-@IA check

            The ArchiveItem will have numFound, start, page  set after each fetch
         */
        try {
            if (limit) this.limit = limit;
            this.page = 0;
            while (this.page <= maxpages && ((typeof(this.numFound) === "undefined") || ((this.start + this.limit) < this.numFound))) {
                this.page++;
                await this.fetch(); // Should fetch next page of search, won't re-fetch metadata after first tie
                if (verbose) console.log(this.start, this.items[0].identifier);
                if (through) {
                    this.items.map(i => {
                        let success = through.write(i);
                        if (!success) console.error("Failed to write stream=========================");
                    });
                }
            }
            through.end('FINISHED');
        } catch(err) {
            console.error(err);
            through.destroy(new Error("Failure in p_crawl:" + err.message))
        }
        console.log("XXX@p_crawl ending");
    }

    crawl_stream(options) {
        /* Create a stream and pass it the items read from the collection.
            options see p_crawl
         */
        options.through = new stream.PassThrough({objectMode: true, highWaterMark: 3});
        this.p_crawl(options);   // Note, not waiting on it
        return options.through; // Readable Stream
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