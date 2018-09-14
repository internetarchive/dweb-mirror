const ArchiveItem = require('./ArchiveItemPatched');

class MirrorSearch extends ArchiveItem {
    constructor(options) {
        /*
        Inherited:
        itemid:     the item to fetch - required if "item" not specified
        item:       if already fetched, usually not

        Local - stored and deleted
        query:      Search query (will be specific to collection in MirrorCollection subclass
        sort:  ("-downloads") Sort order (
        other options   Stored on this.options
        */
        super(options); // Use and delete item and itemid
        this.query = options.query; // Used by ArchiveItem.fetch
        delete options.query;
        this.sort = options.sort || "-downloads";   // Used by ArchiveItem.fetch
        delete options.sort;
        this.options = options;
    }
}

exports = module.exports = MirrorSearch;