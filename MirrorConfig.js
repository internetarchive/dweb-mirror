const os = require('os');
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const glob = require('glob');
const debug = require('debug')('dweb-mirror:MirrorConfig');
//const canonicaljson = require('@stratumn/canonicaljson');
const yaml = require('js-yaml');
const ACUtil = require('@internetarchive/dweb-archivecontroller/Util.js'); //for Object.deeperAssign


class MirrorConfig { //TODO-CONFIG TODO-API
    /*
    A set of tools to manage and work on configuration data structures and to map to storage or UI

    Note the API for this is in flux as build the first few use cases
    */
    constructor(...objs) {
        const init = Object.deeperAssign({}, ...objs);
        this.setOpts(init); //note destructive of init
    }
    static resolve(v) { return (v.startsWith("~/") ? path.resolve(os.homedir(), v.slice(2)) : path.resolve(process.cwd(), v)); }

    setOpts(opts) { //TODO-CONFIG use Object.deeperAssign against existing fields
        function firstExisting(arr) {
            // Find the first of arr that exists, args can be relative to the process directory .../dweb-mirror
            // returns undefined if none found
            // noinspection JSUnresolvedVariable
            return arr.map(v=> MirrorConfig.resolve(v)).find(p=>fs.existsSync(p));
        }
        Object.keys(opts).forEach(f => {
            this[f] = opts[f];
            delete opts[f];
        });
        // Support relative paths, and then glob, which returns an array per pattern, so flatten that with concat
        this.directories = [].concat(... // flatten the result
            this.directories.map(v => MirrorConfig.resolve(v))  // Handle ~ or . or ..
                .map(p => glob.sync(p)));        // And expand patterns like * etc
        this.archiveui.directory = firstExisting(this.archiveui.directories);
    }

    static readYamlSync(filename) { //TODO-CONFIG Make callers use a cb then use readYaml
        try {
            //const configuser = canonicaljson.parse(fs.readFileSync(MirrorConfig.resolve("~/dweb-mirror.config.json"), 'utf8'));
            return yaml.safeLoad(fs.readFileSync(MirrorConfig.resolve(filename), 'utf8'));
        } catch(err) {
            debug("Error reading user configuration: %s", err.message);
            return {};    // Caller is free to ignore err and treat {} as an empty set of config params
        }
    }
    static readYaml(filename, cb) {  //TODO-CONFIG Make callers use a cb then use readYaml
        fs.readFile(filename, 'utf8', (err, yamlstr) => {
            if (err) {
                debug("Unable to read %s: %s", filename, err.message);
                cb (err, {});
            } else {
                try {
                    const o = yaml.safeLoad(yamlstr);
                    cb(null, o);
                } catch(err) {
                    debug("Unable to pass yaml: %s", err.message);
                    cb(err, {});
                }
            }
        })
    }

}
exports = module.exports = MirrorConfig;
