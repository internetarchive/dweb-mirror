#!/usr/bin/env node
//global.window = {}; // Target for things like window.onpopstate in Nav.js
// noinspection JSUnresolvedVariable

// NOTE THERE WAS A VERSION OF THIS USING ParallelStream WHICH WAS OBSOLETED EARLY JAN 2018.

// Enable a LOT of debugging as want to watch to diagnose failures.
// noinspection JSUnresolvedVariable
process.env.DEBUG="dweb-transports dweb-transports:* dweb-mirror:* parallel-streams:* dweb-objects dweb-objects:* dweb-mirror:HashStore";  // Get highest level debugging of these two libraries, must be before require(dweb-transports)
// TODO-MIRROR check using GUN for metadata

// noinspection JSUnusedLocalSymbols
const debug = require('debug')("dweb-mirror:test");
// Other IA repos
global.DwebTransports = require('@internetarchive/dweb-transports');
// noinspection JSUndefinedPropertyAssignment
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names

//This Repo
// Load the patches to each of the classes so they cache - MirrorCache should do this, but just in case ...
// noinspection JSUnusedLocalSymbols
const ArchiveItem = require('./ArchiveItemPatched');
// noinspection JSUnusedLocalSymbols
const ArchiveFile = require('./ArchiveFilePatched');
const ArchiveMember = require('./ArchiveMemberPatched');
const MirrorConfig = require('./MirrorConfig');
const MirrorFS = require('./MirrorFS');
const CrawlManager = require('./CrawlManager');

const crawlTasks = [ //skipFetchFile, skipcache, mediatype: collection
    // Get the tiles for the top 60 items on the top 100 collections of each supported media type
    { identifier: ["image","movies","texts","audio"], level: "details",
        crawl: { rows: 100, level: "details", sort: "-downloads",
            crawl: { rows: 100, level: "tile", sort: "-downloads" } } },
    // Get the tiles for the top 100 items on the top 300 collections
    { query: "mediatype:collection AND NOT _exists_:access-restricted",
        crawl: { rows: 300, level: "details", sort: "-downloads",
            crawl: { rows: 100, level: "tile", sort: "-downloads" }}}
];

const crawlOptions = {
    skipFetchFile: true, // dont want the files, just want the gateway to push them into IPFS
    skipCache: true, // Dont care if we already have it cached, its the gateway we want to be seeding it anyway
    defaultDetailsSearch: {sort: "-downloads", rows: "40", level: "tile"}, // Not used, specified above
    defaultDetailsRelated: {sort: "-downloads", rows: "6", level: "tile"}, // Get tiles for 6 related on each, so details page will display
};

MirrorConfig.new((err, config) => {
    if (err) { debug("Exiting because of error", err.message);} else {
        MirrorFS.init({directories: config.directories, preferredStreamTransports: config.connect.preferredStreamTransports}); // Not passing in httpServer or urlUrlstore (check this wont disable IPFS but omitting IPFS transport will), we aren't using them here
        DwebTransports.connect({
            //transports: ["HTTP", "WEBTORRENT", "IPFS"],
            transports: ["HTTP"],
            //webtorrent: {tracker: { wrtc }},
        }, (unusederr, unused) => {
            //TODO-MIRROR this is working around default that HTTP doesnt officially support streams, till sure can use same interface with http & WT
            CrawlManager.startCrawl(crawlTasks, crawlOptions, (unusederr, unusedres) => {
                DwebTransports.p_stop(t => debug("%s is stopped", t.name))});
            // Note the callback doesn't get called for IPFS https://github.com/ipfs/js-ipfs/issues/1168
        });
    }
} );


