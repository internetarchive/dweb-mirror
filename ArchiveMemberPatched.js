// Generic NPM modules
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const canonicaljson = require('@stratumn/canonicaljson');
// Other IA repos
const ArchiveMember = require('@internetarchive/dweb-archivecontroller/ArchiveMember');
const Util = require('@internetarchive/dweb-archivecontroller/Util'); // Note also patches Object.filter
// Other files in this repo
const MirrorFS = require('./MirrorFS');

ArchiveMember._dirpath = function(directory, identifier) {
    return path.join(directory, identifier);
};
ArchiveMember.prototype._dirpath = function(directory) {
    return ArchiveMember._dirpath(directory, this.identifier);
};


ArchiveMember.prototype.save = function({cacheDirectory = undefined} = {}, cb) {
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

ArchiveMember.read = function({cacheDirectory = undefined, identifier = undefined}, cb) {
    /*
        Read member info from item
        cacheDirectory: Top level of directory to look for data in
        identifier: Where to look - can be a real identifier or pseudo-one for a saved search
        TODO-CACHE-MULTI allow cacheDirectory to be an array
        cb(err, data structure from file)
    */
    const namepart = identifier;
    const dirpath = this._dirpath(cacheDirectory, namepart);
    const part = "member";
    const filename = path.join(dirpath, `${namepart}_${part}.json`);
    fs.readFile(filename, (err, jsonstring) => {
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
ArchiveMember.prototype.read = function({cacheDirectory = undefined} = {}, cb) {
    ArchiveMember.read({cacheDirectory, identifier: this.identifier}, cb);
};


exports = module.exports = ArchiveMember;
