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
}
exports = module.exports = MirrorConfig;
