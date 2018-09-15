process.env.DEBUG="dweb-transports dweb-objects dweb-mirror:* parallel-streams:*";  // Get highest level debugging of these two libraries, must be before require(dweb-transports) //TODO-MIRROR check using GUN for metadata
// Standard repos
const wrtc = require('wrtc');
const debug = require('debug');

// Other IA repos
global.DwebTransports = require('@internetarchive/dweb-transports');
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names
const ArchiveItem = require('./ArchiveItemPatched');

// Other files in this repo
const config = require('./config');
const HashStore = require('./HashStore.js');
const MirrorCollection = require('./MirrorCollection.js');
const CollectionSearchStream = require('./MirrorCollectionSearchStream');
const ParallelStream = require('parallel-streams');
const SaveFiles = require('./SaveFiles.js');

//emitter.setMaxListeners(15); - for error message to fix this  but not sure what "emitter" is


class Mirror {

    static async init() {
        Mirror.debug = debug('dweb-mirror:mirroring')
        //await HashStore.init(config.hashstore);
    }
    static async test() {
        //await HashStore.test();
    }
    static async p_dev_mirror() {
        let paralleloptions = {limit: 5, silentwait: true};

        try {
            // Incremental development building and testing components to path in README.md
            await DwebTransports.p_connect({
                    transports: ["HTTP", "WEBTORRENT", "IPFS"],
                    webtorrent: {tracker: { wrtc }},
                });
            //TODO-MIRROR this is working around default that HTTP doesnt officially support streams, till sure can use same interface with http & WT
            DwebTransports.http().supportFunctions.push("createReadStream");
            // Total number of results will be ~ maxpages * limit
            let ss =
                ParallelStream.from(Object.keys(config.collections), {name: "Munching"})
                .log((m)=>[m], {name:"Collection"})
                .map((name) => new MirrorCollection({itemid: name}), {name: 'Create MirrorCollections'} )  // Initialize collection - doesnt get metadata or search results
                // Stream of ArchiveItems - which should all be collections
                .pipe(new CollectionSearchStream({limit: config.search.itemsperpage, maxpages: config.search.pagespersearch, paralleloptions, directory: config.directory}))
                // Stream of arrays of Search results (minimal JSON) ready for fetching
                .flatten({name: '1 flatten arrays of AI'})
                // Stream of Search results (mixed)
                //.slice(0,1)  //Restrict to first Archive Item (just for testing)
                .log((m)=>[m.identifier], {name:"SearchResult"})
                .map((o) => new ArchiveItem({itemid: o.identifier}).fetch(), {name: "AI fetch", paralleloptions}) // Parallel metadata reads
                // a stream of ArchiveFiles's with metadata fetched
                .fork(2, {name: "Fork"}).streams;
                ss[0].map((ai, cb) => ai.save({cacheDirectory: config.directory}, cb), {name: "SaveItems", async: true, paralleloptions})
                    //pipe(new SaveItems({directory: config.directory, paralleloptions }))    // Parallel saves of metadata
                    .reduce();
                ss[1]
                    .map(ai => config.filterlist(ai), {name: "List"}) // Figure out optimum set of items in case config chooses that.
                    .flatten({name: "flatten files"})
                    .filter(af => config.filter(af), {name: "filter"})  // Stream of ArchiveFiles matching criteria
                    .slice(0,config.limittotalfiles, {name: `slice first ${config.limittotalfiles} files`}) // Stream of <limit ArchiveFiles
                    .log((m)=>[ "%s/%s", m.itemid, m.metadata.name], {name: "FileResult"})
                    .pipe(new SaveFiles({directory: config.directory, paralleloptions, skipfetchfile: config.skipfetchfile }))    // Parallel retrieve to file system
                    .reduce();
        } catch(err) {
            console.error(err);
        }
    }
}

Mirror.init()
    //.then(() => Mirror.test())
    .then(() => Mirror.p_dev_mirror())
    .then(() => Mirror.debug("tested waiting for output"));
