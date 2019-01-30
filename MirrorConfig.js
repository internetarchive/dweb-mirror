const os = require('os');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

class MirrorConfig { //TODO-CONFIG TODO-API
    /*
    A set of tools to manage and work on configuration data structures and to map to storage or UI

    Note the API for this is in flux as build the first few use cases
    */
    constructor(init) {
        this.setOpts(init);
    }
    setOpts(opts) {
        function _res(v) { return (v.startsWith("~/") ? path.resolve(os.homedir(), v.slice(2)) : path.resolve(process.cwd(), v)); }
        function firstExisting(arr) {
            // Find the first of arr that exists, args can be relative to the process directory .../dweb-mirror
            // returns undefined if none found
            // noinspection JSUnresolvedVariable
            return arr.map(v=> _res(v)).find(p=>fs.existsSync(p));
        }
        Object.keys(opts).forEach(f => {
            this[f] = opts[f];
            delete opts[f];
        });
        // Support relative paths, and then glob, which returns an array per pattern, so flatten that with concat
        this.directories = [].concat(... // flatten the result
            this.directories.map(v => _res(v))  // Handle ~ or . or ..
                .map(p => glob.sync(p)));        // And expand patterns like * etc
        this.archiveui.directory = firstExisting(this.archiveui.directories);
    }

}
exports = module.exports = MirrorConfig;
