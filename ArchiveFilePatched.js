/*
// Monkey patches dweb-archivecontroller,
// Note cant merge into dweb-archivecontroller as wont work in browser; and cant create subclass as want everywhere e.g. archivefile.fetch_metadata is used to use the cache
 */

// Standard files
const debug = require('debug')('dweb-mirror:ArchiveFile');
const path = require('path');
// Other Archive repos
const ArchiveFile = require('@internetarchive/dweb-archivecontroller/ArchiveFile');
// Local files
const MirrorFS = require('./MirrorFS');

// noinspection JSUnresolvedVariable
ArchiveFile.prototype.cacheAndOrStream = function({cacheDirectory = undefined,  skipfetchfile=false, wantStream=false, start=0, end=undefined} = {}, cb) {
    /*
    Cache an ArchiveFile - see MirrorFS for arguments
     */
    const itemid = this.itemid; // Not available in events otherwise
    const filename = this.metadata.name;
    this.urls((err, urls) => {
        if (err) {
            cb(err);
        } else {
            const debugname = [itemid, filename].join('/');
            MirrorFS.cacheAndOrStream({
                urls, cacheDirectory, skipfetchfile, wantStream, start, end, debugname,
                sha1: this.metadata.sha1,
                filepath: path.join(cacheDirectory, itemid, filename),
                expectsize: this.metadata.size
            }, (err, streamOrUndefined)=> {
                if (err) {
                    debug("Unable to cacheOrStream %s",debugname); cb(err);
                } else {
                    cb(null, wantStream ? streamOrUndefined : this);
                }
            });
        }
    })
};



exports = module.exports = ArchiveFile;
