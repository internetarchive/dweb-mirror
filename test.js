// noinspection JSUnresolvedVariable
process.env.DEBUG="dweb-transports dweb-transports:* dweb-archivecontroller:* dweb-mirror:* parallel-streams:* dweb-objects dweb-objects:* dweb-mirror:HashStore";  // Get highest level debugging of these two libraries, must be before require(dweb-transports) //TODO-MIRROR check using GUN for metadata

// noinspection JSUnusedLocalSymbols
const debug = require('debug')("dweb-mirror:test");
// Other IA repos
// noinspection JSUndefinedPropertyAssignment
global.DwebTransports = require('@internetarchive/dweb-transports');
// noinspection JSUndefinedPropertyAssignment
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names
// noinspection JSUnusedLocalSymbols
const ArchiveItem = require('./ArchiveItemPatched');
// noinspection JSUnusedLocalSymbols
const ArchiveFile = require('./ArchiveFilePatched');
const MirrorConfig = require('./MirrorConfig');
const MirrorFS = require('./MirrorFS');
//This Repo
//TODO Add tests from each of the classes when/if they exist



// noinspection JSUnusedLocalSymbols


const HashStore = require('./HashStore');
//HashStore.test();
MirrorConfig.from((err, config) => {

// noinspection JSUnresolvedVariable
MirrorFS.init({directories: config.directories});
MirrorFS.loadHashTables({}, (err, res) => console.log(err, res));


/*
const CrawlManager = require('./CrawlManager');
// Also worth testing: fav-brewster, fav-mitra, ""
testCrawlEdgeCases = [
    { identifier: "ThePowerOfNightmares", level: "details", search: {rows: 100, sort: "-downloads", level: "details"}},
    { identifier: "@brenton", level: "details", search: {rows: 100, sort: "-downloads", level: "details"}}, // unidentified user
    { identifier: "fav-brewster", level: "details", search: {rows: 100, sort: "-downloads", level: "details"}}, // Contains SavedSearch, isDark, @brenton

]
testCrawl = [
    { identifier: "commute", level: "metadata" },
    { identifier: "prelinger", level: "details",
        related: { rows: 6, level: "tile"},
        search: [                     // Fetch details for prelinger
            { sort: "-downloads", rows: 5, level: "details" }   ,     // Query first 1 items and get their details - by default will then crawl thumbnails and related
            { sort: "-downloads", rows: 100, level: "tile" } ] },  // and next 2 items and get their thumbnails only
    { query: "Byron Bay", search: {rows: 10, level: "tile"}} // Note uses a bare query; doesnt crawl its thumbnail, and uses abbreviated search
];
testBrewster = [
    { identifier: "fav-brewster", level: "details", search: {rows: 100, sort: "-downloads", level: "details"}} // Contains SavedSearch, isDark, @brenton
]
testCrawlOne = [
    { identifier: "fav-brewster", level: "details", search: {rows: 100, sort: "-downloads", level: "details"}} // Contains SavedSearch, isDark, @brenton

]
testcrawlpreseed = [ //skipFetchFile, skipcache, mediatype: collection
    // Get the tiles for the top 30 items on the top 60 collections in the top 100 collections of each media type
    { identifier: ["image","movies","texts","audio"], level: "details",
        search: { rows: 2, level: "details", sort: "-downloads",
            search: { rows: 2, level: "details", sort: "-downloads",
                search: { rows: 2, level: "tile", sort: "-downloads" } } } },
    // Get the tiles for the top 100 items on the top 300 collections
    { query: "mediatype:collection AND NOT _exists_:access-restricted",
        search: { rows: 2, level: "details", sort: "-downloads",
            search: { rows: 2, level: "tile", sort: "-downloads" }}}
]


DwebTransports.connect({
    //transports: ["HTTP", "WEBTORRENT", "IPFS"],
    transports: ["HTTP"],
    //webtorrent: {tracker: { wrtc }},
}, (err, unused) => {
    //TODO-MIRROR this is working around default that HTTP doesnt officially support streams, till sure can use same interface with http & WT
    DwebTransports.http().supportFunctions.push("createReadStream");
    //CrawlManager.startCrawl(testCrawl, {skipFetchFile: true});
    CrawlManager.startCrawl(testCrawl,
        {debugidentifier: "Doctorin1946", skipFetchFile: false, skipCache: false, maxFileSize: 200000000, concurrency: 10, limitTotalTasks: 300,
         defaultDetailsSearch: config.apps.crawl.opts.defaultDetailsSearch,
         defaultDetailsRelated: config.apps.crawl.opts.defaultDetailsRelated,
        });
});
*/
});
