/*
This file is extensions to ArchiveItem that probably in some form could go back into dweb-archive
TODO write reviews

 */

//Standard repos
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const stringify = require('canonical-json');
// Other IA repos
const ArchiveItem = require('@internetarchive/dweb-archive/ArchiveItem');
// Other files from this repo
const MirrorFS = require('./MirrorFS');
const errors = require('./Errors');


ArchiveItem.prototype._dirpath = function(directory) {
        return path.join(directory, this.item.metadata.identifier);
    };

ArchiveItem.prototype.save = function({directory = undefined} = {}, cb) {
        /*
            Save _meta and _members as JSON
        */
        console.assert(directory, "ArchiveItem needs a directory in order to save");
        let itemid = this.itemid; // Its also in this.item.metadata.identifier but only if done a fetch_metadata
        let dirpath = this._dirpath(directory);
        MirrorFS._mkdir(dirpath, (err) => {
            if (err) {
                console.error("Unable to _mkdir %s so cant save meta or members for collection: %s", dirpath, err.message);
                if (cb) { cb(err); } else { throw(err); }; // Pass it up
            } else {
                let filepath = path.join(dirpath, itemid + "_meta.json");
                fs.writeFile(filepath,
                    stringify(this.item.metadata),
                    (err) => {
                        if (err) {
                            console.error("Unable to write to %s: %s", filepath, err.message);
                            if (cb) { cb(err); } else { throw(err); }; // Pass it up
                        } else {
                            cb(null, this);
                        }
                    });

            }
        });
    }
ArchiveItem.prototype.read = function({directory = undefined} = {}, cb) {
        let filename = path.join(directory, this.itemid, `${this.itemid}_meta.json`);
        fs.readFile(filename, (err, metadataJson) => {
            if (err) {
                cb(new errors.NoLocalCopy());
            } else {
                let filename = path.join(directory, this.itemid, `${this.itemid}_files.json`);
                fs.readFile(filename, (err, filesJson) => {
                    let files = JSON.parse(filesJson);
                    let filesCount = files.length;
                    if (err) {
                        cb(new errors.NoLocalCopy());
                    } else {
                        let filename = path.join(directory, this.itemid, `${this.itemid}_reviews.json`);
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
                                        metadata: JSON.parse(metadataJson),
                                        reviews: JSON.parse(reviewsJson),
                                    });
                            }
                        });
                    }
                });
            }
        });
    }

exports = module.exports = ArchiveItem;