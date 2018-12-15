//TODO-ADVANCEDSEARCH - write to ITEM_extra files as well, merge with existing
// Generic NPM modules
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const canonicaljson = require('@stratumn/canonicaljson');
// Other IA repos
const ArchiveMember = require('@internetarchive/dweb-archivecontroller/ArchiveMember');
const Util = require('@internetarchive/dweb-archivecontroller/Util'); // Note also patches Object.filter
// Other files in this repo
const MirrorFS = require('./MirrorFS');

ArchiveMember.prototype._dirpath = function(directory) {
    return path.join(directory, this.identifier);
};


ArchiveMember.prototype.save = function({cacheDirectory = undefined} = {}, cb) {
    if (cb) { return f.call(this, cb) } else { return new Promise((resolve, reject) => f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} }))}        //NOTE this is PROMISIFY pattern used elsewhere
    function f(cb) {
        const namepart = this.identifier; // Its also in this.item.metadata.identifier but only if done a fetch_metadata
        const dirpath = this._dirpath(cacheDirectory);
        const savedkeys = Util.gateway.url_default_fl;
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
