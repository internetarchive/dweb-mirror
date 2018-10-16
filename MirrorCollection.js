//Standard repos
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const debug = require('debug')('MirrorCollection');
// Other files from this repo
const MirrorSearch = require('./MirrorSearch');
const canonicaljson = require('@stratumn/canonicaljson');
const config = require('./config');

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
                if (cb) { cb(err); } else { throw(err); } // Pass it up (will already have output error to console)
            } else {
                // Now write the members
                const itemid = this.item.metadata.identifier;
                const filepath = path.join(this._dirpath(cacheDirectory), itemid + "_members.json");
                fs.writeFile(filepath,
                    canonicaljson.stringify(this.items),
                    (err) => {
                        if (err) {
                            console.error("Unable to write to %s: %s", filepath, err.message);
                            if (cb) { cb(err) } else { throw(err) } // Pass it up
                        } else {
                            if (cb) cb(null, this);
                        } } );

            }
        })
    }

    async fetch_query() { //- TODO - maybe build cache into AI.fetch_query
        /*  Subclass ArchiveItem.fetch_query to make it check the cache
            Note we can't just define an alternative like load_query() because things like "more"
            It has to be a promise because the fetch_query is ...
            TODO rewrite fetch_query to take a cb or Promise;
         */
        //TODO-CACHE-AGING
        const cacheDirectory = config.directory;    // Cant pass as a parameter because things like "more" won't
        const filepath = path.join(cacheDirectory, this.itemid, this.itemid + "_members.json");
        fs.readFile(filepath, (err, jsonstring) => {
            let arr;
            if (!err)
                arr = canonicaljson.parse(jsonstring);  // Must be an array,
            if (err || arr.length < ((this.page+1)*this.limit) { // Either cant read file (cos yet cached), or it has a smaller set of results
                const res = await super.fetch_query({}, (err, arr) => { // arr will be matching items (not ArchiveItms), fetch_query.items will have the full set to this point (note _list is the files for the item, not the ArchiveItems for the search)
                    if (err) {
                        debug("Failed to fetch_query for %s: %s", this.itemid, err.message); cb(err);
                    } else {
                        fs.writeFile(filepath, canonicaljson.stringify(arr), (err) => {
                            if (err) {
                                debug("Failed to write cached members at %s: %s", err.message); cb(err);
                            } else {
                                cb(null, arr); // Return just the new items found by the query
                        }});
                }});
            } else {
                debug("Using cached version of query"); // TODO test this its not going to be a common case as should probably load the members when read metadata
                let newitems = arr.slice((this.page - 1) * this.limit, this.page * this.limit); // See copy of some of this logic in dweb-mirror.MirrorCollection.fetch_query
                this.items = this.items ? arr : newitems; // Note these are just objects, not ArchiveItems
                // Note that the info in _member.json is less than in Search, so may break some code unless turn into ArchiveItems
                // Note this does NOT support sort, there isnt enough info in members.json to do that
                cb(null, newitems);
        }});
}

exports = module.exports = MirrorCollection;
