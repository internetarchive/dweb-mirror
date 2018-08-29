process.env.NODE_DEBUG="fs";    //TODO-MIRROR comment out when done testing FS
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const ArchiveFile = require('@internetarchive/dweb-archive/ArchiveFile.js');
const DwebTransports = require('@internetarchive/dweb-transports');
const DTerrors = require('@internetarchive/dweb-transports/Errors.js');
const sha = require('sha');
const path = require('path');
const MirrorFS = require('./MirrorFS');


class SaveFiles extends MirrorFS {
    /*
    input: Stream of ArchiveFile
    output: {archivefile, size} where size is -1 if nothing saved (because sha1 matched.

    options {
        directory: Parent of Items
        skipfetchfile: true for debugging - dont actually fetch the file
        }
     */

    constructor(options = {}) {
        const defaultoptions = {
            paralleloptions: {limit: 10, retryms: 100},
            name: "SaveFiles",
        };
        super(Object.assign(defaultoptions, options));
        this.directory = options.directory;
        this.skipfetchfile = options.skipfetchfile;
    }

    _filepath(o) {
        return (
            o instanceof ArchiveFile ? path.join(this.directory, o.itemid, o.metadata.name)
                : undefined );
    }

    async _streamFrom(source, cb) {
        /*
            Takes an ArchiveFile, may extend to other types
            source:   Data source, currently supports ArchiveFile only.
            cb(err, stream): Called with open stream.
            TODO-MIRROR move this to ArchiveFile, its generally useful - if so, make it return a promise if cb not defined
         */
        if (source instanceof ArchiveFile) {
            let urls = await source.p_urls();
            try {
                let crs = await DwebTransports.p_f_createReadStream(urls);
                let temp = await crs({start: 0});
                cb(null, temp); //TODO-MIRROR check that await crs works if crs is not a promise
            } catch (err) {
                if (err instanceof DTerrors.TransportError) {
                    console.warn("SaveFiles._streamFrom caught", err.message);
                } else {
                    console.error("SaveFiles._streamFrom caught", err);
                }
                cb(err);
            }
        } else {
            cb(new Error("Cannot _streamFrom " + source))
        }

    }

    _save(archivefile, cb) {
        /*
        Save a archivefile to the appropriate filepath
        cb(err, {archivefile, size}) // To call on close
         */
        let filepath = this._filepath(archivefile);
        // noinspection JSIgnoredPromiseFromCall
        this._streamFrom(archivefile, (err, s) => { //Returns a promise, but not waiting for it
            if (err) {
                console.warn("MirrorFS._transform ignoring error on", archivefile.itemid, err.message);
                cb(null); // Dont pass error on, will trigger a Promise rejection not handled message
                // Dont try and write it
            } else {
                this._fileopen(filepath, (err, fd) => {
                    if (err) {
                        this.debug("Unable to write to %s: %s", filepath, err.message);
                        cb(err);
                    } else {
                        // fd is the file descriptor of the newly opened file;
                        let writable = fs.createWriteStream(null, {fd: fd});
                        writable.on('close', () => {
                            this.debug("Written %d to %s", writable.bytesWritten, filepath);
                            // noinspection EqualityComparisonWithCoercionJS
                            if (archivefile.metadata.size != writable.bytesWritten) { // Intentionally != as metadata is a string
                                console.error(`File ${archivefile.itemid}/${archivefile.metadata.name} size=${writable.bytesWritten} doesnt match expected ${archivefile.metadata.size}`);
                            } else {
                                this.debug(`Closed ${archivefile.itemid}/${archivefile.metadata.name} size=${writable.bytesWritten}`);
                            }
                            cb(null, {archivefile, size: writable.bytesWritten});
                        });
                        // Note at this point file is neither finished, nor closed, its open for writing.
                        //fs.close(fd); Should be auto closed when stream to it finishes
                        s.pipe(writable);   // Pipe the stream from the HTTP or Webtorrent read etc to the stream to the file.
                    }
                });
            }
        });
    }
    _parallel(archivefile, encoding, cb) {    // A archivefile got written to this stream, fetch and store
        /*
        _parallel has same profile as _transform except is run in parallel
        All paths through this must end with a cb with an optional final data.
        It is allowable to use this.push() before the final cb() but not after.
        */
        //
        if (typeof encoding === 'function') {  cb = encoding; encoding = null; }
        try {
            let filepath = this._filepath(archivefile);
            if (!archivefile.metadata.sha1) { // Handle files like _meta.xml which dont have a sha
                this._save(archivefile, cb);
            } else {
                sha.check(filepath, archivefile.metadata.sha1, (err) => {
                    if (err) {
                        if (this.skipfetchfile) {
                            this.debug("skipfetchfile: %s", filepath);
                        } else {
                            this._save(archivefile, cb);
                        }
                    } else { // sha1 matched, skip
                        this.debug("Skipping", filepath, "as sha1 matches");
                        cb(null, {archivefile, size: -1});
                    }
                });
            }
        } catch(err) {
            console.error("MirrorFS._parallel caught error", err.message);
            cb(err);
        }
    }

}
exports = module.exports = SaveFiles;
