const MirrorSearch = require('./MirrorSearch');  //TODO-MIRROR move to repo

class MirrorCollection extends MirrorSearch {
    /*
    A class to manage an Internet Archive 'Collection' by a special kind of query

    TODO - handle other kinds of collections - https://github.com/internetarchive/dweb-mirror/issues/30
     */

    constructor(options) {
        /*
        itemid:     the item to fetch - required if "item" not specified
        item:       if already fetched, usually not
        */
        options.query = 'collection:'+options.itemid; // Used by ArchiveItem.fetch
        options.sort = options.sort || "-downloads"; // Used by ArchiveItem.fetch
        delete options.sort;
        super(options);
    }
}

exports = module.exports = MirrorCollection;