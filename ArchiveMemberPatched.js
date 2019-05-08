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
const Util = require('@internetarchive/dweb-archivecontroller/Util'); // Note also patches Object.filter
// Other files in this repo
const MirrorFS = require('./MirrorFS.js');

ArchiveMember.prototype.save = function({} = {}, cb) {
    cb(new Error("Shouldnt be trying to save ArchiveMember, only ArchiveMember"));
};

ArchiveMember.read = function({identifier = undefined}, cb) {
    /*
        Read member info for an item
        identifier: Where to look - can be a real identifier or pseudo-one for a saved search
        cb(err, data structure from file)
    */
    if (typeof unusedopts === "function") { cb = opts; opts={}; }
    const namepart = identifier;
    const part = "member";
    const relFilePath = path.join(namepart, `${namepart}_${part}.json`);
    MirrorFS.readFile(relFilePath, (err, jsonstring) => {
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
    Object.assign(this, {crawl: config.crawlInfo(this.identifier)});
    cb(null);
}
ArchiveMember.addCrawlInfo = function(arr, {config=undefined}={}, cb) { // Should work on an [ArchiveMember*] or [{}*] as same structure
    each(arr, (memb, cb2)  => memb.addCrawlInfo({config}, cb2), cb);
}
ArchiveMember.addCrawlInfoRelated = function(rels, {config=undefined}={}, cb) { // Should work on an [ArchiveMember*] or [{}*] as same structure
    const arr = rels.hits.hits;
    each(arr, (rel, cb2)  => {
        Object.assign(rel._source, {crawl: config.crawlInfo(rel._id)});
        cb2(null);
    }, cb);
}
ArchiveMember.prototype.read = function(unusedopts = {}, cb) {
    if (typeof unusedopts === "function") { cb = unusedopts; unusedopts={}; }
    ArchiveMember.read({identifier: this.identifier}, cb);
};



// noinspection JSUnresolvedVariable
ArchiveMember.prototype.save = function(opts = {}, cb) {
    if (typeof opts === "function") { cb = opts; opts = {}; } // Allow opts parameter to be skipped
    if (cb) { try { f.call(this, cb) } catch(err) { cb(err)}} else { return new Promise((resolve, reject) => { try { f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} })} catch(err) {reject(err)}})} // Promisify pattern v2
    function f(cb) {
        const namepart = this.identifier; // Its also in this.item.metadata.identifier but only if done a fetch_metadata
        const savedkeys = Util.gateway.url_default_fl;
        // noinspection JSUnusedLocalSymbols
        const jsonToSave = canonicaljson.stringify(Object.filter(this, (k, v) => savedkeys.includes(k)));
        //MirrorFS._mkdir(dirpath, (err) => { //Not mkdir any more
        const relFilePath = path.join(namepart, namepart + "_member.json");
        MirrorFS.writeFile(relFilePath, jsonToSave, (err) => {
            if (err) {
                debug("Unable to write metadata to %s: %s", relFilePath, err.message); cb(err);
            } else {
                cb(null, this);
            }}); }};

ArchiveMember.prototype.saveThumbnail = function({skipFetchFile=false, wantStream=false} = {}, cb) {
    /*
    Save a thumbnail to the cache, note must be called after fetch_metadata
    wantStream      true if want stream instead of ArchiveItem returned
    skipFetchFile   true if should skip net retrieval - used for debugging
    resolve or cb(err.res)  this on completion or stream on opening
    */
    if (cb) { try { f.call(this, cb) } catch(err) { cb(err)}} else { return new Promise((resolve, reject) => { try { f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} })} catch(err) {reject(err)}})} // Promisify pattern v2
    function f(cb) {
        const namepart = this.identifier; // Its also in this.metadata.identifier but only if done a fetch_metadata

        if (!namepart) {
            cb(null,this);
        } else {
            // MirrorFS._mkdir(dirpath, (err) => { // Not mkdir any longer as MirrorFS.cacheAndOrStream will do
            //TODO-THUMBNAILS use new ArchiveItem.thumbnailFile that creates a AF for a pseudofile
            // noinspection JSUnresolvedVariable
            // DONT Include direct link to services as have https://dweb.me/arc/archive.org/thumbnail/IDENTIFIER which is same
            const relFilePath = path.join(this.identifier, "__ia_thumb.jpg"); // Assumes using __ia_thumb.jpg instead of ITEMID_itemimage.jpg
            const debugname = namepart + "/__ia_thumb.jpg";
            MirrorFS.cacheAndOrStream({
                relFilePath, skipFetchFile, wantStream, debugname,
                urls: this.thumbnaillinks,
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
