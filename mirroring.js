global.DwebTransports = require('@internetarchive/dweb-transports');
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names
const HashStore = require('./HashStore.js');
const MirrorCollection = require('./MirrorCollection.js');
const MirrorFS = require('./MirrorFS.js');
const s = require('./StreamTools.js');
const ArchiveItem = require('@internetarchive/dweb-archive/ArchiveItem');
const wrtc = require('wrtc');
const CollectionSearchStream = require('./MirrorCollectionSearchStream');


var config = {
    //hashstore: { file: "level_db" },
    //ui: {},
    //fs: {},
    directory: "/Users/mitra/temp/mirrored",
    limititemspersearchpage: 5, // Optimum is probably around 100
    limitpagespercollection: 5, // So max #items is limititemspersearchpage * limitpagespercollection
    limittotalfiles: 250,
    limitfilesize: 1000000,
    collections: {  //TODO-MIRROR not yet paying attention to this - issue#18
        "prelinger": {}
    }
};

//emitter.setMaxListeners(15); - for error message to fix this  but not sure what "emitter" is


class Mirror {

    static async init() {
        await HashStore.init(config.hashstore);
    }
    static async test() {
        await HashStore.test();
    }
    static async p_dev_mirror() {
        try {
            global.verbose = true;
            // Incremental development building and testing components to path in README.md
            await DwebTransports.p_connect({
                    transports: ["HTTP", "WEBTORRENT", "IPFS"],
                    webtorrent: {tracker: { wrtc }},
                }, verbose);
            //TODO-MIRROR this is working around default that HTTP doesnt officially support streams, till sure can use same interface with http & WT
            DwebTransports.http(verbose).supportFunctions.push("createReadStream");
            // Total number of results will be ~ maxpages * limit
            new s({name: "EatConfig"}).fromEdibleArray(Object.keys(config.collections))
                .pipe(new s().log((m)=>["Collection:", m.identifier]))

                .pipe(new s({name: 'Create MirrorCollections'}).map((name) => new MirrorCollection({itemid: name}) ))  // Initialize collection - doesnt get metadata or search results
                // Stream of ArchiveItems - which should all be collections
                .pipe(new CollectionSearchStream({limit: config.limititemspersearchpage, maxpages: config.limitpagespercollection, parallel, silentwait: true}))
                // Stream of arrays of Search results (minimal JSON) ready for fetching
                .pipe(new s({name: '1 split arrays of AI'}).split())
                // Stream of Search results (mixed)
                //.pipe(new s().slice(0,1))   //Restrict to first Archive Item
                .pipe(new s().log((m)=>["SearchResult:", m.identifier]))
                //.pipe(new MirrorItemFromStream({highWaterMark: 3}))
                //.pipe(new MirrorMapStream((o) => new ArchiveItem({itemid: o.identifier}).fetch().then(o=>o._list)))
                .pipe(new s({parallel: 5}).map((o) => new ArchiveItem({itemid: o.identifier}).fetch().then(o=>o._list))) // Parallel metadata reads
                // a stream of arrays of ArchiveFiles
                .pipe(new s().split())
                // a stream of ArchiveFiles's with metadata fetched
                .pipe(new s().filter(af => af.metadata.size < config.limitfilesize))
                .pipe(new s().slice(0,config.limittotalfiles))
                .pipe(new s().log((m)=>["FileResult:", `${m.itemid}/${m.metadata.name}`]))
                .pipe(new MirrorFS({directory: config.directory, parallel: 5 }))    // Parallel retrieve to file system
                .pipe(new s().log((o)=>["MirrorFS Result:", `${o.archivefile.itemid}/${o.archivefile.metadata.name} size=${o.size} expect size=${o.archivefile.metadata.size}`]))

        } catch(err) {
            console.error(err);
        }
    }
}


Mirror.init()
    //.then(() => Mirror.test())
    .then(() => Mirror.p_dev_mirror())
    .then(() => console.log("tested waiting for output"));
