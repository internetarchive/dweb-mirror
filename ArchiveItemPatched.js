/*
This file is extensions to ArchiveItem that probably in some form could go back into dweb-archive
TODO write reviews

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
                this.fetch_metadata((err, ai) => {
                    if (err) {
                        cb(err); // Failed to read & failed to fetch
                    } else {
                        ai.save({cacheDirectory}, cb);  // Save data fetched
                    }
                });    // resolves to this
            } else {    // Local read succeeded.
                this.item = metadata;
                cb(null, this);
            }
        })
    } else {
        this.fetch_metadata(cb);
    }
};

ArchiveItem.prototype.saveThumbnail = function({cacheDirectory = undefined,  skipfetchfile=false} = {}, cb) {

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
                const recursable = function (err, sizeunused) {
                    if (err) {
                        _err(`saveThumbnail: failed in checkShaAndSave for ${itemid}`, err, cb)
                    } else {
                        let af;
                        if (typeof(af = thumbnailFiles.shift()) !== "undefined") {
                            af.checkShaAndSave({cacheDirectory, skipfetchfile}, recursable); // Recurse
                            // Exits, allowing recursable to recurse with next iteration
                        } else {
                            cb(null, self); // Important to cb only after saving, since other file saving might check its SHA and dont want a race condition
                        }
                    }
                };
                recursable(null, null);
            } else {  // No existing __ia_thumb.jpg or ITEMID_itemimage.jpg so get from services or thumbnail
                DwebTransports.createReadStream(this.item.metadata.thumbnaillinks, (err, readable) => {
                    if (err) {
                        _err(`Cannot create stream to ${this.item.metadata.thumbnaillinks}`, err, cb);
                    } else {
                        const filepath = path.join(cacheDirectory, itemid, "__ia_thumb.jpg"); // Assumes using __ia_thumb.jpg instead of ITEMID_itemimage.jpg
                        MirrorFS.writableStreamTo(cacheDirectory, filepath, (err, writable) => {
                            writable.on('close', () => {
                                debug("Written %d to thumbnail file for %s", writable.bytesWritten, itemid);
                                cb(null, self);
                            });
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
    //TODO-THUMBNAILS Get services/img link if thumbnailFiles is empty
    minimumFiles.push(...thumbnailFiles);
    switch (this.item.metadata.mediatype) {
        case "collection": //TODO-THUMBNAILS
            break;
        case "texts": //TODO-THUMBNAILS
            break;
        case "image": //TODO-THUMBNAILS
            break;
        case "audio":  //TODO-THUMBNAILS check that it can find the image for the thumbnail with the way the UI is done. Maybe make ReactFake handle ArchiveItem as teh <img>
            if (!this.playlist) this.setPlaylist();
            // Almost same logic for video & audio
            minimumFiles.push(...Object.values(this.playlist).map(track => track.sources[0].urls)); // First source from each (urls is a single ArchiveFile in this case)
            // Audio uses the thumbnail image, puts URLs direct in html, but that always includes http://dweb.me/thumbnail/itemid which should get canonicalized
            break;
        case "etree": // Concerts uploaded
            break;
        case "movies": //TODO-THUMBNAILS test
            if (!this.playlist) this.setPlaylist();
            // Almost same logic for video & audio
            minimumFiles.push(...Object.values(this.playlist).map(track => track.sources[0].urls)); // First source from each (urls is a single ArchiveFile in this case)
            minimumFiles.push(this.videoThumbnailFile());
            break;
        case "account":
            break;
        default:
            //TODO Not yet supporting software, zotero (0 items); data; web
    }
    return minimumFiles;
};

exports = module.exports = ArchiveItem;