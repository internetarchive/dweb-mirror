const debug = require('debug')("dweb-mirror:config");
const MirrorConfig = require('./MirrorConfig');
const MirrorFS = require('./MirrorFS');
const HashStore = require('./HashStore');

//TODO-CRAWL add concept of app specific overrides and default set
const config = new MirrorConfig({
    //hashstore: { file: "level_db" },
    //ui: {},
    //fs: {},

    // All these are from mirroring.js
    skipFetchFile: true, // Enable to stop it actually fetching the file - useful when testing
    directory: "/Users/mitra/temp/mirrored",    // Used by mirroring and mirrorHTTP
    archiveui: {
        directory: MirrorFS.firstExisting("../dweb-archive/dist", "node_modules/@internetarchive/dweb-archive/dist"),
    },
    apps: {
        http: {
            port: 4244,
            morgan: ':method :url :req[range] :status :res[content-length] :response-time ms',
        }
    },
    // Information about specific URLs for services at archive.org,
    archiveorg: {
        metadata: "https://dweb.me/arc/archive.org/metadata",
        servicesImg: "https://archive.org/services/img",
        related: "https://be-api.us.archive.org/mds/v1/get_related/all",
        mds: "https://be-api.us.archive.org/mds",
    },
    // Generic upstream server, should be able to parse urls like /arc or /contenthash
    upstream: "https://dweb.me"
});
// Dont edit anything from here on down
MirrorFS.hashstore = HashStore.init({dir: `${config.directory}/.hashStore.`}); // Note trailing period - will see files like <config.directory>/<config.hashstore><tablename>
debug("config summary: archiveui:%s",config.archiveui.directory);

exports = module.exports = config;
