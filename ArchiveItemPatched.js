/*
This file is extensions to ArchiveItem that probably in some form could go back into dweb-archive

 */

//Standard repos
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const debug = require('debug')('dweb-mirror:ArchiveItem');
const canonicaljson = require('@stratumn/canonicaljson');
// Other IA repos
const ArchiveItem = require('@internetarchive/dweb-archive/ArchiveItem');
// Other files from this repo
const MirrorFS = require('./MirrorFS');
const errors = require('./Errors');


ArchiveItem.prototype._dirpath = function(directory) {
        return path.join(directory, this.itemid);
    };

ArchiveItem.prototype.save = function({cacheDirectory = undefined} = {}, cb) {
    /*
        Save _meta and _members as JSON
    */
    console.assert(cacheDirectory, "ArchiveItem needs a directory in order to save");
    const itemid = this.itemid; // Its also in this.item.metadata.identifier but only if done a fetch_metadata
    const dirpath = this._dirpath(cacheDirectory);

    function _err(msg, err, cb) {
        console.error(msg, err);
        if (cb) {
            cb(err);
        } else {
            throw(err)
        }
    }

    MirrorFS._mkdir(dirpath, (err) => {
        if (err) {
            _err(`Cannot mkdir ${dirpath} so cant save item ${itemid}`, err, cb);
        } else {
            const filepath = path.join(dirpath, itemid + "_meta.json");
            fs.writeFile(filepath, canonicaljson.stringify(this.item.metadata), (err) => {
                if (err) {
                    _err(`Unable to write to ${itemid}`, err, cb);
                } else {

                    const filepath = path.join(dirpath, itemid + "_files.json");
                    fs.writeFile(filepath, canonicaljson.stringify(this.item.files), (err) => {
                        if (err) {
                            _err(`Unable to write to ${itemid}`, err, cb);
                        } else {
                            const filepath = path.join(dirpath, itemid + "_reviews.json");
                            fs.writeFile(filepath, canonicaljson.stringify(this.item.reviews), (err) => {
                                if (err) {
                                    _err(`Unable to write to ${itemid}`, err, cb);
                                } else {
                                    // Write any additional info we want that isn't derived from (meta|reviews|files)_xml etc or added by gateway
                                    const filepath = path.join(dirpath, itemid + "_extra.json");
                                    fs.writeFile(filepath, canonicaljson.stringify({collection_titles: this.item.collection_titles}), (err) => {
                                        if (err) {
                                            _err(`Unable to write to ${itemid}`, err, cb);
                                        } else {
                                            cb(null, this);
                                        }
                                    });
                                }
                            })
                        }
                    })
                }
            });
        }
    });
};
ArchiveItem.prototype.read = function({cacheDirectory = undefined} = {}, cb) {
        const filename = path.join(cacheDirectory, this.itemid, `${this.itemid}_meta.json`);
        fs.readFile(filename, (err, metadataJson) => {
            if (err) {
                cb(new errors.NoLocalCopy());
            } else {
                const filename = path.join(cacheDirectory, this.itemid, `${this.itemid}_files.json`);
                fs.readFile(filename, (err, filesJson) => {
                    if (err) {
                        cb(new errors.NoLocalCopy()); // Will typically drop through and try net
                    } else {
                        const files = canonicaljson.parse(filesJson);
                        const filesCount = files.length;

                        const filename = path.join(cacheDirectory, this.itemid, `${this.itemid}_extra.json`);
                        fs.readFile(filename, (err, extraJson) => {
                            if (err) {
                                cb(new errors.NoLocalCopy());
                            } else {
                                const extra = canonicaljson.parse(extraJson);
                                const filename = path.join(cacheDirectory, this.itemid, `${this.itemid}_reviews.json`);
                                fs.readFile(filename, (err, reviewsJson) => {
                                    if (err) {
                                        cb(new errors.NoLocalCopy());
                                    } else {
                                        cb(null, {
                                                //Omitted from standard dweb.archive.org/metadata/foo call as irrelevant and/or unavailable:
                                                //  Unavailable but would be good: collection_titles
                                                // Unavailable and not needed: created, d1, d2, dir, item_size, server, uniq, workable_servers
                                                files: files,
                                                files_count: filesCount,
                                                metadata: canonicaljson.parse(metadataJson),
                                                reviews: canonicaljson.parse(reviewsJson),
                                                collection_titles: extra.collection_titles,
                                            });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    };

ArchiveItem.prototype.loadMetadata = function({cacheDirectory=undefined}={}, cb) {
    /*
    More flexible version of loading metadata
    Alternatives:
    !cacheDirectory:    load from net
    cached:             return from cache
    !cached:            Load from net, save to cache

    cb(err, this)
    TODO fetch_query should probably use loadMetadata but tricky as fetch_query doesnt know the cacheDirectory
     */
    if (cacheDirectory) {
        this.read({cacheDirectory}, (err, metadata) => {
            if (err) {
                this.fetch_metadata((err, ai) => { // Process Fjords and _listload
                    if (err) {
                        cb(err); // Failed to read & failed to fetch
                    } else {
                        ai.save({cacheDirectory}, cb);  // Save data fetched (de-fjorded)
                    }
                });    // resolves to this
            } else {    // Local read succeeded.
                this.item = metadata;
                this._listLoad();
                cb(null, this);
            }
        })
    } else {
        this.fetch_metadata(cb);
    }
};

ArchiveItem.prototype.saveThumbnail = function({cacheDirectory = undefined,  skipfetchfile=false, wantStream=false} = {}, cb) {
    /*
    Save a thumbnail to the cache,
    wantStream      true if want stream instead of ArchiveItem returned
    skipfetchfile   true if should skip net retrieval - used for debugging
    cb(err, this)||cb(err, stream)  Callback on completion with self (mirroring), or on starting with stream (browser)
    */

    console.assert(cacheDirectory, "ArchiveItem needs a directory in order to save");
    const itemid = this.itemid; // Its also in this.item.metadata.identifier but only if done a fetch_metadata
    const dirpath = this._dirpath(cacheDirectory);

    function _err(msg, err, cb) {
        console.error(msg, err);
        if (cb) {   // cb will be undefined if cleared after calling with a stream
            cb(err);
        }
    }

    MirrorFS._mkdir(dirpath, (err) => { // Will almost certainly exist since typically comes after .save
        if (err) {
            _err(`Cannot mkdir ${dirpath} so cant save item ${itemid}`, err, cb);
        } else {
            const self = this; // this not available inside recursable or probably in writable('on)
            const thumbnailFiles = this._list.filter(af =>
                af.metadata.name === "__ia_thumb.jpg"
                || af.metadata.name.endsWith("_itemimage.jpg")
            );
            if (thumbnailFiles.length) {
                // noinspection JSUnusedLocalSymbols
                // Loop through files using recursion (list is always short)
                const recursable = function (err, streamOrUndefined) {
                    if (err) {
                        _err(`saveThumbnail: failed in cacheAndOrStream for ${itemid}`, err, cb)
                    } else {
                        if (streamOrUndefined && cb) { // Passed back from first call to cacheOrStream if wantStream is set
                            cb(null, streamOrUndefined);
                            cb=undefined; } // Clear cb so not called when complete
                        let af;
                        if (typeof(af = thumbnailFiles.shift()) !== "undefined") {
                            af.cacheAndOrStream({cacheDirectory, skipfetchfile, wantStream}, recursable); // Recurse
                            // Exits, allowing recursable to recurse with next iteration
                        } else { // Completed loop
                            // cb will be set except in the case of wantStream in which case will have been called with first stream
                            if (cb) cb(null, self); // Important to cb only after saving, since other file saving might check its SHA and dont want a race condition
                        }
                    }
                };
                recursable(null, null);
            } else {  // No existing __ia_thumb.jpg or ITEMID_itemimage.jpg so get from services or thumbnail
                servicesurl = config.archiveorg.servicesImg + this.itemid;
                // Include direct link to services
                if (!this.item.metadata.thumbnaillinks.includes(servicesurls)) this.item.metadata.thumbnaillinks.push(servicesurl);
                DwebTransports.createReadStream(this.item.metadata.thumbnaillinks, (err, readable) => {
                    if (err) {
                        _err(`Cannot create stream to ${this.item.metadata.thumbnaillinks}`, err, cb);
                    } else {
                        readable.on('error',(err) => {
                            debug("Failed to read thumbnail from net for %s err=%s", self.itemid, err.message);
                        });
                        const filepath = path.join(cacheDirectory, itemid, "__ia_thumb.jpg"); // Assumes using __ia_thumb.jpg instead of ITEMID_itemimage.jpg
                        MirrorFS.writableStreamTo(cacheDirectory, filepath, (err, writable) => {
                            if (wantStream && cb) { cb(null, writable); cb=undefined; }
                            writable.on('close', () => {
                                debug("Written %d to thumbnail file for %s", writable.bytesWritten, itemid);
                                if (cb) cb(null, self);
                            });
                            // TODO havent written error checking, or used a temp file here, its unlikely to fail and if it does just leaves a 0 length thumbnail
                            readable.pipe(writable);   // Pipe the stream from the HTTP or Webtorrent read etc to the stream to the file.
                        });
                    }
                });
            }
        }
    });
};
ArchiveItem.prototype.minimumForUI = function() {
    // This will be tuned for different mediatype etc}
    // Note mediatype will have been retrieved and may have been rewritten by processMetadataFjords from "education"
    console.assert(this._list, "minimumForUI assumes _list already set up");
    const minimumFiles = [];
    const thumbnailFiles = this._list.filter( af =>
        af.metadata.name === "__ia_thumb.jpg"
        || af.metadata.name.endsWith("_itemimage.jpg")
    );
    // Note thumbnail is also explicitly saved by saveThumbnail
    minimumFiles.push(...thumbnailFiles);
    switch (this.item.metadata.mediatype) {
        case "collection": //TODO-THUMBNAILS
            break;
        case "texts": //TODO-THUMBNAILS for text - texts use the Text Reader anyway so dont know which files needed
            break;
        case "image":
            minimumFiles.push(this._list.find(fi => fi.playable("image"))); // First playable image is all we need
            break;
        case "audio":  //TODO-THUMBNAILS check that it can find the image for the thumbnail with the way the UI is done. Maybe make ReactFake handle ArchiveItem as teh <img>
        case "etree":   // Generally treated same as audio, at least for now
            if (!this.playlist) this.setPlaylist();
            // Almost same logic for video & audio
            minimumFiles.push(...Object.values(this.playlist).map(track => track.sources[0].urls)); // First source from each (urls is a single ArchiveFile in this case)
            // Audio uses the thumbnail image, puts URLs direct in html, but that always includes http://dweb.me/thumbnail/itemid which should get canonicalized
            break;
        case "movies":
            if (!this.playlist) this.setPlaylist();
            // Almost same logic for video & audio
            minimumFiles.push(...Object.values(this.playlist).map(track => track.sources[0].urls)); // First source from each (urls is a single ArchiveFile in this case)
            minimumFiles.push(this.videoThumbnailFile());
            break;
        case "account":
            break;
        default:
            //TODO Not yet supporting software, zotero (0 items); data; web because rest of dweb-archive doesnt
    }
    return minimumFiles;
};

exports = module.exports = ArchiveItem;