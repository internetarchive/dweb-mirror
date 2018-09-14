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


ArchiveItem.prototype._dirpath = function(directory) {
        return path.join(directory, this.item.metadata.identifier);
    };

ArchiveItem.prototype.save = function({directory = undefined} = {}, cb) {
        /*
            Save _meta and _members as JSON
        */
        let itemid = this.item.metadata.identifier;
        console.assert(directory, "ArchiveItem needs a directory in order to save");
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

exports = module.exports = ArchiveItem;