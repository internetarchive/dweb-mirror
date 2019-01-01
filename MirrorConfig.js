const ArchiveFile  = require("@internetarchive/dweb-archivecontroller/ArchiveFile");
const ArchiveItem  = require("@internetarchive/dweb-archivecontroller/ArchiveItem");

class MirrorConfig {
    /*
    A set of tools to manage and work on configuration data structures and to map to storage or UI

    Note the API for this is in flux as build the first few use cases
    */
    constructor(init) {
        Object.keys(init).forEach(f => { this[f] = init[f]; delete init[f] }) // Copy each of init.xx to this.xx
    }
    /*OBSOLETED BY MirrorCrawl
    // noinspection JSUnusedGlobalSymbols
    filterlist(o) {
        if (o instanceof ArchiveItem) {
            // noinspection JSUnresolvedVariable
            if (this.item["minimumForUi"]) {
                return o.minimumForUI();
            } else {
                return o.files;
            }
        } else {
            console.error("Invalid type to MirrorConfig.filterlist", o);
            return []; // Undefined response
        }
    }
    */
    // noinspection JSUnusedGlobalSymbols
    filter(o) { //TODO-CRAWL may neeed adding to crawlOpts etc
        // noinspection JSUnresolvedVariable
        return !((o instanceof ArchiveFile) && (
            (this.file.maxFileSize && this.file.maxFileSize < o.metadata.size)
        ));

    }
}
exports = module.exports = MirrorConfig;
