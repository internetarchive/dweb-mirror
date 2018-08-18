process.env.DEBUG="dweb-transports dweb-objects dweb-mirror:*";  // Get highest level debugging of these two libraries, must be before require(dweb-transports) //TODO-MIRROR check using GUN for metadata
global.DwebTransports = require('@internetarchive/dweb-transports');
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names
const HashStore = require('./HashStore.js');
const MirrorCollection = require('./MirrorCollection.js');
const MirrorFS = require('./MirrorFS.js');
const s = require('./StreamTools.js');
const ArchiveItem = require('@internetarchive/dweb-archive/ArchiveItem');
const wrtc = require('wrtc');
const CollectionSearchStream = require('./MirrorCollectionSearchStream');
const MirrorConfig = require('./MirrorConfig');

let config = new MirrorConfig({
    //hashstore: { file: "level_db" },
    //ui: {},
    //fs: {},
    directory: "/Users/mitra/temp/mirrored",
    limittotalfiles: 250,   // Maximum number of files to consider retrieving (will further filter if unchanged)
    search: {
        itemsperpage: 2, // Optimum is probably around 100,
        pagespersearch: 2
    },
    file: {
        maxfilesize: 1000000
    },
    collections: {
        "prelinger": {}
    }
});

//emitter.setMaxListeners(15); - for error message to fix this  but not sure what "emitter" is


class Mirror {

    static async init() {
        //await HashStore.init(config.hashstore);
    }
    static async test() {
        //await HashStore.test();
    }
    static async p_dev_mirror() {
        let parallel = 5;

        try {
            // Incremental development building and testing components to path in README.md
            await DwebTransports.p_connect({
                    transports: ["HTTP", "WEBTORRENT", "IPFS"],
                    webtorrent: {tracker: { wrtc }},
                });
            //TODO-MIRROR this is working around default that HTTP doesnt officially support streams, till sure can use same interface with http & WT
            DwebTransports.http().supportFunctions.push("createReadStream");
            // Total number of results will be ~ maxpages * limit
            new s({name: "EatConfig"}).fromEdibleArray(Object.keys(config.collections))
                .pipe(new s({name:"Collection"}).log((m)=>[m.identifier]))

                .pipe(new s({name: 'Create MirrorCollections'}).map((name) => new MirrorCollection({itemid: name}) ))  // Initialize collection - doesnt get metadata or search results
                // Stream of ArchiveItems - which should all be collections
                .pipe(new CollectionSearchStream({limit: config.search.itemsperpage, maxpages: config.search.pagespersearch, parallel, silentwait: true}))
                // Stream of arrays of Search results (minimal JSON) ready for fetching
                .pipe(new s({name: '1 split arrays of AI'}).split())
                // Stream of Search results (mixed)
                //.pipe(new s().slice(0,1))   //Restrict to first Archive Item
                .pipe(new s({name:"SearchResult"}).log((m)=>[m.identifier]))
                //.pipe(new MirrorItemFromStream({highWaterMark: 3}))
                //.pipe(new MirrorMapStream((o) => new ArchiveItem({itemid: o.identifier}).fetch().then(o=>o._list)))
                .pipe(new s({name: "AI fetch", parallel: 5}).map((o) => new ArchiveItem({itemid: o.identifier}).fetch().then(o=>o._list))) // Parallel metadata reads
                // a stream of arrays of ArchiveFiles
                .pipe(new s().split())
                // a stream of ArchiveFiles's with metadata fetched
                .pipe(new s({name: "filter"}).filter(af => config.filter(af)))
                .pipe(new s({name: `slice first ${config.limittotalfiles} files`}).slice(0,config.limittotalfiles))
                .pipe(new s({name: "FileResult"}).log((m)=>[ "%s/%s", m.itemid, m.metadata.name]))
                .pipe(new MirrorFS({directory: config.directory, parallel: 5 }))    // Parallel retrieve to file system
                .pipe(new s({name: "MirrorFS"}).log((o)=>o ? ['%s/%s size=%d expect size=%s',
                    o.archivefile.itemid, o.archivefile.metadata.name, o.size, o.archivefile.metadata.size] : ["undefined"]))

        } catch(err) {
            console.error(err);
        }
    }
}


Mirror.init()
    //.then(() => Mirror.test())
    .then(() => Mirror.p_dev_mirror())
    .then(() => console.log("tested waiting for output"));
