const queue = require('async/queue');
const waterfall = require('async/waterfall');
const each = require('async/each');
//const eachSeries = require('async/eachSeries');
const debug = require('debug')('dweb-mirror:CrawlManager');

const AICUtil = require('@internetarchive/dweb-archivecontroller/Util'); // includes Object.filter etc
const config = require('./config');
const ArchiveItem = require('./ArchiveItemPatched');
const ArchiveFile = require('./ArchiveFilePatched');
const ArchiveMember = require('./ArchiveMemberPatched');
const ArchiveMemberSearch = require('./ArchiveMemberSearchPatched');
/*
  Manage crawls

  crawlOpts {
    identifier: "foo",
    level: "tile" || "metadata" || "details",   // tile is sufficient to display in a search/collection, metadata is that + info; details is sufficient to display in details page (incs related); all
    search: [ { sort, rows, level } ]

  opts {
    skipCache: bool||false      If true will ignore the cache, this is useful to make sure hits server to ensure it precaches/pushes to IPFS etc
    skipFetchFile: bool||false  If true will just comment on file, not actually fetch it (including thumbnails)
    maxFileSize: 10000000       If set, constrains maximum size of any one file

  Example initialization:
  search([
  { identifier: "foo", level: "metadata" }
  { identifier: "prelinger", level: "details", search: [                     // Fetch details for prelinger
        { sort: "-downloads", rows: 100, level: "details" }        // Query first 100 items and get their details
        { sort: "-downloads", rows: 200, level: "tile" } ] }  // and next 200 items and get their thumbnails only
  ]


 */

//TODO-CRAWL TODO-API document this
//TODO may want to add way to specify certain media types only (in search{}?) but do not currently have an application for that.
//See collectionpreseed.js for example using this to do a nested crawl to force server to preseed.
//TODO-CRAWL add command line arguments and build into crawl.js

class CrawlManager {

    constructor({debugidentifier=undefined, skipFetchFile=false, skipCache=false, maxFileSize=undefined, concurrency=1, limitTotalTasks=undefined}={}) {
        this._uniqItems = {};
        this._uniqFiles = {}; // This is actually needed since an Item might be crawled a second time at a deeper level
        this.errors = [];
        this.setopts({debugidentifier, skipFetchFile, skipCache, maxFileSize, concurrency, limitTotalTasks});
        this.completed = 0;
        this.pushedCount = 0;
        this._taskQ = queue((task, cb) => {
            task.process((err)=> {
                this.completed++;
                if (err) this.errors.push({task: task, error: err});
                cb(err);
            }); //Task should be an instance of a class with a process method
        }, this.concurrency);
        this._taskQ.drain = () => this.drained.call(this);
        this.defaultDetailsSearch = config.apps.crawl.defaultDetailsSearch;
        this.defaultDetailsRelated = config.apps.crawl.defaultDetailsRelated;
    }
    push(task) {
        //TODO-CRAWL check completed count
        if (!this.limitTotalTasks || (this.pushedCount <= this.limitTotalTasks)) {
            this._taskQ.push(task);
        } else {
            debug("Skipping %s as reached maximum of %d tasks", task.debugname, this.limitTotalTasks)
        }
    }
    setopts(opts={}) {
        Object.entries(opts).forEach(kv => this[kv[0]] = kv[1]);
        if (opts.concurrency && this._taskQ) this._taskQ.concurrency = opts.concurrency; // _tasQ already started, but can modify it
    }
    static startCrawl(initialItemTaskList, {debugidentifier=undefined, skipFetchFile=false, skipCache=false, maxFileSize=undefined, concurrency=1, limitTotalTasks=undefined}={}, cb) {
        const parent = [];
        const CM = CrawlManager.cm; //TODO for now just one instance - if want multiple simultaneous crawls will need to pass as parameter to tasks.
        CM.setopts({debugidentifier, skipFetchFile, skipCache, maxFileSize, concurrency, limitTotalTasks})
        CM.debugidentifier = "AboutBan1935"; //used to trigger breakpoints in Mitra's IDE - should normally be commented out, but doesnt hurt if left.
        debug("Starting crawl %d tasks opts=%o", initialItemTaskList.length,
            Object.filter(CM, (k,v) =>  v && this.optsallowed.includes(k)));
        initialItemTaskList.forEach( task => {
            if (Array.isArray(task.identifier)) {
                CM.push(task.identifier.map(identifier => new CrawlItem(Object.assign({},  task, {identifier}), parent)));
            } else {
                CM.push(new CrawlItem(task, parent));
            }
        });
        CM.drainedCb = cb;
    }
    drained() {
        debug("Crawl finished %d tasks with %d errors", this.completed, this.errors.length)
        this.errors.forEach(e => debug("ERR:%o %s %o %o %s",
            e.task.parent.concat(e.task.debugname), e.task.level, e.task.search || "", e.task.related || "", e.error.message))
        if (this.drainedCb) this.drainedCb()
    }
}
CrawlManager._levels = ["tile", "metadata", "details", "all"];
CrawlManager.cm = new CrawlManager();   // For now there is only one CrawlManager, at some point might start passing as a parameter to tasks.
CrawlManager.optsallowed = ["debugidentifier", "skipFetchFile", "skipCache", "maxFileSize", "concurrency", "limitTotalTasks"];
// q.drain = function() { console.log('all items have been processed'); }; // assign a callback *
// q.push({name: 'foo'}, function(err) { console.log('finished processing foo'); }); // add some items to the queue
// q.push([{name: 'baz'},{name: 'bay'},{name: 'bax'}], function(err) { console.log('finished processing item'); }); // add some items to the queue (batch-wise)
// q.unshift({name: 'bar'}, function (err) { console.log('finished processing bar'); });// add some items to the front of the queue

//TODO-CRAWL - check existing config.js for anything no longer doing (e.g. maxFileSize still needed)

class Crawlable {
    constructor(debugname, parent) {
        // Nothing done here at present
        this.debugname = debugname; // Used to display messages
        this.parent = parent;       // Used to display path thru crawl to this task
    }
    asParent() {
        return this.parent.concat(this.debugname)
    }
}

class CrawlFile extends Crawlable {
    constructor({file}, parent) {
        super(file.metadata.name, parent);
        this.file = file;
    }
    process(cb) {
        if (this.isUniq()) {
            if (!(CrawlManager.cm.maxFileSize && (parseInt(this.file.metadata.size) > CrawlManager.cm.maxFileSize))) {
                debug('Processing "%s" File via %o', this.file.metadata.name, this.parent); // Parent includes identifier
                const skipFetchFile = CrawlManager.cm.skipFetchFile;
                const cacheDirectory = config.directory; //TODO-MULTI TODO-CRAWL this becomes part of the config for each subset to be crawled
                this.file.cacheAndOrStream({ //TODO-CRAWL check if have access to size here, to compare to maxFileSize
                    cacheDirectory,
                    skipFetchFile,
                    wantStream: false,
                    start: 0,
                    end: undefined,
                }, cb);
            } else {
                debug('Skipping "%s" File via %o, size %d > %d', this.file.metadata.name, this.parent, this.file.metadata.size, CrawlManager.cm.maxFileSize );
                cb();
            }
        } else {
            cb();
        }
    }
    isUniq() {
        const key = [this.file.itemid,this.file.metadata.name].join('/');
        const prevTasks = CrawlManager.cm._uniqFiles[key];
        if (prevTasks) { return false; }
        else {
            CrawlManager.cm._uniqFiles[key] = this;
            return true;
        }
    }
}

class CrawlItem extends Crawlable {
    constructor({identifier = undefined, query = undefined, level = undefined, member = undefined, related=undefined, search = undefined}={}, parent) {
        super(identifier || query, parent);
        this.identifier = identifier;
        this.level = level;
        this.member = member;
        this.query = query;
        this.search = search;
        this.related = related;
        if (this.identifier === "/" || (this.identifier === "" && !this.query)) {
            this.identifier = ""; this.debugname = "HOME"; this.query = AICUtil.homeQuery;
        }
        if ( ["details","full"].includes(this.level)) {
            if (!this.search)    this.search = CrawlManager.cm.defaultDetailsSearch;
            if (!this.related)  this.related = CrawlManager.cm.defaultDetailsRelated;
        }
    }

    static fromSearchMember(member, taskparms, parent) {
        // create a new CrawlItem and add to taskQ
        // Handles weird saved-searches in fav-xxx
        return new CrawlItem({
            identifier: member.mediatype === "search" ? undefined : member.identifier,  //TODO these (see other copy as well) may fail on the saved search in fav-brewster ("united nations" I think)
            member: member,
            level: taskparms.level,
            search: taskparms.search,
            related: taskparms.related,
            query: member.mediatype === "search" ? member.identifier : undefined,
        }, parent);
    }
    _searchPageLessThanOrEqual(page1, page2) {
        return !page1 ||
            ( page2
            && page1.sort === page2.sort
            && page1.rows === page2.rows
            && CrawlManager._levels.indexOf(page1.level) <= CrawlManager._levels.indexOf(page2.level)
            && this._searchLessThanOrEqual(page1.search, page2.search)
            && this._relatedLessThanOrEqual(page1.related, page2.related)
            );
    }
    _relatedLessThanOrEqual(rel1, rel2) {
        return !rel1 ||
            ( rel2
                && page1.rows <= page2.rows
                && CrawlManager._levels.indexOf(rel1.level) <= CrawlManager._levels.indexOf(rel2.level)
                && this._searchLessThanOrEqual(rel1.search, rel2.search)
                && this._relatedLessThanOrEqual(rel1.related, rel2.related)
            );
    }
    _searchLessThanOrEqual(search1, search2) {
        return  !search1 ||
            ( search2
            && search1.length <= search2.length
            && search1.all( (page,pageNo) => this._searchPageLessThanOrEqual(page, search2[pageNo])));
    }
    _lessThanOrEqual(task) {
        // return true if this.task is greater (more in depth) than task
        return (CrawlManager._levels.indexOf(this.level) <= CrawlManager._levels.indexOf(task.level))
        && this._searchLessThanOrEqual(this.search, task.search)
        && this._relatedLessThanOrEqual(this.related, task.related)
    }
    isUniq() {
        const key = this.item._namepart()
        const prevTasks = CrawlManager.cm._uniqItems[key];
        if (prevTasks) {
            if (prevTasks.some(task => this._lessThanOrEqual(task))) { // At least one task covered all material in this task
                return false;
            } else {
                CrawlManager.cm._uniqItems[key].push({level: this.level, search: this.search});
                return true;
            }
        } else {
            CrawlManager.cm._uniqItems[key] = [{level: this.level, search: this.search}]; // Explicitly not caching ArchiveItem as could get large inmemory
            return true;
        }
    }
    process(cb) {
        debug('CrawlManager: processing "%s" %s via %o %o', this.debugname, this.level,  this.parent,  this.search || "");
        this.item = new ArchiveItem({itemid: this.identifier, query: this.query});
        if (this.isUniq()) {
            const cacheDirectory = config.directory; //TODO-MULTI TODO-CRAWL this becomes part of the config for each subset to be crawled
            const skipFetchFile = CrawlManager.cm.skipFetchFile;
            const skipCache = CrawlManager.cm.skipCache;
            waterfall([
                (cb) => {
                    if (["metadata", "details", "all"].includes(this.level) || (this.level === "tile" && !(this.member && this.member.thumbnaillinks) )) {
                        this.item.fetch_metadata(cb);
                    } else {
                        cb(null, this.item);
                    }
                },
                (ai, cb) => { // Save tile if level is set.
                    if (["tile", "metadata", "details", "all"].includes(this.level)) {
                        if (this.member && this.member.thumbnaillinks) {
                            this.member.saveThumbnail({cacheDirectory, skipFetchFile, wantStream: false}, cb);
                        } else {
                            this.item.saveThumbnail({cacheDirectory, skipFetchFile, wantStream: false}, cb);
                        }
                    } else {
                        cb(null, this.item);
                    }
                },
                (unused, cb) => { // parameter Could be archiveItem or archiveSearchMember so dont use it
                    const asParent = this.asParent();
                    if (this.level === "details") { // Details
                        this.item.minimumForUI().forEach(af => CrawlManager.cm.push(new CrawlFile({file: af}, asParent)));
                    } else if (this.level === "all") { // Details  TODO-CRAWL needs to watch max file size
                        this.item.files.forEach(af => CrawlManager.cm.push(new CrawlFile({file: af}, asParent)));
                    }
                    cb(null);
                },
                //(cb) => { debug("XXX Finished fetching files for item %s", this.identifier); cb(); },
                (cb) => { // parameter Could be archiveItem or archiveSearchMember so dont use it
                    if (["details", "all"].includes(this.level) || this.related) {
                        this.item.relatedItems({cacheDirectory, wantStream: false, wantObj: true}, (err, rels) => {
                            if (!err && this.related && rels) { // Just going one page deep for now
                                ArchiveMemberSearch.expand(rels.hits.hits.map( r=>r._id), (err, searchmembersdict) => {
                                    if (err) { cb(err)}
                                    else {
                                        each(Object.values(searchmembersdict), (sm,cb) => sm.save({cacheDirectory},cb), (unusederr) => { // Errors reported in save
                                            Object.values(searchmembersdict).slice(0, this.related.rows)
                                                .forEach(sm =>
                                                    CrawlManager.cm.push(CrawlItem.fromSearchMember(sm, this.related, this.asParent())) );
                                            cb(null);
                                        })
                                    }
                                });
                            } else { // Note err not necessarily true here.
                                cb(err);
                            }
                        });
                    } else {
                        cb(null);
                    }
                },
                //(cb) => { debug("XXX Finished related items for item %s", this.identifier); cb(); },
                (cb) => {
                    if (this.search && (this.query || (this.item && this.item.metadata && (this.item.metadata.mediatype === "collection")))) {
                        const ai = this.item;
                        if (typeof ai.page === "undefined") ai.page = 0;
                        const search = Array.isArray(this.search) ? this.search : [this.search];
                        //TODO-REFACTOR rename limit as rows in dweb-archivecontroller, dweb-archive; dweb-mirror
                        ai.limit = search.reduce((acc, queryPage) => acc + queryPage.rows, 0); // Single query all rows
                        ai.sort = search[0].sort;
                        ai.fetch_query({skipCache}, (err, searchMembers) => { // Needs to update start, but note opts can override start
                            let start = 0;
                            search.forEach(queryPage => {
                                if (queryPage.sort && (queryPage.sort !== this.item.sort)) {
                                    debug("ERROR in configuration - Sorry, can't (yet) mix sort types in %s ignoring %s", this.debugname, queryPage.sort)
                                }
                                searchMembers.slice(start, start + queryPage.rows).forEach(sm =>
                                    CrawlManager.cm.push(
                                        CrawlItem.fromSearchMember(sm, queryPage, this.asParent()) ));
                                start = start + queryPage.rows;
                            });
                            cb();
                        });
                    } else {
                        cb();
                    }
                },
                //(cb) => { debug("XXX Finished processing item %s", this.identifier); cb(); }
            ], cb);
        } else {
            cb();
        }
    }
}


exports = module.exports = CrawlManager;
