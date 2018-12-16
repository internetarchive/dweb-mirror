const debug = require('debug')("dweb-mirror:config");
const MirrorConfig = require('./MirrorConfig');
const MirrorFS = require('./MirrorFS');
const HashStore = require('./HashStore');

//TODO-CONFIG add concept of app specific overrides and default set
const config = new MirrorConfig({
    //hashstore: { file: "level_db" },
    //ui: {},
    //fs: {},

    // All these are from mirroring.js
    skipfetchfile: false, // Enable to stop it actually fetching the file - useful when testing
    directory: "/Users/mitra/temp/mirrored",    // Used by mirroring and mirrorHTTP
    archiveui: {
        directory: MirrorFS.firstExisting("../dweb-archive/dist", "node_modules/@internetarchive/dweb-archive/dist"),
    },
    limittotalfiles: 250,   // Maximum number of files to consider retrieving (will further filter if unchanged)
    search: {
        itemsperpage: 100, // Optimum is probably around 100,
        pagespersearch: 1, // If want > 100 files per collection then increase this number
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
        //"fav-brewster": {},
    },
    apps: {
        http: {
            port: 4244,
            morgan: ':method :url :req[range] :status :res[content-length] :response-time ms',
        }
    },
    archiveorg: {
        metadata: "https://dweb.me/arc/archive.org/metadata",
        servicesImg: "https://archive.org/services/img/",           // TODO check intentionality of trailing slash, and ideally remove
        related: "https://be-api.us.archive.org/mds/v1/get_related/all",
        mds: "https://be-api.us.archive.org/mds",
    },
    upstream: "https://dweb.me"    // Generic upstream server, should be able to parse urls like /arc or /contenthash
});
// Dont edit anything from here on down
MirrorFS.hashstore = HashStore.init({dir: `${config.directory}/.hashStore.`}); // Note trailing period - will see files like <config.directory>/<config.hashstore><tablename>
debug("config summary: archiveui:%s",config.archiveui.directory)

exports = module.exports = config;
