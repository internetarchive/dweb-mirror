process.env.DEBUG="dweb-transports dweb-transports:* dweb-archive dweb-objects dweb-mirror:* parallel-streams:*";  // Get highest level debugging of these two libraries, must be before require(dweb-transports)
// Standard repos
const wrtc = require('wrtc');
const debug = require('debug');

// Other IA repos
global.DwebTransports = require('@internetarchive/dweb-transports');
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names
// noinspection JSUnusedLocalSymbols
const ArchiveFile = require('./ArchiveFilePatched');
const ArchiveItem = require('./ArchiveItemPatched');

// Other files in this repo
const config = require('./config');
const MirrorCollection = require('./MirrorCollection.js');
const ParallelStream = require('parallel-streams');

//emitter.setMaxListeners(15); - for error message to fix this  but not sure what "emitter" is


class Mirror {

    static async init() {
        Mirror.debug = debug('dweb-mirror:mirroring')
        //await HashStore.init(config.hashstore);
    }
    // noinspection JSUnusedGlobalSymbols
    static async test() {
        await DwebTransports.p_connect({
            //transports: ["HTTP", "WEBTORRENT", "IPFS"],
            transports: ["HTTP"],
            webtorrent: {tracker: { wrtc }},
        });
        //TODO-MIRROR this is working around default that HTTP doesnt officially support streams, till sure can use same interface with http & WT
        DwebTransports.http().supportFunctions.push("createReadStream");
        ArchiveFile.p_new({itemid: "cd_tribal-flute_bryan-akipa", filename: "disc1/05. Bryan Akipa - Sad Heart.mp3"}, (err, af) => {
            console.assert(!err);
            // noinspection JSUnusedLocalSymbols
            // noinspection JSUnresolvedVariable
            af.checkShaAndSave({cacheDirectory: config.directory, skipfetchfile: config.skipfetchfile}, (err, af) => {
                console.log("Saved");
            })
        })
    }
    static async p_dev_mirror() {
        const paralleloptions = {limit: 5, silentwait: true};

        try {
            // Incremental development building and testing components to path in README.md
            await DwebTransports.p_connect({
                    transports: ["HTTP", "WEBTORRENT", "IPFS"],
                    webtorrent: {tracker: { wrtc }},
                });
            //TODO-MIRROR this is working around default that HTTP doesnt officially support streams, till sure can use same interface with http & WT
            DwebTransports.http().supportFunctions.push("createReadStream");
            // Total number of results will be ~ maxpages * limit
            // noinspection JSUnresolvedVariable
            ParallelStream.from(Object.keys(config.collections), {name: "Munching"})
            .log((m)=>[m], {name:"Collection"})
            .map((name) => new MirrorCollection({itemid: name}), {name: 'Create MirrorCollections'} )  // Initialize collection - doesnt get metadata or search results
            // Stream of arrays of Search results (minimal JSON) ready for fetching

            .map((collection, cb) => collection.fetch_metadata(cb),{name: "fetchMeta", async:true, paralleloptions} ) // Collections with metadata fetched
            .map((collection) => collection.streamResults({limit: config.search.itemsperpage, maxpages: config.search.pagespersearch})) //, cacheDirectory: config.directory}))

            // Stream of streams of Search results (minimal JSON) ready for fetching
            .log((s)=>s.name, {name:"Stream of Streams (Collection>SearchResults)"})
            .flatten({name: 'Flatten Streams to SearchResults'})
            // Stream of Search results (mixed)
            .log((m)=>[m.identifier], {name:"SearchResults"})

            .map((o) => new ArchiveItem({itemid: o.identifier}).fetch(), {name: "AI fetch", paralleloptions}) // Parallel metadata reads
            // a stream of ArchiveItem's with metadata fetched
            .map((ai, cb) => ai.save({cacheDirectory: config.directory}, cb), {name: "SaveItems", async: true, paralleloptions})
            .map((ai, cb) => ai.saveThumbnail({cacheDirectory: config.directory}, cb), {name: "SaveThumbnail", async: true, paralleloptions})
            .map(ai => config.filterlist(ai), {name: "List"}) // Figure out optimum set of items in case config chooses that.
            .flatten({name: "flatten files"})
            .filter(af => config.filter(af), {name: "filter"})  // Stream of ArchiveFiles matching criteria
            .slice(0,config.limittotalfiles, {name: `slice first ${config.limittotalfiles} files`}) // Stream of <limit ArchiveFiles
            .log((m)=>[ "%s/%s", m.itemid, m.metadata.name], {name: "FileResult"})
            .map((af, cb) => af.checkShaAndSave({cacheDirectory: config.directory, skipfetchfile: config.skipfetchfile}, (err, size)=> cb(err, {archivefile: af, size: size})), {name: "SaveFiles", async: true, paralleloptions})
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
