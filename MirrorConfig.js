const os = require('os');
const fs = require('fs');

class MirrorConfig {
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
            return arr.map(v=> _res[v]).find(p=>fs.existsSync(p));
        }
        Object.keys(init).forEach(f => {
            this[f] = init[f];
            delete init[f];
            this.directories = this.directories.map(v => _res(v));
            this.archiveui.directory = firstExisting(this.archiveui.directories);
        });
    }

}
exports = module.exports = MirrorConfig;
