/*
// Monkey patches dweb-archivecontroller,
// Note cant merge into dweb-archivecontroller as wont work in browser; and cant create subclass as want everywhere e.g. archivefile.fetch_metadata is used to use the cache
 */

// Generic NPM modules
const path = require('path');
const canonicaljson = require('@stratumn/canonicaljson');
// Other IA repos
const ArchiveMember = require('@internetarchive/dweb-archivecontroller/ArchiveMember');
// Other files in this repo
const MirrorFS = require('./MirrorFS.js');

// noinspection JSUnresolvedVariable
ArchiveMember.prototype.save = function({} = {}, cb) {
    cb(new Error("Shouldnt be trying to save ArchiveMember, only ArchiveMemberSearch"));
};

ArchiveMember.read = function({identifier = undefined}, cb) {
    /*
        Read member info for an item
        identifier: Where to look - can be a real identifier or pseudo-one for a saved search
        cb(err, data structure from file)
    */
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
// noinspection JSUnresolvedVariable
ArchiveMember.prototype.read = function(unusedopts = {}, cb) {
    ArchiveMember.read({identifier: this.identifier}, cb);
};


exports = module.exports = ArchiveMember;
