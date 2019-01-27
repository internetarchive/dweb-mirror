#!/usr/bin/env node
// noinspection JSUnresolvedVariable
process.env.DEBUG="dweb-transports dweb-transports:* dweb-archivecontroller:* dweb-mirror:* parallel-streams:* dweb-objects dweb-objects:* dweb-mirror:HashStore";  // Get highest level debugging of these two libraries, must be before require(dweb-transports)
// TODO-MIRROR check using GUN for metadata

// noinspection JSUnusedLocalSymbols
const debug = require('debug')("dweb-mirror:crawl");
const getopts = require('getopts');
const canonicaljson = require('@stratumn/canonicaljson');
// Other IA repos
global.DwebTransports = require('@internetarchive/dweb-transports');
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names
// noinspection JSUnusedLocalSymbols
const AICUtil = require('@internetarchive/dweb-archivecontroller/Util'); // includes Object.filter etc
//This Repo
const config = require('./config');
// noinspection JSUnusedLocalSymbols
const ArchiveItem = require('./ArchiveItemPatched');
// noinspection JSUnusedLocalSymbols
const ArchiveFile = require('./ArchiveFilePatched');
const CrawlManager = require('./CrawlManager');

//TODO-DOCS TODO-API document command line and config file
const optsInt = ["depth",  "maxFileSize", "concurrency", "limitTotalTasks"]; // Not part of getopts, just documenting what aren't string or boolean
const optsArray = ["level", "transport", "rows"];

//XXX make depth max of depth, level-1, rows
//const opts = getopts("--rows 100 --depth 2 --dummy movies".split(" "),{ // Just for testing different options
const opts = getopts(process.argv.slice(2),{
    alias: { l: "level", r: "rows", h: "help", v: "verbose", d: "depth",
        "skipFetchFile":"skipfetchfile", "maxFileSize":"maxfilesize", "limitTotalTasks":"limittotaltasks", "copyDirectory":"copydirectory"},
    boolean: ["h","v", "skipFetchFile", "skipCache", "dummy"],
    //string: ["directory", "search", "related", "depth", "debugidentifier", "maxFileSize", "concurrency", "limitTotalTasks", "transport"],
    string: ["directory", "search", "related", "debugidentifier", "transport", "level"],
    default: {transport: "HTTP"},
    "unknown": option => { if (!optsInt.includes(option)) { console.log("Unknown option", option, ", 'crawl.js -h' for help"); process.exit()} }
});

const help = `
usage: crawl [-hv] [-l level] [-r rows] [ -d depth ] [--directory path] [--search json] [--related json]
    [--debugidentifier identifier] [--maxFileSize bytes] [--concurrency threads] [--limittotaltasks tasks] [--transport TRANSPORT]*
    [--skipfetchfile] [--skipcache] [--dummy] [identifier]*

    h : help print this text
    v : verbose tell us which config being run (default is currently pretty verbose)
    q : quiet (TODO implement this)
    l level : Crawl the identifiers to a certain level, valid values are:
                "tile"    for just enough to print a collection page, including the thumbnail image
                "metadata" and the full metadata, which will be useful once local search is implemented
                "details"  and enough to paint a page, including for example a lower bandwidth video
                "full"     and all the files in the item - beware, this can get very big.
    r rows           : overrides any (simple) search string to crawl this number of items
    d depth          : crawl collections found in this collection to a depth,
                       (0 is none, dont even crawl this collection, 1 is normal, 2 is collections in this collection
    --copydirectory path : Store a copy of the crawl in this directory (often used for a removable drive)
    --directory path : override the directory set in the configuration for the root of the cache
    --search json    : override default search string, strict json syntax only
    --related json   : override default settign for crawling related items, strict json syntax only
    --debugidentifier identifier : identifier to do extra debugging on, only really valuable when using an IDE
    --maxfilesize bytes : any file bigger than this will be ignored
    --concurrency threads : how many files or searches to be happening concurrently - use 1 for debugging, otherwise 10 is about right
    --limittotaltasks tasks : a maximum number of tasks to run, will be (approximately) the number of searches, plus the number of items crawled.
    --transport TRANSPORT : The names of transport to use, by default its HTTP, but can currenrly add IPFS, WEBTORRENT GUN, (TODO must currently be upper case - allow both)
    --skipfetchfile : Dont actually transfer the files (good for debugging)
    --skipcache     : Ignore current contents of cache and always refetch
    --dummy         : Just print the result of the options in the JSON format used for configuration

   identifier       : Zero or more identifiers to crawl (if none, then it will use the default query from the configuration)
   
   Examples:
    
   crawl.js prelinger # Gets the default crawl for the prelinger collection, (details on prelinger, then tiles for top 40 items in the collection and 6 related items)
   crawl.js --level details --rows 100 prelinger   # Would pull the top 100 items in prelinger (just the tiles)
   crawl.js --level all commute  # Fetches all the files in the commute item 
   
   Specifying level, or rows more than once will apply that result to the searches, so for example: 
   
   crawl.js --level details --rows 10 --level details prelinger # Gets the movies for the first 10 movies in prelinger
   crawl.js --level details --rows 100 --level tiles --rows 100 --level tiles movies # Gets the top 100 items in movies, and then crawls any of those items that are collections 
   crawl.js --rows 100 --depth 2 movies # Is a shortcut to do the same thing
   
    Running crawl with no options will run the default crawls in the configuration file with no modifications, which is good for example if running under cron.
`;
if (opts.help) { console.log(help); process.exit(); }

optsArray.forEach(key => {
    if ((typeof opts[key] === "undefined") || (opts[key] === "")) {
        opts[key] = [];
    } else if (!Array.isArray(opts[key])) {
        opts[key] = [ opts[key] ];
    }
});
// code cares about case for these opts
opts.transport = opts.transport.map(t=>t.toUpperCase());
opts.level = opts.level.map(t=>t.toLowerCase());
if (!opts.level.length) opts.level.push("details"); // Default is 1 level at details
if (!opts.rows.length) {
    opts.rows.push(
        ( CrawlManager._levels.indexOf(opts.level[0]) >= CrawlManager._levels.indexOf("details")
            ? ((config.apps.crawl.defaultDetailsSearch && config.apps.crawl.defaultDetailsSearch.rows) || 0)
            : 0)
    );
} // Default is whatever specified in default search

["search", "related"]
    .forEach(key => {
        if (opts[key].length) {
            try {
                opts[key] = canonicaljson.parse(opts[key]);
            } catch (err) {
                console.log("Invalid json in argument", key, "=", opts[key], err.message);
                process.exit();
            }
        } else {
            opts[key] = undefined;
        }
    });

if (opts.directory) {
    config.setOpts(Array.isArray(opts.directory) ? opts.directory : [opts.directory])
}
if (!config.directories.length) { console.log("Directory for the cache is not defined or doesnt exist"); process.exit();}
/* Not needed, just removed these from strings
[ "rows", "depth", "concurrency", "maxFileSize", "limitTotalTasks"]
    .forEach(key=> {
        opts[key] = (opts[key] && opts[key].length) ? parseInt(opts[key]) : undefined;
    });
*/
//TODO-CRAWL pass directory to CrawlManager

if (opts.search && (opts.rows || opts.depth)) {
    console.log("Cannot specify search with rows or depth argumenets"); process.exit();
}
let taskTemplate = { level: opts.level[0], related: opts.related };
function f(depthnow, depth) { // Recurses
    if (depth) {
        return Object.assign({}, opts.search || config.apps.crawl.defaultDetailsSearch,
            {level: opts.level[Math.min(depthnow+1,opts.level.length-1)], rows: opts.rows[Math.min(depthnow,opts.rows.length-1)], search: f(depthnow+1, depth -1)});
    } else {
        return undefined;
    }
}

taskTemplate.search = f(0, Math.max(opts.depth ||0, opts.level.length, opts.rows.length));


let tasks;
if (opts._.length) {
    tasks = opts._.map( identifier => Object.assign({}, taskTemplate, {identifier: identifier}));
} else {
    if (opts.rows || opts.depth || opts.search || opts.related ) {
        console.log("If specifying options then should also specify identifiers to crawl"); process.exit();
    }
    tasks = config.apps.crawl.tasks; // Default or configured tasks
}


const crawlopts = Object.assign({}, config.apps.crawl.opts, Object.filter(opts, (k,v)=> CrawlManager.optsallowed.includes(k) && (typeof v !== "undefined")));

if (opts.verbose || opts.dummy) {
    console.log( "Crawl configuration: tasks=", canonicaljson.stringify(tasks), "opts=", canonicaljson.stringify(crawlopts),
        "transports=", opts.transport);
}
if (!opts.dummy) {
    DwebTransports.connect({
        //transports: ["HTTP", "WEBTORRENT", "IPFS"],
        transports: opts.transport,
        //webtorrent: {tracker: { wrtc }}, //TODO-CRAWL TODO-TRANSPORTS see if this is needed / useful
    }, (unusederr, unused) => {
        //TODO-MIRROR this is working around default that HTTP doesnt officially support streams, till sure can use same interface with http & WT
        DwebTransports.http().supportFunctions.push("createReadStream");
        CrawlManager.startCrawl(tasks, crawlopts, (unusederr, unusedres) => {
            DwebTransports.p_stop(t => debug("%s is stopped", t.name))});
            // Note the callback doesn't get called for IPFS https://github.com/ipfs/js-ipfs/issues/1168
        });
}


