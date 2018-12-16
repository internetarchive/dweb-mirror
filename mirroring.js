#!/usr/bin/env node
process.env.DEBUG="dweb-transports dweb-transports:* dweb-archive dweb-archive-controller dweb-objects dweb-mirror:* parallel-streams:*";  // Get highest level debugging of these two libraries, must be before require(dweb-transports)
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
        ArchiveFile.new({itemid: "cd_tribal-flute_bryan-akipa", filename: "disc1/05. Bryan Akipa - Sad Heart.mp3"}, (err, af) => {
            console.assert(!err);
            // noinspection JSUnusedLocalSymbols
            // noinspection JSUnresolvedVariable
            af.cacheAndOrStream({cacheDirectory: config.directory, skipfetchfile: config.skipfetchfile}, (err, unused)=>{
                if (err) { console.err("failed to save", err)}
                else { console.log("Saved"); }
            })
        })
    }
    static async p_dev_mirror() {
        //TODO-CACHE-MULTI check for presence of metadata directories, and fail gracefully.
        const paralleloptions = {limit: 5, silentwait: true};

        try {
            // Incremental development building and testing components to path in README.md
            await DwebTransports.p_connect({
                    //transports: ["HTTP", "WEBTORRENT", "IPFS"],
                    transports: ["HTTP"],
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

            .map((collection, cb) => collection.save({cacheDirectory: config.directory}, cb), {name: "SaveCollection", async: true, paralleloptions})
            .map((collection, cb) => collection.saveThumbnail({cacheDirectory: config.directory}, cb), {name: "SaveCollectionThumbnail", justReportError: true, async: true, paralleloptions})
            .map((collection) => collection.streamResults({limit: config.search.itemsperpage, maxpages: config.search.pagespersearch}), {name: "streamResults"}) //, cacheDirectory: config.directory}))
            // Stream of streams of Search results (minimal JSON) ready for fetching
            .log((s)=>s.name, {name:"Stream of Streams (Collection>SearchResults)"})
            .flatten({name: 'Flatten Streams to SearchResults'})
                // This block is just for testing and TODO can be deleted.
                //.log((m)=>[m.identifier], {name:"XXXSearchResults"})
                //.filter(m => m.identifier === "commute", {name:"Filter for test case"})
                //.log((m)=>[m.identifier], {name:"XYZSearchResults"})
                //.map(m => { if (m.identifier === "commute")  m.identifier = "@brenton"; return m }, {name:"Fake for test case @brenton"}) // TODO-XXX Just for debugging
            // Stream of Search results (mixed)
            .log((m)=>[m.identifier], {name:"SearchResults"})
            // This next line will fail, and skip if item doesnt exist or is unfetchable (e.g. @foo where foo doesnt exist)
            .map((o) => ArchiveItem.fromMemberFav(o).fetch(), {name: "AI fetch", paralleloptions}) // Parallel metadata reads, note will get first page of results if collection
            // a stream of ArchiveItem's with metadata fetched
            .map((ai, cb) => ai.save({cacheDirectory: config.directory}, cb), {name: "SaveItems", async: true, paralleloptions})
            .map((ai, cb) => ai.saveThumbnail({cacheDirectory: config.directory}, cb), {name: "SaveThumbnail", justReportError: true, async: true, paralleloptions})
            .map(ai => config.filterlist(ai), {name: "List"}) // Figure out optimum set of items in case config chooses that.
            .flatten({name: "flatten files"})
            .filter(af => config.filter(af), {name: "filter"})  // Stream of ArchiveFiles matching criteria
            .slice(0,config.limittotalfiles, {name: `slice first ${config.limittotalfiles} files`}) // Stream of <limit ArchiveFiles
            .log((m)=>[ "%s/%s", m.itemid, m.metadata.name], {name: "FileResult"})
            .map((af, cb) => af.cacheAndOrStream({cacheDirectory: config.directory, skipfetchfile: config.skipfetchfile}, cb), {name: "SaveFiles", async: true, paralleloptions, verbose: true})

            .reduce({name: "END OF MIRRORING"});
        } catch(err) {
            console.error(err);
        }
    }
}

Mirror.init()
    //.then(() => Mirror.test())
    .then(() => Mirror.p_dev_mirror())
    .then(() => Mirror.debug("tested waiting for output"));
