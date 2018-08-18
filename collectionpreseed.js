//global.window = {}; // Target for things like window.onpopstate in Nav.js
const wrtc = require('wrtc');

global.DwebTransports = require('@internetarchive/dweb-transports');
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names

const MirrorCollection = require('./MirrorCollection.js');
const MirrorCollectionSearchStream = require('./MirrorCollectionSearchStream');
const MirrorSearch = require('./MirrorSearch.js');
const s = require('./StreamTools.js');



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
            let parallel = 5;

                // Stream of ArchiveItems - which should all be collections
            let uniq = [];

            new s({name: "EatConfig"}).fromEdibleArray(Object.keys(config.collections))
                .pipe(new s({uniq}).uniq({name:"0 uniq"}))

                .pipe(new s().log((m) => ["Level1 queueing", m])) //will display on MirrorCollectionSearchStream when processed
                .pipe(new s({name: 'Create MirrorCollections 1'}).map((name) => new MirrorCollection({itemid: name}) ))  // Initialize collection - doesnt get metadata or search results
                // Stream of ArchiveItems - which should all be collections
                .pipe(new MirrorCollectionSearchStream({name: "Collection Preseed level 1", limit: 100, maxpages: 1, parallel, silentwait: false}))
                // Stream of arrays of Archive Items (mixed)
                .pipe(new s({name: '1 split arrays of AI'}).split())
                .pipe(new s({name: '1 filter by collection'}).filter((zz) => zz.mediatype === "collection"))
                .pipe(new s({name: '1 identifier'}).map((xx) => xx.identifier))
                .pipe(new s({uniq}).uniq({name:"1 uniq"}))

                .pipe(new s().log((m) => ["Level2 queueing", m])) //will display on MirrorCollectionSearchStream when processed
                .pipe(new s({name: 'Create MirrorCollections 2'}).map((name) => new MirrorCollection({itemid: name}) ))  // Initialize collection - doesnt get metadata or search results
                // Stream of ArchiveItems - which should all be collections
                .pipe(new MirrorCollectionSearchStream({name: "Collection Preseed level 2", limit: 60, maxpages: 1, parallel, silentwait: false}))
                // Stream of arrays of Archive Items (mixed)
                .pipe(new s({name: '2 split arrays of AI'}).split())
                .pipe(new s({name: '2 filter by collection'}).filter((zz) => zz.mediatype === "collection"))
                .pipe(new s({name: '2 identifier'}).map((xx) => xx.identifier))
                .pipe(new s({uniq}).uniq({name:"2 uniq"}))


                .pipe(new s().log((m) => ["Level3 queueing:", m])) //will display on MirrorCollectionSearchStream when processed
                .pipe(new s({name: 'Create MirrorCollections 3'}).map((name) => new MirrorCollection({itemid: name}) ))  // Initialize collection - doesnt get metadata or search results
                // Stream of ArchiveItems - which should all be collections
                .pipe(new MirrorCollectionSearchStream({name: "Collection Preseed level 3", limit: 30, maxpages: 1, parallel, silentwait: false}))
                //IGNORED Stream of arrays of Archive Items (mixed)
                .pipe(new s({name: "END 3level"}).end((self)=>self.count = 0, (data, self)=>self.count++, (self)=>console.log("Finished with:",self.count)));

            let popularCollections = new MirrorSearch({
                query: 'mediatype:collection AND NOT _exists_:access-restricted',
                sort: '-downloads',
            });

            new s({name: "EatPopularCollections"}).fromEdibleArray([popularCollections])
                .pipe(new MirrorCollectionSearchStream({name: "Collection popular search", limit: 300, maxpages: 1, parallel, silentwait: false}))
                // Stream of arrays of Archive Items (mixed)
                .pipe(new s({name: '1 split arrays of AI'}).split())
                .pipe(new s({name: '1 filter by collection'}).filter((zz) => zz.mediatype === "collection"))
                .pipe(new s({name: '1 identifier'}).map((xx) => xx.identifier))
                .pipe(new s().uniq()) // Use own uniq as going more items deep, but not recursing into subcollections
                .pipe(new s({name: 'Create MirrorCollections popular'}).map((name) => new MirrorCollection({itemid: name}) ))  // Initialize collection - doesnt get metadata or search results
                .pipe(new MirrorCollectionSearchStream({name: "Collection Popular", limit: 100, maxpages: 1, parallel, silentwait: false}))
                .pipe(new s({name: "END Popular"}).end((self)=>self.count = 0, (data, self)=>self.count++, (self)=>console.log("Finished with:",self.count)));
            // No need to do something with these

        } catch(err) {
            console.error(err);
        }
    }

    static async p_temp() { // Work area
        try {
            global.verbose = false;
            // Incremental development building and testing components to path in README.md
            new s({name: "EatConfig"}).fromEdibleArray(Object.keys(config.collections))
                .pipe(new s().log((m) => ["C", m]))
        } catch(err) {
            console.error(err);
        }
    }
}


Mirror.init()
    //.then(() => Mirror.test())
    .then(() => Mirror.p_dev_mirror())
    //.then(() => Mirror.p_temp())
    .then(() => console.log("tested waiting for output"));
