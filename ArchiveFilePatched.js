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
ArchiveFile.prototype.cacheAndOrStream = function({skipFetchFile=false, skipNet=false, wantStream=false, start=0, end=undefined} = {}, cb) {
    /*
    Cache an ArchiveFile - see MirrorFS for arguments
     */
    const itemid = this.itemid; // Not available in events otherwise
    const filename = this.metadata.name;
    const debugname = [itemid, filename].join('/');
    MirrorFS.cacheAndOrStream({ // Try first time without Urls, keep local
        skipFetchFile, wantStream, start, end, debugname,
        sha1: this.metadata.sha1,
        relFilePath: path.join(itemid, filename),
        expectsize: this.metadata.size,
        ipfs: this.metadata.ipfs // Will usually be undefined as not currently retrieving
    }, (err, streamOrUndefined) => {
        if (err && skipNet) {
            cb(err);
        } else if (err) { // Unable to retrieve locally, lets get urls and try again
            this.urls((err, urls) => {
                if (err) {
                    cb(err);
                } else {
                    MirrorFS.cacheAndOrStream({
                        urls, skipFetchFile, wantStream, start, end, debugname,
                        sha1: this.metadata.sha1,
                        relFilePath: path.join(itemid, filename),
                        expectsize: this.metadata.size,
                        ipfs: this.metadata.ipfs // Will usually be undefined as not currently retrieving
                    }, (err, streamOrUndefined) => {
                        if (err) {
                            debug("Unable to cacheOrStream %s", debugname);
                            cb(err);
                        } else {
                            cb(null, wantStream ? streamOrUndefined : this);
                        }
                    });
                }
            })
        } else {
            this.downloaded = true;
            cb(null, wantStream ? streamOrUndefined : this);
        }
    })
};

// noinspection JSUnresolvedVariable
ArchiveFile.prototype.isDownloaded = function(cb) {
    this.cacheAndOrStream({skipNet: true, wantStream: false}, (err, res) => {
        this.downloaded = !err; cb(null, !err)});
};

exports = module.exports = ArchiveFile;
