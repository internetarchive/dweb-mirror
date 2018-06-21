//global.window = {}; // Target for things like window.onpopstate in Nav.js
const stream = require('readable-stream');
global.DwebTransports = require('dweb-transports/index.js'); //TODO-MIRROR move to repo
global.DwebObjects = require('dweb-objects/index.js'); //Includes initializing support for names //TODO-MIRROR move to repo
const HashStore = require('./HashStore.js');
const MirrorItemFromStream = require('./MirrorItemFromStream.js');
const MirrorCollection = require('./MirrorCollection.js');
const MirrorFilesFromStream = require('./MirrorFilesFromStream.js');


config = {
    hashstore: { file: "level_db" },
    ui: {},
    fs: {},
};

class MirrorStreamDebug extends stream.Transform {

    constructor(options={}) {
        /* cb is function to turn item into something console.log can handle */
        let name = options.name || "Results";
        delete options.name;
        let map = options.map || function(m) { return m};   // A function to transform data, not normally used
        delete options.name;
        let log = options.log || function(m) { return [name, ":", m]};
        delete options.log;
        options.highWaterMark = options.highWaterMark || 99999; // Dont let this debugging cause backpressure itself
        options.objectMode = true;
        super(options);
        this.name = name;
        this.map = map;
        this.log = log;
    }
    _transform(data, encoding, cb) {    // A search result got written to this stream
        // TODO may be other kinds of things we want to accept a stream of
        if (typeof encoding === 'function') {
            cb = encoding;
            encoding = null;
        }
        try {
            console.log(...this.log(data));
            cb(null, this.map(data));
        } catch(err) {
            cb(err);
        }
    }
}
class Mirror {

    static async init() {
        await HashStore.init(config.hashstore);
    }
    static async test() {
        await HashStore.test();
    }
    static async p_dev_mirror() {
        try {
            global.verbose = false;
            // Incremental development building and testing components to path in README.md
            await DwebTransports.p_connect({transports: ["HTTP"]}, verbose);
            let itemid = "prelinger";
            // Total number of results will be ~ maxpages * limit
            let limit = 3;
            let maxpages = 3 ;
            new MirrorCollection({itemid})          // Initialize collection
                // Collection ready to search
                .s_searchitems({limit, maxpages})   // Repeatedly fetch new pages for the collection
                // a stream of Search results (minimal JSON) ready for fetching
                .pipe(new MirrorStreamDebug({log: (m)=>["SearchResult:", m.identifier]}))
                .pipe(new MirrorItemFromStream({highWaterMark: 3}))
                // a stream of ArchiveItem's with metadata fetched
                .pipe(new MirrorStreamDebug({log: (m)=>["ItemResult:", m.itemid]}))
                .pipe(new MirrorFilesFromStream({highWaterMark: 3}))
                .pipe(new MirrorStreamDebug({log: (m)=>["FileResult:", `${m.itemid}/${m.metadata.name}`]}))
                // a stream of ArchiveFiles's with metadata fetched

        } catch(err) {
            console.error(err);
        }
    }
}


Mirror.init();
//Mirror.test();
Mirror.p_dev_mirror();  // Async
console.log("tested waiting for output");
