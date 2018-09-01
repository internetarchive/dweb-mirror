process.env.NODE_DEBUG="fs";    //TODO-MIRROR comment out when done testing FS
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const MirrorSearch = require('./MirrorSearch');  //TODO-MIRROR move to repo
const path = require('path');
const MirrorFS = require('./MirrorFS');

class MirrorCollection extends MirrorSearch {
    /*
    A class to manage an Internet Archive 'Collection' by a special kind of query

    TODO - handle other kinds of collections - https://github.com/internetarchive/dweb-mirror/issues/30
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

    _dirpath({directory=undefined}) {
        console.log("XXX", directory, this.item.metadata.identifier);
        return path.join(directory, this.item.metadata.identifier);
    }


    save({directory=undefined}={}, cb) {
        /*
            Save _meta and _members as JSON 
        */
        let dirpath = this._dirpath({directory});
        let itemid = this.item.metadata.identifier;
        MirrorFS._mkdir(dirpath, (err) => {
            if (err) {
                console.error("Unable to _mkdir %s so cant save meta or members for collection: %s", dirpath, err.message);
                if (cb) { cb(err) } else { throw(err) } ; // Pass it up
            } else {
                let filepath = path.join(dirpath, itemid + "_meta.json");
                fs.writeFile(filepath,
                    JSON.stringify(this.item.metadata),
                    (err) => {
                        if (err) {
                            console.error("Unable to write to %s: %s", filepath, err.message);
                            if (cb) { cb(err) } else { throw(err) } ; // Pass it up
                        } else {
                            // Now write the members
                            let filepath = path.join(dirpath, itemid + "_members.json");
                            fs.writeFile(filepath,
                                         JSON.stringify(this.items),
                                         (err) => {
                                            if (err) {
                                                console.error("Unable to write to %s: %s", filepath, err.message);
                                                if (cb) { cb(err) } else { throw(err) } ; // Pass it up
                                            } else {
                                                if (cb) cb(this);
                                            } } );
                        } } );
              
            } } );
    }

}

exports = module.exports = MirrorCollection;
