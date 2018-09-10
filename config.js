const MirrorConfig = require('./MirrorConfig');

//TODO add concept of app specific overrides and default set
const config = new MirrorConfig({
    //hashstore: { file: "level_db" },
    //ui: {},
    //fs: {},

    // All these are from mirroring.js
    skipfetchfile: true, // Enable to stop it actually fetching the file - useful when testing
    directory: "/Users/mitra/temp/mirrored",    // Used by mirroring and mirrorHTTP
    limittotalfiles: 250,   // Maximum number of files to consider retrieving (will further filter if unchanged)
    search: {
        itemsperpage: 2, // Optimum is probably around 100,
        pagespersearch: 2
    },
    file: {
        maxfilesize: 100000000
    },
    item: {
        minimumForUi: true
    },
    collections: {
        "prelinger": {},
        //"fav-mitra": {},
    },
    apps: {
        http: {
            port: 4244,
        }
    }
});


exports = module.exports = config;