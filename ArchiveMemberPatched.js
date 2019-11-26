/*
// Monkey patches dweb-archivecontroller,
// Note cant merge into dweb-archivecontroller as wont work in browser; and cant create subclass as want everywhere e.g. archivefile.fetch_metadata is used to use the cache
 */

// Generic NPM modules
const path = require('path');
const canonicaljson = require('@stratumn/canonicaljson');
const debug = require('debug')('dweb-mirror:ArchiveMemberPatched');
const each = require('async/each');

// Other IA repos
const ArchiveMember = require('@internetarchive/dweb-archivecontroller/ArchiveMember');
const {gateway, ObjectFilter} = require('@internetarchive/dweb-archivecontroller/Util'); // Note also patches Object.filter
// Other files in this repo
const MirrorFS = require('./MirrorFS.js');

//SEE ALMOST-SAME-CODE-NAMEPART in ArchiveMember._namepart and ArchiveItem._namepart
// noinspection JSUnresolvedVariable
ArchiveMember._namepart = function({identifier, query, sort}) {
    // The name used for the directory and file prefixes, normally the item identifier, but some special cases
    if (!identifier && query) {
        // Goal here is a string that: gives an indication of what it is; is filesystem safe; doesnt map similar but different queries to same string
        // Npm's sanitize-filename does a reasonable job BUT it maps all unsafe chars to same result,
        // encodeURLcomponent probably does a reasonable job, except for *
        return encodeURIComponent(`_SEARCH_${query}_${sort.join('_')}`).replace(/\*/g,'%2A')
    } else if (identifier) {
        return identifier;
    } else {
        return undefined; // Should be caught at higher level to decide not to use cache
    }
};



ArchiveMember.read = function({ identifier=undefined, query=undefined, sort=undefined, copyDirectory=undefined }, cb) {
    /*
        Read member info for an item
        identifier: Where to look - can be a real identifier or pseudo-one for a saved search
        cb(err, data structure from file)
    */
    const namepart = this._namepart({identifier, query, sort});
    const part = "member";
    const relFilePath = path.join(namepart, `${namepart}_${part}.json`);
    MirrorFS.readFile(relFilePath, {copyDirectory}, (err, jsonstring) => {
        if (err) {
            cb(err);    // Not logging as not really an err for there to be no file, as will read
        } else {
            let o;
            try {
                o = canonicaljson.parse(jsonstring); // No reviver function, which would allow postprocessing
            } catch (err) {
                // It is on the other hand an error for the JSON to be unreadable
                debug("Failed to parse json at %s: part %s %s", namepart, part, err.message);
                cb(err);
            }
            cb(null, o);
        }
    });
};
ArchiveMember.prototype.addCrawlInfo = function({config}, cb) {
    Object.assign(this, {crawl: config.crawlInfo({identifier: this.identifier})});
    cb(null);
};
ArchiveMember.addCrawlInfo = function(arr, {config=undefined, copyDirectory=undefined}={}, cb) { // Should work on an [ArchiveMember*]
    each(arr, (memb, cb2)  => memb.addCrawlInfo({config, copyDirectory}, cb2), cb);
};
ArchiveMember.prototype.read = function({copyDirectory}, cb) {
    ArchiveMember.read({identifier: this.identifier, query: this.query, sort: this.sort, copyDirectory}, cb);
};



// noinspection JSUnresolvedVariable
ArchiveMember.prototype.save = function({copyDirectory=undefined} = {}, cb) {
    if (cb) { try { f.call(this, cb) } catch(err) { cb(err)}} else { return new Promise((resolve, reject) => { try { f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} })} catch(err) {reject(err)}})} // Promisify pattern v2
    function f(cb) {
      if (!(copyDirectory || MirrorFS.directories.length)) {
          cb(new Error("Nowhere to save to"));
      } else {
        const namepart = this.identifier; // Its also in this.item.metadata.identifier but only if done a fetch_metadata
        const savedkeys = gateway.url_default_fl;
        // noinspection JSUnusedLocalSymbols
        const jsonToSave = canonicaljson.stringify(ObjectFilter(this, (k, v) => savedkeys.includes(k)));
        const relFilePath = path.join(namepart, namepart + "_member.json");
        MirrorFS.writeFile({ relFilePath, copyDirectory }, jsonToSave, (err) => {
            if (err) {
                debug("Unable to write metadata to %s: %s", relFilePath, err.message); cb(err);
            } else {
                cb(null, this);
            }}); } }
};


ArchiveMember.prototype.saveThumbnail = function({skipFetchFile=false, noCache=false, wantStream=false, copyDirectory=undefined } = {}, cb) {  //TODO-API
    /*
    Save a thumbnail to the cache, note must be called after fetch_metadata
    wantStream      true if want stream instead of ArchiveItem returned
    skipFetchFile   true if should skip net retrieval - used for debugging
    noCache         true if should not check cache
    resolve or cb(err.res)  this on completion or stream on opening
    */
    if (cb) { try { f.call(this, cb) } catch(err) { cb(err)}} else { return new Promise((resolve, reject) => { try { f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} })} catch(err) {reject(err)}})} // Promisify pattern v2
    function f(cb) {
        const namepart = this.identifier; // Its also in this.metadata.identifier but only if done a fetch_metadata

        if (!namepart) {
            cb(null,this);
        } else {
            //TODO-THUMBNAILS use new ArchiveItem.thumbnailFile that creates a AF for a pseudofile
            const relFilePath = path.join(this.identifier, "__ia_thumb.jpg"); // Assumes using __ia_thumb.jpg instead of ITEMID_itemimage.jpg
            const debugname = namepart + "/__ia_thumb.jpg";
            MirrorFS.cacheAndOrStream({
                relFilePath, skipFetchFile, wantStream, debugname, noCache, copyDirectory,
                urls: this.urls(),
            }, (err, streamOrUndefined) => {
                if (err) {
                    debug("Unable to cacheOrStream %s", debugname);
                    cb(err);
                } else {
                    cb(null, wantStream ? streamOrUndefined : this);
                }
            });
        }
    }
};

exports = module.exports = ArchiveMember;
