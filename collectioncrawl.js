//global.window = {}; // Target for things like window.onpopstate in Nav.js
const stream = require('readable-stream');
global.DwebTransports = require('dweb-transports/index.js'); //TODO-MIRROR move to repo
global.DwebObjects = require('dweb-objects/index.js'); //Includes initializing support for names //TODO-MIRROR move to repo
const HashStore = require('./HashStore.js');
const MirrorCollection = require('./MirrorCollection.js');
const MirrorFS = require('./MirrorFS.js');
const s = require('./StreamTools.js');
const ArchiveItem = require('dweb-archive/ArchiveItem');  //TODO-MIRROR move to repo
const wrtc = require('wrtc');
const ParallelStream = require('./ParallelStream');



/* Collection crawl is a "eat your own dogfood" application to see whether this set of tools does what we need.
    Challenge - crawl the collections in the archive, dont mirror but trigger the metadata search so that the server preloads IPFS
 */



var config = {
    //hashstore: { file: "level_db" },
    //ui: {},
    //fs: {},
    //directory: "/Users/mitra/temp/mirrored",
    //limititemspersearchpage: 5, // Optimum is probably around 100
    //limitpagespercollection: 5, // So max #items is limititemspersearchpage * limitpagespercollection
    //limittotalfiles: 250,
    //limitfilesize: 1000000,
    collections: {  //TODO-MIRROR not yet paying attention to this - issue#18
        "image": {},
        "movies": {},
        "texts": {},
        "audio": {},
    }
};


class CollectionSearchStream extends ParallelStream {
    constructor(options) {
        super(options);
        this.limit = options.limit || 100; // limit:      How many items to fetch each time. 100 is probably about optimal //TODO-@IA check
        this.maxpages = options.maxpages || 5; // maxpages:   Max number of times to do a search, so max items is maxpages*limit  //TODO-MIRROR increase maxpages default
    }

    _parallel(data, encoding, cb) {
        /* Crawl a collection, pass output as array of ArchiveItems as sequence of calls to cb

            The ArchiveItem will have numFound, start, page  set after each fetch
         */
        if (typeof encoding === 'function') { cb = encoding; encoding = null; } //Allow missing enc
        let col = data;
        let page = 0;
        while (page <= this.maxpages && ((typeof(col.numFound) === "undefined") || ((col.start + this.limit) < col.numFound))) {
            page++;
            col.fetch() // Should fetch next page of search, won't re-fetch metadata after first tie
                .then(() => {
                    if (verbose) console.log(col.itemid, col.start, col.items.length);
                    this.push(col.items); // Array of ArchiveItems // col.items will get rewritten by next search, but with a new array so this passed on array is ok
                })
        }
        cb();
        console.log("searchitems of", col.itemid, "ending");
    }
}


class Mirror {


    static async init() {
        //await HashStore.init(config.hashstore);
    }
    /*
    static async test() {
        await HashStore.test();
    }
    */
    static async p_dev_mirror() {
        try {
            global.verbose = false;
            // Incremental development building and testing components to path in README.md
            await DwebTransports.p_connect({
                    transports: ["HTTP", "WEBTORRENT", "IPFS"],
                    webtorrent: {tracker: { wrtc }},
                }, false);
            global.verbose = true;
            //TODO-MIRROR this is working around default that HTTP doesnt officially support streams, till sure can use same interface with http & WT
            DwebTransports.http(verbose).supportFunctions.push("createReadStream");


            new s({name: "EatConfig"}).fromEdibleArray(Object.keys(config.collections))
                .pipe(new s().log((m)=>["Collection:", m]))
                .pipe(new s().map((name) => new MirrorCollection({itemid: name}) ))  // Initialize collection - doesnt get metadata or search results
                .pipe(new CollectionSearchStream({limit: 3, maxpages: 3}))
                .pipe(new s().log((m) => ["Debug at end", m]))
        } catch(err) {
            console.error(err);
        }
    }
}


Mirror.init()
    //.then(() => Mirror.test())
    .then(() => Mirror.p_dev_mirror())
    .then(() => console.log("tested waiting for output"));
