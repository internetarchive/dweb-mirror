const MirrorConfig = require('./MirrorConfig');

//TODO add concept of app specific overrides and default set
const config = new MirrorConfig({
    //hashstore: { file: "level_db" },
    //ui: {},
    //fs: {},

    // All these are from mirroring.js
    skipfetchfile: false, // Enable to stop it actually fetching the file - useful when testing
    directory: "/Users/mitra/temp/mirrored",    // Used by mirroring and mirrorHTTP
    limittotalfiles: 250,   // Maximum number of files to consider retrieving (will further filter if unchanged)
    search: {
        itemsperpage: 20, // Optimum is probably around 100,
        pagespersearch: 1, // If want > 100 files per collection then increase this number
    },
    file: {
        //maxfilesize: 100000000
        maxfilesize: 200000, // Testing - only small files, will catch breath_takers_2/breath_takers_2.gif
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