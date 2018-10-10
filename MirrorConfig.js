const ArchiveFile  = require("@internetarchive/dweb-archive/ArchiveFile");
const ArchiveItem  = require("@internetarchive/dweb-archive/ArchiveItem");

class MirrorConfig {
    /*
    A set of tools to manage and work on configuration data structures and to map to storage or UI

    Note the API for this is in flux as build the first few use cases

    Fields
    config: {
        // Miscellaneous used in mirroring - may be changed to a canonical version
            directory: "/Users/mitra/temp/mirrored",
            limittotalfiles: 250,
        file: { // Configuration (especially filtering) relating to any file
            maxfilesize: 1000000,
        }
        item: {
            minimumForUi: true, // Select a minimum set of files that are required to play the item in the Archive UI
        }
        search: {
            itemsperpage: // Optimum is probably around 100
            pagespersearch: // Number of pages to search, so total max results is pagespersearch * itemsperpage
        }
        collections: { // Specific parameters relating to each collection, also used as a list of collections to operate on
            <collectionid>: {},
        }
    }
    */
    constructor(init) {
        Object.keys(init).forEach(f => { this[f] = init[f]; delete init[f] }) // Copy each of init.xx to this.xx
    }
    // noinspection JSUnusedGlobalSymbols
    filterlist(o) {
        if (o instanceof ArchiveItem) {
            // noinspection JSUnresolvedVariable
            if (this.item["minimumForUi"]) {
                return o.minimumForUI();
            } else {
                return o._list;
            }
        } else {
            console.error("Invalid type to MirrorConfig.filterlist", o);
            return []; // Undefined response
        }
    }
    // noinspection JSUnusedGlobalSymbols
    filter(o) {
        // noinspection JSUnresolvedVariable
        return !((o instanceof ArchiveFile) && (
            (this.file.maxfilesize && this.file.maxfilesize < o.metadata.size)
        ));

    }
}
exports = module.exports = MirrorConfig;
