// Careful not to introduce too many dependencies in here, as called very early in applications
const os = require('os');
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const glob = require('glob');
const debug = require('debug')('dweb-mirror:MirrorConfig');
const asyncMap = require('async/map');
//const canonicaljson = require('@stratumn/canonicaljson');
const yaml = require('js-yaml'); //https://www.npmjs.com/package/js-yaml
// noinspection JSUnusedLocalSymbols
const ACUtil = require('@internetarchive/dweb-archivecontroller/Util.js'); //for Object.deeperAssign

const userConfigFile =   "~/dweb-mirror.config.yaml"; // Overwritten by writeUser below
// config files (later override earlier) note the userConfigFile is always appended
// If this is ever more than one file in defaultConfigFiles then the code in dweb-archive that for statusFromConfig will need editing as assumes userConfigFile returned in position 1
const defaultConfigFiles = [ "./configDefaults.yaml"];
const defaultUserConfig = {apps: { crawl: { tasks: [] }}};
class MirrorConfig {
    /*
    A set of tools to manage and work on configuration data structures and to map to storage or UI

    Note the API for this is in flux as build the first few use cases

    Note this makes extensive use of the fact that the last of the ...objs can be edited, set back with setopts and leave this changed as expected.
    */
    constructor(...objs) {
        this.configOpts = objs; // For info query
        this.setOpts(...objs);
    }

    // Initialize user config if reqd
    static initializeUserConfig(cb) {
        const f = this.resolve(userConfigFile);
        this.readYaml(f, (err, res) => {
            if (err) {
                this.writeYaml(f, defaultUserConfig,(err) => {
                    if (err) debug("Unable to initialize User config file %s", f);
                    cb(err, defaultUserConfig);
                });
            } else {
                cb(null, res);
            }
        });
    }

    static new(filenames, cb) { //TODO-API
        /* build a new MirrorConfig from a set of options loaded from YAML files,
            filename: filename of file, may use ., .., ~ etc, parameters in later override those in earlier.
        */
        if (typeof filenames === "function") { cb = filenames; filenames = undefined}
        if (!(filenames && filenames.length)) { filenames = defaultConfigFiles; } // Doesnt incude userConfigFile

        asyncMap(this.resolves(filenames),
            (filename, cb2) => {
                this.readYaml(filename, (err, res) => cb2(null, res)); // Ignore err, and res should be {} if error
            },
            (err, configobjs) => { // [ {...}* ]
                if (err) { cb(err, null); } else {
                    this.initializeUserConfig((err, userConfig) => {
                        if (err) { cb(err, null); } else {
                            const config =  new MirrorConfig(...configobjs, userConfig);
                            // noinspection JSUnresolvedVariable
                            debug("config summary: directory:%o archiveui:%s", config.directories, config.archiveui.directory);
                            cb(null, config);
                        }
                    });
                };
            }
        );
    }

    static resolve(v) { // Handle ~ or . or .. in a path
        // noinspection JSUnresolvedVariable
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
        // noinspection JSUnresolvedVariable
        this.archiveui.directory = MirrorConfig.firstExisting(this.archiveui.directories); // Handle ~/ ./ ../ * ?? and find first match
    }

    // noinspection JSUnusedGlobalSymbols
    static readYamlSync(filename) {
        try {
            return yaml.safeLoad(fs.readFileSync(MirrorConfig.resolve(filename), 'utf8'));
        } catch(err) {
            debug("Error reading user configuration: %s", err.message);
            return {};    // Caller is free to ignore err and treat {} as an empty set of config params
        }
    }
    static readYaml(filename, cb) {
        fs.readFile(filename, 'utf8', (err, yamlstr) => {
            if (err) {
                debug("Unable to read %s: %s", filename, err.message);
                cb (err, {});
            } else {
                try {
                    const o = yaml.safeLoad(yamlstr);
                    try { cb(null, o); } catch(err) { console.error("Uncaught err in readYaml cb ", err); }
                } catch(err) {
                    debug("Unable to pass yaml: %s", err.message);
                    cb(err, {});
                }
            }
        })
    }
    writeUser(obj, cb) {
        this.configOpts[this.configOpts.length-1] = obj;
        this.setOpts(obj);                               // Merge into this.
        // By now sendInfo will send correct result back
        // And write to user's file
        MirrorConfig.writeYaml(MirrorConfig.resolve(userConfigFile), obj, cb);
    }

    static writeYaml(filename, obj, cb) {
        fs.writeFile(filename, yaml.safeDump(obj), {encoding: 'utf8'}, (err) => {
            if (err) { debug("Unable to write yaml to %s: %s", filename, err.message); }
            cb(err);
        });
    }

}
exports = module.exports = MirrorConfig;
