const MirrorConfig = require('./MirrorConfig');

//TODO add concept of app specific overrides and default set
const config = new MirrorConfig({
    //hashstore: { file: "level_db" },
    //ui: {},
    //fs: {},

    // All these are from mirroring.js
    skipfetchfile: false, // Enable to stop it actually fetching the file - useful when testing
    directory: "/Users/mitra/temp/mirrored",    // Used by mirroring and mirrorHTTP
    archiveui: {
        directory: "/Users/mitra/git/dweb-archive/dist", // TODO - move to process.cwd()+"/node_modules/dweb-archive/dist"
    },
    limittotalfiles: 250,   // Maximum number of files to consider retrieving (will further filter if unchanged)
    search: {
        itemsperpage: 20, // Optimum is probably around 100,
        pagespersearch: 2, // If want > 100 files per collection then increase this number
    },
    file: {
        maxfilesize: 100000000
        //maxfilesize: 200000, // Testing - only small files, will catch breath_takers_2/breath_takers_2.gif
    },
    item: {
        minimumForUi: true
    },
    collections: {
        //"prelinger": {},
        "fav-mitra": {},
        //"commute": {},
    },
    apps: {
        http: {
            port: 4244,
            morgan: ':method :url :req[range] :status :res[content-length] :response-time ms',
        }
    },
    archiveorg: {
        metadata: "https://dweb.me/arc/archive.org/metadata",
        servicesImg: "https://archive.org/services/img/",
        related: "https://be-api.us.archive.org/mds/v1/get_related/all",
        mds: "https://be-api.us.archive.org/mds",
    }
});


exports = module.exports = config;