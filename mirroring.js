//global.window = {}; // Target for things like window.onpopstate in Nav.js
global.DwebTransports = require('dweb-transports/index.js'); //TODO-MIRROR move to repo
global.DwebObjects = require('dweb-objects/index.js'); //Includes initializing support for names //TODO-MIRROR move to repo
const HashStore = require('./HashStore.js');
const MirrorItemFromStream = require('./MirrorItemFromStream.js');
const MirrorCollection = require('./MirrorCollection.js');


config = {
    hashstore: { file: "level_db" },
    ui: {},
    fs: {},
};

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
            let limit = 10;
            let maxpages = 3 ;
            let col = new MirrorCollection({itemid});
            let mifs = new MirrorItemFromStream({highWaterMark: 6});
            let through = await col.crawl_stream({limit, maxpages});
            through.pipe(mifs);
            mifs.on('data', (data) => { console.log("Got",data.itemid); });
            mifs.on('end', () => console.log("ENDING"));
        } catch(err) {
            console.error(err);
        }
    }
}


Mirror.init();
//Mirror.test();
Mirror.p_dev_mirror();  // Async
console.log("tested waiting for output");
