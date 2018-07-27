const ArchiveItem = require('@internetarchive/dweb-archive/ArchiveItem');

class MirrorSearch extends ArchiveItem {
    constructor(options) {
        /*
        itemid:     the item to fetch - required if "item" not specified
        item:       if already fetched, usually not
        */
        super(options); // Note not passing item
        delete options.item;    // Handled by super
        delete options.itemid;  // Handled by super
        this.query = options.query; // Used by ArchiveItem.fetch
        this.sort = options.sort || "-downloads";   // Used by ArchiveItem.fetch
        delete options.sort;
        this.options = options;
    }
}

exports = module.exports = MirrorSearch;