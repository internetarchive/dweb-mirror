// Standard repos
const debug = require('debug')("dweb-mirror:config");
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const os = require('os')
// Other files in this repo
const MirrorConfig = require('./MirrorConfig');
const MirrorFS = require('./MirrorFS');
const HashStore = require('./HashStore');

// Note duplicates of this in config and crawl.js
function firstExisting(...args) {
    // Find the first of args that exists, args can be relative to the process directory .../dweb-mirror
    // returns undefined if none found
    // noinspection JSUnresolvedVariable
    return args.map(p=> p.startsWith("~/") ? path.resolve(os.homedir(), p.slice(2)) : path.resolve(process.cwd(), p)).find(p=>fs.existsSync(p));
}

const config = new MirrorConfig({
    // Cache directory - where you want to store files, this directory must already exist
    directory: firstExisting("~/temp/mirrored"),

    // Where to find the ArchiveUI relative to this directory
    archiveui: {
        directory: firstExisting(
            "../dweb-archive/dist",    // Try a repo cloned to a directory parallel to this one, which is presumably for development
            "node_modules/@internetarchive/dweb-archive/dist" // Or a repo cloned during 'npm install'
        ),
    },
    // The apps group include configuration only used by one application
    apps: {
        // mirrorHttp.js uses these
        http: {
            port: 4244,
            morgan: ':method :url :req[range] :status :res[content-length] :response-time ms',
        },
        // crawl.js uses these
        crawl: {
            // Default crawls if either search &| related are not unspecified but crawling an item with level=detail||full
            defaultDetailsSearch: {sort: "-downloads", rows: 40, level: "tile"},
            defaultDetailsRelated: {sort: "-downloads", rows: 6, level: "tile"},
            tasks: [
                { identifier: "prelinger", level: "details", search: [   // Fetch details for prelinger
                    {sort: "-downloads", rows: 3, level: "details"}, // Query first few items and get their details - by default will then crawl thumbnails and related
                    {sort: "-downloads", rows: 100, level: "tile"} // and next 2 items and get their thumbnails only
                    ] } ],
            opts: {
                maxFileSize: 200000000,
                concurrency: 10,                // No more than 10 tasks at a time (typically 10 open file downloads or searches
                limitTotalTasks: 300            // No more than 300 tasks total (typically one per item & file.
            },
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
