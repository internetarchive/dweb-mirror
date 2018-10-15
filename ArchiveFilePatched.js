/* Monkey patches ArchiveFile, TODO merge into ArchiveFile when proven */
// Standard files
const debug = require('debug')('dweb-mirror:ArchiveFile');
const path = require('path');
process.env.NODE_DEBUG="fs";    //TODO-MIRROR comment out when done testing FS
const fs = require('fs');   // See https://nodejs.org/api/fs.html
// Other Archive repos
const ArchiveFile = require('@internetarchive/dweb-archive/ArchiveFile');
const ArchiveItem = require('./ArchiveItemPatched');
// Local files
const errors = require('./Errors.js');
const MirrorFS = require('./MirrorFS');

ArchiveFile.p_new = function({itemid=undefined, archiveitem=undefined, metadata=undefined, filename=undefined}={}, cb) {
    /*
     Load ArchiveFile, async because may have to find metadata etc
     Process is itemid > item + filename > fileMetadata

     archiveitem:   Instance of ArchiveItem with or without its item field loaded
     metadata:      If defined is the result of a metadata API call for loading in .item of AF created
     filename:      Name of an exsting file, (may be multipart e.g. foo/bar)
     cb(err, archivefile): passed Archive File
     resolves to: archivefile if no cb
    */
    if (cb) { return f.call(this, cb) } else { return new Promise((resolve, reject) => f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} }))}
    function f(cb) {
        if (itemid && filename && !metadata && !archiveitem) {
            archiveitem = new ArchiveItem({itemid});
        } // Drop through now have archiveitem
        if (archiveitem && filename && !metadata) {
            if (!archiveitem.item) {
                return archiveitem.fetch_metadata((err, ai) => {
                    return err ? cb(err)  : this.p_new({itemid, archiveitem: ai, metadata, filename}, cb); // Resolves to AF
                });
            }
            archiveitem._listLoad(); // Load an array of ArchiveFile if not already loaded
            const af = archiveitem._list.find(af => af.metadata.name === filename); // af, (undefined if not found)
            return af ? cb(null, af) : cb(new errors.FileNotFoundError(`Valid itemid "${itemid}" but file "${filename}" not found`));
        }
        if (metadata) {
            cb(null, new ArchiveFile({itemid, metadata}));
        }
    }
};
ArchiveFile.prototype.readableFromNet = function(opts, cb) {
    /*
        cb(err, stream): Called with open readable stream from the net.
     */
    if (typeof opts === "function") { cb = opts; opts = {start: 0}; } // Allow skipping opts
    // noinspection JSIgnoredPromiseFromCall
    this.p_urls((err, urls) => { if (err) { cb(err) } else {
        debug("Opening stream for %s/%s from urls", this.itemid, this.metadata.name);
        DwebTransports.createReadStream(urls, opts, cb);
    }});
};

ArchiveFile.prototype.cacheAndOrStream = function({cacheDirectory = undefined,  skipfetchfile=false, wantStream=false, start=0, end=undefined} = {}, cb) {
    /*
    Cache an ArchiveFile - see MirrorFS for arguments
     */
    const itemid = this.itemid; // Not available in events otherwise
    const filename = this.metadata.name;
    this.p_urls((err, urls) => {
        if (err) {
            cb(err);
        } else {
            debugname = [itemid, filename].join('/')
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
}



exports = module.exports = ArchiveFile;
