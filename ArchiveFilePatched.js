/*
// Monkey patches dweb-archivecontroller,
// Note cant merge into dweb-archivecontroller as wont work in browser; and cant create subclass as want everywhere e.g. archivefile.fetch_metadata is used to use the cache
 */

// Standard files
const debug = require('debug')('dweb-mirror:ArchiveFile');
const path = require('path');
// Other Archive repos
const {ArchiveFile, routed} = require('@internetarchive/dweb-archivecontroller');
// Local files
const MirrorFS = require('./MirrorFS');

// See API.md for documentation

// noinspection JSUnresolvedVariable
ArchiveFile.prototype.cacheAndOrStream = function({skipFetchFile=false, skipNet=false,
                                                      wantStream=false, noCache=false, wantSize=false, wantBuff=false,
                                                      copyDirectory=undefined, start=0, end=undefined} = {}, cb) {
    /*
    Cache an ArchiveFile - see MirrorFS for arguments
    skipNet if set will stop it trying the net, and just return info about the current file
     */
    const itemid = this.itemid; // Not available in events otherwise
    const filename = this.metadata.name;
    const debugname = [itemid, filename].join('/');
    MirrorFS.cacheAndOrStream({ // Try first time without Urls, keep local - note noCache will make this return error unless sha1 specified as no urls either.
        skipFetchFile, wantStream, wantBuff, start, end, debugname, noCache, copyDirectory, wantSize,
        sha1: this.metadata.sha1,
        relFilePath: path.join(itemid, filename),
        expectsize: this.metadata.size,
        ipfs: this.metadata.ipfs // Will usually be undefined as not currently retrieving
    }, (err, streamOrUndefinedOrSizeOrBuff) => {
        if (err && skipNet) {
            cb(err);
        } else if (err) { // Unable to retrieve locally, lets get urls and try again
            this.urls((err, urls) => {
                if (err) {
                    cb(err);
                } else {
                    MirrorFS.cacheAndOrStream({
                        skipFetchFile, wantStream, wantSize, wantBuff,
                        start, end, debugname, noCache, copyDirectory,
                        urls: routed(urls),
                        sha1: this.metadata.sha1,
                        relFilePath: path.join(itemid, filename),
                        expectsize: this.metadata.size,
                        ipfs: this.metadata.ipfs // Will usually be undefined as not currently retrieving
                    }, (err, streamOrUndefinedOrSizeOrBuff) => {
                        if (err) {
                            debug("Unable to cacheOrStream %s", debugname);
                            cb(err);
                        } else {
                            if (!wantStream && !(start || end)) { this.downloaded = true; }; // No error, and not streaming so must have downloaded
                            cb(null, (wantStream || wantSize || wantBuff) ? streamOrUndefinedOrSizeOrBuff : this);
                        }
                    });
                }
            })
        } else { // The local check succeeded
            this.downloaded = true;
            cb(null, (wantStream || wantSize || wantBuff) ? streamOrUndefinedOrSizeOrBuff : this);
        }
    })
};

// noinspection JSUnresolvedVariable
ArchiveFile.prototype.isDownloaded = function({copyDirectory=undefined}, cb) {
    if (this.downloaded === true) { // Already know its downloaded - note not rechecking, so its possible it was deleted.
        cb(null, this.downloaded);
    } else {                // Maybe, lets check
        this.cacheAndOrStream({  copyDirectory, skipNet: true, wantStream: false, wantSize: !this.metadata.size }, (err, res) => {
            if (!err && !this.metadata.size) {
                this.metadata.size = `${res}`; //TODO needs to be a string
            }
            // cacheAndOrStream has side effect of setting downloaded
            cb(null, !err)
        });
    }
};

exports = module.exports = ArchiveFile;
