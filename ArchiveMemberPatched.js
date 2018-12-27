/*
// Monkey patches dweb-archivecontroller,
// Note cant merge into dweb-archivecontroller as wont work in browser; and cant create subclass as want everywhere e.g. archivefile.fetch_metadata is used to use the cache
 */

// Generic NPM modules
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const canonicaljson = require('@stratumn/canonicaljson');
// Other IA repos
const ArchiveMember = require('@internetarchive/dweb-archivecontroller/ArchiveMember');
// Other files in this repo

ArchiveMember._dirpath = function(directory, identifier) {
    return path.join(directory, identifier);
};
// noinspection JSUnresolvedVariable
ArchiveMember.prototype._dirpath = function(directory) {
    return ArchiveMember._dirpath(directory, this.identifier);
};


// noinspection JSUnresolvedVariable
ArchiveMember.prototype.save = function({cacheDirectory = undefined} = {}, cb) {
    console.assert(false, "Shouldnt be trying to save ArchiveMember, only ArchiveMemberSearch"); //TODO-ADVANCEDSEARCH remove once found examples
};

ArchiveMember.read = function({cacheDirectory = undefined, identifier = undefined}, cb) {
    /*
        Read member info for an item
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
// noinspection JSUnresolvedVariable
ArchiveMember.prototype.read = function({cacheDirectory = undefined} = {}, cb) {
    ArchiveMember.read({cacheDirectory, identifier: this.identifier}, cb);
};


exports = module.exports = ArchiveMember;
