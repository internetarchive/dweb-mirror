//Standard repos
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
// Other files from this repo
const MirrorSearch = require('./MirrorSearch');
const stringify = require('canonical-json');

class MirrorCollection extends MirrorSearch {
    /*
    A class to manage an Internet Archive 'Collection' by a special kind of query
    This handles all three kinds of collections since ArchiveItem does: (info in item; list in collection; query in collection)

     */

    constructor(options) {
        /*
        options {
            itemid:     the item to fetch - required if "item" not specified
            item:       if already fetched, usually not
        }
        */
        options.query = 'collection:'+options.itemid; // Used by ArchiveItem.fetch
        options.sort = options.sort || "-downloads"; // Used by ArchiveItem.fetch
        delete options.sort;
        super(options);
    }



    save({cacheDirectory=undefined}={}, cb) {
        /*
            Save _meta and _members as JSON
        */
        super.save({cacheDirectory}, (err) => { // Save meta
            if (err) {
                if (cb) { cb(err); } else { throw(err); } ; // Pass it up (will already have output error to console)
            } else {
                // Now write the members
                let itemid = this.item.metadata.identifier;
                let filepath = path.join(this._dirpath(cacheDirectory), itemid + "_members.json");
                fs.writeFile(filepath,
                    stringify(this.items),
                    (err) => {
                        if (err) {
                            console.error("Unable to write to %s: %s", filepath, err.message);
                            if (cb) { cb(err) } else { throw(err) } ; // Pass it up
                        } else {
                            if (cb) cb(null, this);
                        } } );

            }
        })
    }

}

exports = module.exports = MirrorCollection;
