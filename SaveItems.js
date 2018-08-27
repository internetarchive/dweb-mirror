process.env.NODE_DEBUG="fs";    //TODO-MIRROR comment out when done testing FS
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const ArchiveItem = require('@internetarchive/dweb-archive/ArchiveItem.js');
const path = require('path');
const MirrorFS = require('./MirrorFS');

class SaveItems extends MirrorFS {
    /*
    input: Stream of ArchiveItems
    output: Stream of ArchiveItems

    TODO write reviews and write metadata for collections
     */

    constructor(options = {}) {
        const defaultoptions = {
            paralleloptions: {limit: 10, retryms: 100},
            name: "SaveItems",
        };
        super(Object.assign(defaultoptions, options));
        this.directory = options.directory;
    }

    _filepath(o) {
        return (
                  o instanceof ArchiveItem ? path.join(this.directory, o.item.metadata.identifier, o.item.metadata.identifier +"._meta.json")
                : undefined );
    }

    _parallel(archiveitem, encoding, cb) {    // A archivefile got written to this stream, fetch and store
        // Save the metadata for the item
        if (typeof encoding === 'function') { cb = encoding; encoding = null; }
        let filepath = this._filepath(archiveitem); // TODO needs metadata filepath
        this._mkdir(path.dirname(filepath), (err) => {
            if (err) {
                this.debug("Unable to _mkdir so cant save meta: %s", err.message);
                cb(err); // Pass it up
            } else {
                fs.writeFile(filepath,
                    JSON.stringify(archiveitem.item.metadata),  // TODO check this is under the metadata, not the files etc
                    (err) => {
                        if (err) {
                            this.debug("Unable to write to %s: %s", filepath, err.message);
                            cb(err); // Pass it up
                        } else {
                            cb(archiveitem)
                        }
                    }
                );
            }
        });
    }

}

exports = module.exports = SaveItems;
