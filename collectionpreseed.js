//global.window = {}; // Target for things like window.onpopstate in Nav.js
process.env.DEBUG="express:* dweb-mirror:* parallel-streams:* dweb-transports dweb-transports:* dweb-objects dweb-objects:*";
const debug = require('debug');
const wrtc = require('wrtc');

global.DwebTransports = require('@internetarchive/dweb-transports');
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names

const MirrorCollection = require('./MirrorCollection.js');
const MirrorSearch = require('./MirrorSearch.js');
const ParallelStream = require('parallel-streams');

/* Collection crawl is a "eat your own dogfood" application to see whether this set of tools does what we need.
    Challenge - crawl the collections in the archive, dont mirror but trigger the metadata search so that the server preloads IPFS
 */



const config = {
    search: {
        //itemsperpage: 5;  // Unused - varied for each type of search
        //pagespersearch: 5; // Unused - varied for each type of search
        }, // Optimum is probably around 100
    collections: {
        "image": {},
        "movies": {},
        "texts": {},
        "audio": {},
    }
};


class Mirror {


    static async init() {
        //await HashStore.init(config.hashstore);
        Mirror.debug = debug('dweb-mirror:collectionpreseed')
    }
    /*
    static async test() {
        await HashStore.test();
    }
    */



    static async p_dev_mirror() {
        try {
            // Incremental development building and testing components to path in README.md
            await DwebTransports.p_connect({
                    transports: ["HTTP", "WEBTORRENT", "IPFS"],
                    webtorrent: {tracker: { wrtc }},
                }, false);
            //TODO-MIRROR this is working around default that HTTP doesnt officially support streams, till sure can use same interface with http & WT
            DwebTransports.http().supportFunctions.push("createReadStream");
            const paralleloptions = {limit: 5, silentwait: true};

                // Stream of ArchiveItems - which should all be collections
            const uniq = [];

            // noinspection JSUnusedLocalSymbols
            ParallelStream.from(Object.keys(config.collections), {name: "EatConfig"})
                .uniq(null, {uniq, name:"0 uniq"})

                .log((m) => ["Level1 queueing", m])
                .map((name) => new MirrorCollection({itemid: name}), {name: 'Create MirrorCollections 1'} )  // Initialize collection - doesnt get metadata or search results
                // Stream of ArchiveItems - which should all be collections
                // Note calls to fetch_metadata explicitly undefine the cacheDirectory since we want to re-crawl it and dont want to save it
                .map((collection, cb) => collection.fetch_metadata({skipCache: true}, cb),{name: "Collection fetchMeta level 1", async:true, paralleloptions} ) // Collections with metadata fetched
                .map((collection) => collection.streamResults({limit: 100, maxpages:1, skipCache: true}), {name: "Collection streamResults level 1", paralleloptions}) //, cacheDirectory: config.directory}))

                // Stream of arrays of Archive Items (mixed)
                .flatten({name: '1 flatten arrays of AI'})
                .filter((zz) => zz.mediatype === "collection", {name: '1 filter by collection'})
                .map((xx) => xx.identifier, {name: '1 identifier'})
                .uniq(null, {uniq, name:"1 uniq"})

                .log((m) => ["Level2 queueing", m])
                .map((name) => new MirrorCollection({itemid: name}), {name: 'Create MirrorCollections 2'} )  // Initialize collection - doesnt get metadata or search results
                // Stream of ArchiveItems - which should all be collections
                .map((collection, cb) => collection.fetch_metadata({skipCache: true}, cb),{name: "Collection fetchMeta level 2", async:true, paralleloptions} ) // Collections with metadata fetched
                .map((collection) => collection.streamResults({limit: 60, maxpages:1, skipCache: true}), {name: "Collection streamResults level 2", paralleloptions}) //, cacheDirectory: config.directory}))
                // Stream of arrays of Archive Items (mixed)
                .flatten({name: '2 flatten arrays of AI'})
                .filter((zz) => zz.mediatype === "collection", {name: '2 filter by collection'})
                .map((xx) => xx.identifier, {name: '2 identifier'})
                .uniq(null, {uniq, name:"2 uniq"})

                .log((m) => ["Level3 queueing:", m])
                .map((name) => new MirrorCollection({itemid: name}), {name: 'Create MirrorCollections 3'} )  // Initialize collection - doesnt get metadata or search results
                // Stream of ArchiveItems - which should all be collections
                .map((collection, cb) => collection.fetch_metadata({skipCache: true},cb),{name: "Collection fetchMeta level 3", async:true, paralleloptions} ) // Collections with metadata fetched
                .map((collection) => collection.streamResults({limit: 30, maxpages:1, skipCache: true}), {name: "Collection streamResults level 3", paralleloptions}) //, cacheDirectory: config.directory}))
                //IGNORED Stream of arrays of Archive Items (mixed)
                .reduce((a,v)=>(a+1),0,function(res){this.debug("Finished with %d",res);},{name: "END 3level"});
                //OBS .finish({init: ()=>this.count = 0, foreach: (data)=>this.count++, finally: ()=>this.debug("Finished with:",self.count), name: "END 3level"});
            const popularCollections = new MirrorSearch({
                query: 'mediatype:collection AND NOT _exists_:access-restricted',
                sort: '-downloads',
            });

            // noinspection JSUnusedLocalSymbols
            ParallelStream.from([popularCollections], {name: "EatPopularCollections"})
                .map((name) => new MirrorCollection({itemid: name}), {name: 'Create MirrorCollections popular top'} )  // Initialize collection - doesnt get metadata or search results
                .map((collection, cb) => collection.fetch_metadata({skipCache: true},cb),{name: "Collection fetchMeta popular top", async:true, paralleloptions} ) // Collections with metadata fetched
                .map((collection) => collection.streamResults({limit: 300, maxpages:1, skipCache: true}), {name: "Collection streamResults popular top", paralleloptions}) //, cacheDirectory: config.directory}))
                // Stream of arrays of ArchiveMembers (mixed)
                .flatten({name: '1 flatten arrays of AI'})
                .filter((zz) => zz.mediatype === "collection", {name: '1 filter by collection'})
                .map((xx) => xx.identifier, {name: '1 identifier'})
                .uniq(null, {name: "Popular uniq"}) // Use own uniq as going more items deep, but not recursing into subcollections
                .map((name) => new MirrorCollection({itemid: name}), {name: 'Create MirrorCollections popular'} )  // Initialize collection - doesnt get metadata or search results
                .map((collection, cb) => collection.fetch_metadata({skipCache: true}, cb),{name: "Collection fetchMeta popular", async:true, paralleloptions} ) // Collections with metadata fetched
                .map((collection) => collection.streamResults({limit: 100, maxpages:1, skipCache: true}), {name: "Collection streamResults popular", paralleloptions}) //, cacheDirectory: config.directory}))
                .reduce((a,v)=>(a+1),0,function(res){this.debug("Finished with %d",res);},{name: "END Popular"});
                //OBS .finish({init: ()=>this.count = 0, foreach: (data)=>this.count++, finally:()=>this.debug("Finished with: %d",self.count), name: "END Popular"});
            // No need to do something with these

        } catch(err) {
            console.error(err);
        }
    }

    // noinspection JSUnusedGlobalSymbols
    static async p_temp() { // Work area
        try {
            // Incremental development building and testing components to path in README.md
        } catch(err) {
            console.error(err);
        }
    }
}


Mirror.init()
    //.then(() => Mirror.test())
    .then(() => Mirror.p_dev_mirror())
    //.then(() => Mirror.p_temp())
    .then(() => Mirror.debug("tested waiting for output"));
