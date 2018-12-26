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
ArchiveMemberSearch.prototype.save = function({cacheDirectory = undefined} = {}, cb) {
    if (cb) { return f.call(this, cb) } else { return new Promise((resolve, reject) => f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} }))}        //NOTE this is PROMISIFY pattern used elsewhere
    function f(cb) {
        const namepart = this.identifier; // Its also in this.item.metadata.identifier but only if done a fetch_metadata
        const dirpath = this._dirpath(cacheDirectory);
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

exports = module.exports = ArchiveMemberSearch;
