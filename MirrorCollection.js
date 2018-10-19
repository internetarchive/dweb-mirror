//Standard repos
// Other files from this repo
const MirrorSearch = require('./MirrorSearch');

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

}

exports = module.exports = MirrorCollection;
