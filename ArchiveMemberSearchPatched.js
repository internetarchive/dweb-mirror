/*
// Monkey patches dweb-archivecontroller,
// Note cant merge into dweb-archivecontroller as wont work in browser; and cant create subclass as want everywhere e.g. archivefile.fetch_metadata is used to use the cache
 */

// Generic NPM modules
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const canonicaljson = require('@stratumn/canonicaljson');
// Other IA repos
const ArchiveMemberSearch = require('@internetarchive/dweb-archivecontroller/ArchiveMemberSearch');
const Util = require('@internetarchive/dweb-archivecontroller/Util'); // Note also patches Object.filter

// Other files in this repo
const MirrorFS = require('./MirrorFS');


// noinspection JSUnresolvedVariable
//TODO-MULTI and check usages of cacheDirectory
ArchiveMemberSearch.prototype.save = function({cacheDirectory = undefined} = {}, cb) {
    if (cb) { try { f.call(this, cb) } catch(err) { cb(err)}} else { return new Promise((resolve, reject) => { try { f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} })} catch(err) {reject(err)}})} // Promisify pattern v2
    function f(cb) {
        const namepart = this.identifier; // Its also in this.item.metadata.identifier but only if done a fetch_metadata
        const dirpath = this._dirpath(cacheDirectory); //TODO-MULTI and check usages of dirpath
        const savedkeys = Util.gateway.url_default_fl;
        // noinspection JSUnusedLocalSymbols
        const jsonToSave = canonicaljson.stringify(Object.filter(this, (k, v) => savedkeys.includes(k)));
        MirrorFS._mkdir(dirpath, (err) => {
            if (err) {
                debug("ArchiveMember.save: Cannot mkdir %s so cant save %s: %s", dirpath, namepart, err.message);
                cb(err);
            } else {
                const filepath = path.join(dirpath, namepart + "_member.json");
                fs.writeFile(filepath, jsonToSave, (err) => {
                    if (err) {
                        debug("Unable to write %s metadata to %s: %s", namepart, filepath, err.message); cb(err);
                    } else {
                        cb(null, this);
} }); }}); }};

ArchiveMemberSearch.prototype.saveThumbnail = function({copyDirectory = undefined,  skipFetchFile=false, wantStream=false} = {}, cb) {
    /*
    //TODO-API seems to be missing from API.md
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
                        const relFilePath = path.join(identifier, "__ia_thumb.jpg"); // Assumes using __ia_thumb.jpg instead of ITEMID_itemimage.jpg
                        const debugname = namepart + "/__ia_thumb.jpg";
                        MirrorFS.cacheAndOrStream({
                            copyDirectory, relFilepath, skipFetchFile, wantStream, debugname,
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


exports = module.exports = ArchiveMemberSearch;
