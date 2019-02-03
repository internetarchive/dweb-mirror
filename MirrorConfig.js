const os = require('os');
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const glob = require('glob');
const debug = require('debug')('dweb-mirror:MirrorConfig');
//const canonicaljson = require('@stratumn/canonicaljson');
const yaml = require('js-yaml');
const ACUtil = require('@internetarchive/dweb-archivecontroller/Util.js'); //for Object.deeperAssign


class MirrorConfig {
    /*
    A set of tools to manage and work on configuration data structures and to map to storage or UI

    Note the API for this is in flux as build the first few use cases
    */
    constructor(...objs) {
        this.setOpts(...objs);
    }
    static resolve(v) { // Handle ~ or . or .. in a path
        return (v.startsWith("~/") ? path.resolve(os.homedir(), v.slice(2)) : path.resolve(process.cwd(), v)); }

    static resolves(vv) {
        return [].concat(...  // flatten result
            vv.map(v => this.resolve(v))    // Handle ~ or . or ..
                .map(p => glob.sync(p)));           // And expand * etc (to an array of arrays)
    }
    static firstExisting(arr) {
            // Find the first of arr that exists, args can be relative to the process directory .../dweb-mirror
            // returns undefined if none found
            // noinspection JSUnresolvedVariable
            return this.resolves(arr).find(p=>fs.existsSync(p));
    }

    setOpts(...opts) {
        Object.deeperAssign(this, ...opts);
        this.directories = MirrorConfig.resolves(this.directories); // Handle ~/ ./ ../ and expand * or ?? etc
        this.archiveui.directory = MirrorConfig.firstExisting(this.archiveui.directories); // Handle ~/ ./ ../ * ?? and find first match
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
