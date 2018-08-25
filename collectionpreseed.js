//global.window = {}; // Target for things like window.onpopstate in Nav.js
const wrtc = require('wrtc');

global.DwebTransports = require('@internetarchive/dweb-transports');
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names

const MirrorCollection = require('./MirrorCollection.js');
const MirrorCollectionSearchStream = require('./MirrorCollectionSearchStream');
const MirrorSearch = require('./MirrorSearch.js');
const ParallelStream = require('./ParallelStream.js');
const debug = require('debug');

/* Collection crawl is a "eat your own dogfood" application to see whether this set of tools does what we need.
    Challenge - crawl the collections in the archive, dont mirror but trigger the metadata search so that the server preloads IPFS
 */



var config = {
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
            let paralleloptions = {limit: 5, silentwait: false};

                // Stream of ArchiveItems - which should all be collections
            let uniq = [];

            ParallelStream.fromEdibleArray(Object.keys(config.collections), {name: "EatConfig"})
                .uniq(null, {uniq, name:"0 uniq"}))

                .log((m) => ["Level1 queueing", m]) //will display on MirrorCollectionSearchStream when processed
                .map((name) => new MirrorCollection({itemid: name}), {name: 'Create MirrorCollections 1'} )  // Initialize collection - doesnt get metadata or search results
                // Stream of ArchiveItems - which should all be collections
                .pipe(new MirrorCollectionSearchStream({name: "Collection Preseed level 1", limit: 100, maxpages: 1, paralleloptions}))
                // Stream of arrays of Archive Items (mixed)
                .flatten({name: '1 flatten arrays of AI'})
                .filter((zz) => zz.mediatype === "collection", {name: '1 filter by collection'})
                .map((xx) => xx.identifier, {name: '1 identifier'})
                .uniq(null, {uniq, name:"1 uniq"})

                .log((m) => ["Level2 queueing", m]) //will display on MirrorCollectionSearchStream when processed
                .map((name) => new MirrorCollection({itemid: name}), {name: 'Create MirrorCollections 2'} )  // Initialize collection - doesnt get metadata or search results
                // Stream of ArchiveItems - which should all be collections
                .pipe(new MirrorCollectionSearchStream({name: "Collection Preseed level 2", limit: 60, maxpages: 1, paralleloptions}))
                // Stream of arrays of Archive Items (mixed)
                .flatten({name: '2 flatten arrays of AI'})
                .filter((zz) => zz.mediatype === "collection", {name: '2 filter by collection'})
                .map((xx) => xx.identifier, {name: '2 identifier'})
                .uniq(null, {uniq, name:"2 uniq"}))


                .log((m) => ["Level3 queueing:", m])//will display on MirrorCollectionSearchStream when processed
                .map((name) => new MirrorCollection({itemid: name}), {name: 'Create MirrorCollections 3'} )  // Initialize collection - doesnt get metadata or search results
                // Stream of ArchiveItems - which should all be collections
                .pipe(new MirrorCollectionSearchStream({name: "Collection Preseed level 3", limit: 30, maxpages: 1, paralleloptions}))
                //IGNORED Stream of arrays of Archive Items (mixed)
                .end((self)=>self.count = 0, (data, self)=>self.count++, (self)=>console.log("Finished with:",self.count), {name: "END 3level"});

            let popularCollections = new MirrorSearch({
                query: 'mediatype:collection AND NOT _exists_:access-restricted',
                sort: '-downloads',
            });

            ParallelStream.fromEdibleArray([popularCollections], {name: "EatPopularCollections"})
                .pipe(new MirrorCollectionSearchStream({name: "Collection popular search", limit: 300, maxpages: 1, paralleloptions}))
                // Stream of arrays of Archive Items (mixed)
                .flatten({name: '1 flatten arrays of AI'})
                .filter((zz) => zz.mediatype === "collection", {name: '1 filter by collection'})
                .map((xx) => xx.identifier, {name: '1 identifier'})
                .uniq(null, {name: "Popular uniq"}) // Use own uniq as going more items deep, but not recursing into subcollections
                .map((name) => new MirrorCollection({itemid: name}), {name: 'Create MirrorCollections popular'} )  // Initialize collection - doesnt get metadata or search results
                .pipe(new MirrorCollectionSearchStream({name: "Collection Popular", limit: 100, maxpages: 1, paralleloptions}))
                .end((self)=>self.count = 0, (data, self)=>self.count++, (self)=>console.log("Finished with:",self.count), {name: "END Popular"});
            // No need to do something with these

        } catch(err) {
            console.error(err);
        }
    }

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
