// Careful not to introduce too many dependencies in here, as called very early in applications
const os = require('os');
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const glob = require('glob');
const debug = require('debug')('dweb-mirror:ConfigController');
const asyncMap = require('async/map');
//const canonicaljson = require('@stratumn/canonicaljson');
const yaml = require('js-yaml'); //https://www.npmjs.com/package/js-yaml
// noinspection JSUnusedLocalSymbols
const {Object_deeperAssign} = require('@internetarchive/dweb-archivecontroller/Util.js');

class ConfigController {
    /*
    A set of tools to manage and work on configuration data structures and to map to storage or UI

    Note the API for this is in flux as build the first few use cases

    Note this makes extensive use of the fact that the last of the ...objs can be edited, set back with setopts and leave this changed as expected.

    Nothing in ConfigManager is specific to Mirror ... the Mirror specific stuff is in the class below ...

    Dont use this class directly, build a subclass that provides at least writeUser(obj,cb) and initializeUserConfig(cb)

    */
    constructor(...objs) {
        this.configOpts = objs; // For info query
        this.setOpts(...objs);
    }

    static initializeUserConfigFile(userConfigFile, defaultUserConfig,  cb) {
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

    static initializeUserConfig(cb) {
        cb(new Error("ConfigManager must be subclassed to provider initializeUserConfig"));
    }
    static new(filenames, cb) { //TODO-API
        /* build a new ConfigController from a set of options loaded from YAML files,
            filename: filename of file, may use ., .., ~ etc, parameters in later override those in earlier.
        */
        asyncMap(this.resolves(filenames),
            (filename, cb2) => {
                this.readYaml(filename, (err, res) => cb2(null, res)); // Ignore err, and res should be {} if error
            },
            (err, configobjs) => { // [ {...}* ]
                if (err) { cb(err, null); } else {
                    this.initializeUserConfig((err, userConfig) => {
                        if (err) { cb(err, null); } else {
                            const config =  new this(...configobjs, userConfig);
                            // noinspection JSUnresolvedVariable
                            debug("config summary: directory:%o archiveui:%s", config.directories, config.archiveui.directory);
                            cb(null, config);
                        }
                    });
                }
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
        Object_deeperAssign(this, ...opts);
        // This is subclassed in MirrorConfig to handle specific derivations
    }

    static readYamlSync(filename) {
        try {
            return yaml.safeLoad(fs.readFileSync(this.resolve(filename), 'utf8'));
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

    userConfig() {
        return this.configOpts[this.configOpts.length-1]; // Last configOpts is the "user" one that gets written
    }
    setAndwriteUser(obj, cb) {
        cb(new Error("ConfigManager must be subclassed to provide setAndwriteUser"));
    }
    writeUser(obj, cb) {
        cb(new Error("ConfigManager must be subclassed to provide writeUser"));
    }


    writeUserFile(filename, cb) {
        // Write to user's config file
        ConfigController.writeYaml(ConfigController.resolve(filename), this.userConfig(), cb);
    }
    setAndWriteUserFile(filename, obj, cb) {
        this.userconfig = obj;
        this.setOpts(obj);                               // Merge into this.
        // By now sendInfo will send correct result back
        // And write to user's file
        ConfigController.writeYaml(ConfigController.resolve(filename), obj, cb);
    }

    static writeYaml(filename, obj, cb) {
        fs.writeFile(filename, yaml.safeDump(obj), {encoding: 'utf8'}, (err) => {
            if (err) { debug("Unable to write yaml to %s: %s", filename, err.message); }
            cb(err);
        });
    }
}

exports = module.exports = ConfigController;
