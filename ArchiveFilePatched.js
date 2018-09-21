/* Monkey patches ArchiveFile, TODO merge into ArchiveFile when proven */
// Standard files
const debug = require('debug')('dweb-mirror:ArchiveFile');
const path = require('path');
const sha = require('sha');
process.env.NODE_DEBUG="fs";    //TODO-MIRROR comment out when done testing FS
const fs = require('fs');   // See https://nodejs.org/api/fs.html
// Other Archive repos
const DTerrors = require('@internetarchive/dweb-transports/Errors.js');
const ArchiveFile = require('@internetarchive/dweb-archive/ArchiveFile');
const ArchiveItem = require('./ArchiveItemPatched');
// Local files
const MirrorFS = require('./MirrorFS');

ArchiveFile.p_new = function({itemid=undefined, archiveitem=undefined, metadata=undefined, filename=undefined}={}, cb) {
    /*
     Load ArchiveFile, async because may have to find metadata etc
     Process is itemid > item + filename > fileMetadata
     cb(err, archivefile): passed Archive File
     resolves to: archivefile if no cb
    */
    if (itemid && filename && !metadata && !archiveitem) {
        archiveitem = new ArchiveItem({itemid});
    } // Drop through now have archiveitem
    if (archiveitem && filename && !metadata) {
        if (!archiveitem.item) {
            return archiveitem.fetch_metadata()
                .catch(err => {if (cb) { cb(err); } else { reject(err); }})
                .then(() => this.p_new({itemid, archiveitem, metadata, filename}, cb)); // Resolves to AF
                // Promise resolves to AF; dont catch errs here, cb(err) will have been called if exists else will reject()
        }
        archiveitem._listLoad(); // Load an array of ArchiveFile if not already loaded
        let af = archiveitem._list.find(af => af.metadata.name === filename); // af, (undefined if not found)
        if (af) {
            if (cb) { cb(null, af); return; } else { return new Promise((resolve, reject) => resolve(af)); }
        } else {
            let err = new errors.FileNotFoundError(`Valid itemid "${itemid}" but file "${filename}" not found`);
            if (cb) { cb(err); return; } else { return new Promise((resolve, reject) => reject(err)); }
        }
    }
    if (metadata) {
        af = new ArchiveFile({itemid, metadata});
        if (cb) { cb(null, af); return; } else { return new Promise((resolve, reject) => resolve(af)); }
    }
}
ArchiveFile.prototype.readableFromNet = function(opts, cb) {
    /*
        cb(err, stream): Called with open readable stream from the net.
        Returns promise if no cb
     */
    if (typeof opts === "function") { cb = opts; opts = {start: 0}; } // Allow skipping opts
    this.p_urls()
    .then(urls => DwebTransports.p_f_createReadStream(urls))
    .then(f => {
            let s = f(opts);
            if (cb) { cb(null, s); } else { return(s); }; // Callback or resolve stream
    })
    .catch(err => {
        if (err instanceof DTerrors.TransportError) {
            console.warn("readableFromNet caught", err.message);
        } else {
            console.error("readableFromNet caught", err);
        }
        if (cb) { cb(err); } else { reject(err)}
    });
};

// NOTE checkShaAndSave cachedStream ARE ALMOST IDENTICAL
ArchiveFile.prototype.checkShaAndSave = function({cacheDirectory = undefined, skipfetchfile=false} = {}, cb) {
    //TODO - make sure sha.check works if no metadata (undefined or 0)
    if (!this.metadata.sha1) { // Handle files like _meta.xml which dont have a sha
        this.save({cacheDirectory}, cb);
    } else {
        let filepath = path.join(cacheDirectory, this.itemid, this.metadata.name);
        sha.check(filepath, this.metadata.sha1, (err) => {
            if (err) {
                if (skipfetchfile) {
                    debug("skipfetchfile set (testing) would fetch: %s", filepath);
                    cb(null, -1);
                } else {
                    this.save({cacheDirectory}, cb);
                }
            } else { // sha1 matched, skip
                debug("Skipping", filepath, "as sha1 matches");
                cb(null, -1);
            }
        });
    }
};

// NOTE checkShaAndSave cachedStream ARE ALMOST IDENTICAL
//TODO add opts {Start, end} as used by readableFromNet //TODO-REFACTOR do we need both cachedStream and checkShaAndSave, maybe pass an option to get back either stream or bytesWritten
ArchiveFile.prototype.cachedStream = function({cacheDirectory = undefined, start=0, end=undefined} = {}, cb) {
    // cb(err, stream)  will have a stream, also piped to a cache file
    //TODO - make sure sha.check works if no metadata (undefined or 0)
    try {
        let filepath = path.join(cacheDirectory, this.itemid, this.metadata.name);
        sha.check(filepath, this.metadata.sha1, (err) => {
            if (err) {
                this.saveNEW({cacheDirectory, start, end}, cb); // cb(err, stream)
            } else { // sha1 matched, skip
                debug("Returning cached", filepath, "as sha1 matches");
                let s = fs.createReadStream(filepath); //TODO add opts { start: 90, end: 99 }
                cb(null, s);
            }
        });
    } catch(err) {
        console.error("ArchiveFile.cachedStream:",err)
        if (cb) { cb(err);} else { throw(err);} // Throw it up
    }
};

ArchiveFile.prototype.writableToFile = function({cacheDirectory = undefined} = {}, cb) {
    /*
    Save a archivefile to the appropriate filepath
    cb(err, s) // Pass stream to callback
     */
    let filepath = path.join(cacheDirectory, this.itemid, this.metadata.name);
    MirrorFS._fileopenwrite(cacheDirectory, filepath, (err, fd) => {
        if (err) {
            debug("Unable to write to %s: %s", filepath, err.message);
            cb(err);
        } else {
            // fd is the file descriptor of the newly opened file;
            let writable = fs.createWriteStream(null, {fd: fd});
            cb(null, writable);
            // Note at this point file is neither finished, nor closed, its a stream open for writing.
            //fs.close(fd); Should be auto closed when stream to it finishes
        }
    });
};

ArchiveFile.prototype.save = function({cacheDirectory = undefined, start=0, end=undefined} = {}, cb) {
    /*
    net > file + output
    Save a archivefile to the appropriate filepath and return as stream
    cb(err, {archivefile, size}) // To call on close
     */
    // noinspection JSIgnoredPromiseFromCall
    this.readableFromNet({start, end}, (err, s) => { //Returns a promise, but not waiting for it
        if (err) {
            console.warn("MirrorFS._transform ignoring error on", this.itemid, err.message);
            cb(null); // Dont pass error on, will trigger a Promise rejection not handled message
            // Dont try and write it
        } else {
            this.writableToFile({cacheDirectory}, (err, writable) => {
                writable.on('close', () => {
                    debug("Written %d to file", writable.bytesWritten);
                    // noinspection EqualityComparisonWithCoercionJS
                    if (this.metadata.size != writable.bytesWritten) { // Intentionally != as metadata is a string
                        console.error(`File ${this.itemid}/${this.metadata.name} size=${writable.bytesWritten} doesnt match expected ${this.metadata.size}`);
                    } else {
                        debug(`Closed ${this.itemid}/${this.metadata.name} size=${writable.bytesWritten}`);
                    }
                    cb(null, writable.bytesWritten);
                });
                try {
                    s.pipe(writable);   // Pipe the stream from the HTTP or Webtorrent read etc to the stream to the file.
                } catch(err) {
                    console.log("XXX @ ArchiveFilePatched - catching error with save() in s.pipe",s);
                }
            });
        }
    });
};
ArchiveFile.prototype.saveNEW = function({cacheDirectory = undefined} = {}, cb) {
    /*
    Save a archivefile to the appropriate filepath
    cb(err, s) // With stream so can work with while caching
     */
    // noinspection JSIgnoredPromiseFromCall
    this.readableFromNet((err, s) => { //Returns a promise, but not waiting for it
        if (err) {
            console.warn("MirrorFS._transform ignoring error on", this.itemid, err.message);
            cb(err); // Dont pass error on, will trigger a Promise rejection not handled message  //XXX save() ignored error)
            // Dont try and write it
        } else {
            this.writableToFile({cacheDirectory}, (err, writable) => {
                writable.on('close', () => {
                    debug("Written %d to file", writable.bytesWritten);
                    // noinspection EqualityComparisonWithCoercionJS
                    if (this.metadata.size != writable.bytesWritten) { // Intentionally != as metadata is a string
                        console.error(`File ${this.itemid}/${this.metadata.name} size=${writable.bytesWritten} doesnt match expected ${this.metadata.size}`);
                    } else {
                        debug(`Closed ${this.itemid}/${this.metadata.name} size=${writable.bytesWritten}`);
                    }
                    //cb(null, writable.bytesWritten); //XXX save() sends bytesWritten)
                });
                try {
                    s.pipe(writable);   // Pipe the stream from the HTTP or Webtorrent read etc to the stream to the file.
                    cb(null, s);        // CB with the stream   //XXX save() sends bytesWritten)
                } catch(err) {
                    console.log("XXX @ ArchiveFilePatched - catching error with saveNEW() in s.pipe",s);
                }
            });
        }
    });
};

exports = module.exports = ArchiveFile;
