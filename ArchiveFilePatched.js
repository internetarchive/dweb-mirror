/* Monkey patches ArchiveFile, TODO merge into ArchiveFile when proven */
// Standard files
const debug = require('debug')('dweb-mirror:ArchiveFile');
const path = require('path');
const sha = require('sha');
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
    this.p_urls((err, urls) => err ? cb(err) : DwebTransports.createReadStream(urls, opts, cb))
};

ArchiveFile.prototype.cacheAndOrStream = function({cacheDirectory = undefined, skipfetchfile=false, wantStream=false, start=0, end=undefined} = {}, cb) {
    /*
    Return a stream from the cache, or the net and if start/end unset cache it
    cb(err, s|undefined) if wantStream will call with a stream
    */
    //TODO - make sure sha.check works if no metadata (undefined or 0)
    //TODO handle case of start/end as shouldnt cache partial
    const itemid = this.itemid; // Not available in events otherwise
    const filename = this.metadata.name;
    // noinspection JSUnresolvedVariable
    const sha1 = this.metadata.sha1;
    if (!sha1) { // Handle files like _meta.xml which dont have a sha
        _notcached.call(this);
    } else {
        const filepath = path.join(cacheDirectory, itemid, filename);
        sha.check(filepath, sha1, (err) => {
            if (err) { //Doesn't match
                _notcached.call(this);
            } else { // sha1 matched, skip fetching, just stream from saved
                if (wantStream) {
                    debug("streaming from cached", filepath, "as sha1 matches");
                    cb(null, fs.createReadStream(filepath, {start, end}));   // Already cached and want stream - read from file
                } else {
                    debug("Already cached", filepath, "with correct sha1");
                    cb();
                }
            }
        });
    }
    function _notcached() {
        if (skipfetchfile) {
            debug("skipfetchfile set (testing) would fetch: %s", filename);
            cb();
        } else {
            if (wantStream && (start>0 || end<Infinity)) {  // start or end undefined dont satisfy this test
                debug("Not caching %s/%s because specifying a range %s:%s and wantStream", itemid, filename, start, end);
                this.readableFromNet({start, end}, cb); // Dont cache a byte range, just return it
            } else {
                this.readableFromNet({start, end}, (err, s) => { //Returns a promise, but not waiting for it
                    if (err) {
                        console.warn("ArchiveFile.save ignoring error on", itemid, err.message); //TODO - pass error on, ignore at caller level
                        cb(); // Dont pass error on, will trigger a Promise rejection not handled message
                        // Dont try and write it
                    } else {
                        this.writableToFile({cacheDirectory}, (err, writable) => {
                            writable.on('close', () => {
                                debug("Written %d to file", writable.bytesWritten);
                                // noinspection EqualityComparisonWithCoercionJS
                                if (this.metadata.size != writable.bytesWritten) { // Intentionally != as metadata is a string
                                    console.error(`File ${itemid}/${filename} size=${writable.bytesWritten} doesnt match expected ${this.metadata.size}`);
                                } else {
                                    debug(`Closed ${itemid}/${filename} size=${writable.bytesWritten}`);
                                }
                                if (!wantStream) cb(); // If dont want stream then cb signifies file is written
                            });
                            s.on('error', (err) => debug("Failed to read %s/%s from net err=%s", itemid, filename, err.message)); //TODO make it remove file or better write to temp and rename when success
                            try {
                                s.pipe(writable);   // Pipe the stream from the HTTP or Webtorrent read etc to the stream to the file.
                                if (wantStream) cb(null, s);
                            } catch(err) {
                                console.log("XXX @ ArchiveFilePatched - catching error with save() in s.pipe shouldnt happen",s);
                                if (wantStream) cb(err);
                            }
                        });
                    }
                });
            }
        }
    }

};

ArchiveFile.prototype.writableToFile = function({cacheDirectory = undefined} = {}, cb) {
    /*
    Save a archivefile to the appropriate filepath
    cb(err, s) // Pass stream to callback
     */
    const filepath = path.join(cacheDirectory, this.itemid, this.metadata.name);
    MirrorFS._fileopenwrite(cacheDirectory, filepath, (err, fd) => {
        if (err) {
            debug("Unable to write to %s: %s", filepath, err.message);
            cb(err);
        } else {
            // fd is the file descriptor of the newly opened file;
            const writable = fs.createWriteStream(null, {fd: fd});
            cb(null, writable);
            // Note at this point file is neither finished, nor closed, its a stream open for writing.
            //fs.close(fd); Should be auto closed when stream to it finishes
        }
    });
};

exports = module.exports = ArchiveFile;
