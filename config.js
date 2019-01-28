// Standard repos
const debug = require('debug')("dweb-mirror:config");
// Other files in this repo
const MirrorConfig = require('./MirrorConfig');

// Note duplicates of this in config and crawl.js

const config = new MirrorConfig({

//============== Dont edit anything above here ============================
    // Cache directory - where you want to store files, this directory must already exist
    // List of places to look for the Cache directory - will check all of them, and they don't need to exist
    // Paths can include unix conventions like ~ * . .. etc
    // Default is to look in home directory and root of any device (for example a USB) for directories "archiveorg"
    directories: ["~/archiveorg", "/Volumes/*/archiveorg"],

    archiveui: {
        // Where to find the ArchiveUI relative to the directory this file and the code resides in
        directories: [  // Note code uses "directory" which is first of these to exist.
            "../dweb-archive/dist",    // Try a repo cloned to a directory parallel to this one, which is presumably for development
            "node_modules/@internetarchive/dweb-archive/dist" // Or a repo cloned during 'npm install'
        ],
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
            // An array of tasks each consists of { identifier, level, and optional search & related
            // level is one of:
            //      tile:       sufficient to draw Tile in its parent;
            //      metadata:   including metadata info (not often used);
            //      details:    enough to render a page, including e.g. low res video
            //      all:        all files in the item - beware this can be large
            // search & related consists of sort: (only -downloads supported at present), rows: how many items to retrieve;
            //      level, search & related inside another search or related applies to the items retrieved by that search/related and nests indefinately.
            tasks: [
                { identifier: "prelinger", level: "details", search: [   // Fetch details for prelinger
                    {sort: "-downloads", rows: 3, level: "details"}, // Query first few items and get their details - by default will then crawl thumbnails and related
                    {sort: "-downloads", rows: 100, level: "tile"} // and next 2 items and get their thumbnails only
                    ] } ],
            // opts controls how the search performs
            opts: {
                concurrency: 10,                // No more than this many tasks at a time (typically 10 open file downloads or searches
                limitTotalTasks: 300,           // No more than this many tasks total (typically one per item & file.
                maxFileSize: 200000000,         // Maximum size of any file retrieved
                skipCache: false,               // Set to true to ignore current cache contents, this is used to force the upstream server to look at each item and cache it
                skipFetchFile: false,           // Set to true to ignore actually fething files, most often used for debugging
                copyDirectory: "/Volumes/Transcend/test2", // Testing only
            },
        }
    },
//============== Dont edit anything from here on down ============================

    // Information about specific URLs for services at archive.org, - should not need changing
    archiveorg: {
        metadata: "https://dweb.me/arc/archive.org/metadata",
        servicesImg: "https://archive.org/services/img",
        related: "https://be-api.us.archive.org/mds/v1/get_related/all",
        mds: "https://be-api.us.archive.org/mds",
    },
    // Generic upstream server, should be able to parse urls like /arc or /contenthash - should not need changing
    upstream: "https://dweb.me"


});
debug("config summary: directory:%o archiveui:%s", config.directories, config.archiveui.directory);

exports = module.exports = config;
