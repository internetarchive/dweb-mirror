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
const {ObjectDeeperAssign} = require('@internetarchive/dweb-archivecontroller');

class ConfigController {
    /*
    A set of tools to manage and work on configuration data structures and to map to storage or UI

    Note the API for this is in flux as build the first few use cases

    Note this makes extensive use of the fact that the last of the ...objs can be edited, set back with setopts and leave this changed as expected.

    Nothing in ConfigManager is specific to Mirror ... the Mirror specific stuff is in the class below ...

    Dont use this class directly, build a subclass that provides at least writeUser(obj,cb) and initializeUserConfig(cb)

    */
    constructor(...objs) {
        /*
        Create a new config structure from one or more config objects.
        The fields in later arguments (at the root, or nested levels) over-write the previous ones.
        See config file for structure of config
        */
        this.configOpts = objs; // For info query
        this.setOpts(...objs);
    }

    static initializeUserConfigFile(userConfigFile, defaultUserConfig,  cb) {
        /*
        userConfigFile  Path (can be relative) to user config file, that may not exist
        defaultUserConfig   Initial configuration (as object) to set the file to if it does not exist
        cb(err, { config } )
         */
        const f = this.resolve(userConfigFile);
        this.readYaml(f, {silentReadFailure: true}, (err, res) => {
            if (err) {
                this.writeYaml(f, defaultUserConfig, (err) => {
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
    static new(filenames, cb) {
        /*
        Create a new config by reading YAML from filenames in order, (later overriding earlier)
        Requires MirrorConfig to implement initializeUserConfig the results of which override that in the filenames

        filenames   optional ordered array of paths to possible config files (they may be missing), ~/ ./ * etc are expanded (I'm not sure about ../)
        cb(err, config) Called with an instance of MirrorConfig
        */

        asyncMap(this.resolves(filenames),
            (filename, cb2) => {
                this.readYaml(filename, {silentReadFailure: true}, (err, res) => cb2(null, res)); // Ignore err, and res should be {} if error
            },
            (err, configobjs) => { // [ {...}* ]
                if (err) { cb(err, null); } else {
                    this.initializeUserConfig((err, userConfig) => {
                        if (err) { cb(err, null); } else {
                            const config =  new this(...configobjs, userConfig);
                            // noinspection JSUnresolvedVariable
                            debug("config summary: directory:%o archiveui:%s bookreader:%s epubreader %s",
                              config.directories, config.archiveui.directory, config.bookreader.directory, config.epubreader.directory);
                            cb(null, config);
                        }
                    });
                }
            }
        );
    }

    static resolve(v) { // Handle ~ or . or .. in a path
        //Return a resolved filename, expanding ./ ~/ and possibly ../
        // noinspection JSUnresolvedVariable
        return (v.startsWith("~/") ? path.resolve(os.homedir(), v.slice(2)) : path.resolve(process.cwd(), v)); }

    static resolves(vv) { //TODO make async and pass a cb
        //Return an array of resolved filenames, this can also expand `*` etc
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
        /*
        Set some fields of configuration from passed object,
        it expands paths such as ~/foo and ./foo where appropriate.
        Note this currently overwrites anything at the path, but may be modified to use ObjectDeeperassign in future.
         */
        ObjectDeeperAssign(this, ...opts);
        // This is subclassed in MirrorConfig to handle specific derivations
    }

    static readYamlSync(filename) {
        /*
        Read an return YAML from filename
        Throws errors on failure to read, or failure to parse.
         */
        try {
            return yaml.safeLoad(fs.readFileSync(this.resolve(filename), 'utf8'));
        } catch(err) {
            debug("Error reading user configuration: %s", err.message);
            return {};    // Caller is free to ignore err and treat {} as an empty set of config params
        }
    }
    static readYaml(filename, {silentReadFailure=false}={}, cb) {
        /*
        Read YAML from filename and return via cb(err, res),
        or return error if unable to read or parse.
        silent: if true then dont report error on failure to read
        */
        fs.readFile(filename, 'utf8', (err, yamlstr) => {
            if (err) {
                if (!silentReadFailure) {
                    debug("Unable to read %s: %s", filename, err.message);
                }
                cb (err, {});
            } else {
                try {
                    const o = yaml.safeLoad(yamlstr);
                    try { cb(null, o); } catch(err) { debug('ERROR: Uncaught err in readYaml cb %o', err); }
                } catch(err) {
                    debug("Unable to parse yaml: %s", err.message);
                    cb(err, {});
                }
            }
        })
    }

    userConfig() {
        //Return the last configuration file
        return this.configOpts[this.configOpts.length-1]; // Last configOpts is the "user" one that gets written
    }
    setAndwriteUser(obj, cb) {
        cb(new Error("ConfigManager must be subclassed to provide setAndwriteUser"));
    }
    writeUser(obj, cb) {
        cb(new Error("ConfigManager must be subclassed to provide writeUser"));
    }


    writeUserFile(filename, cb) {
        //Write user configuration to filename
        ConfigController.writeYaml(ConfigController.resolve(filename), this.userConfig(), cb);
    }
    setAndWriteUserFile(filename, obj, cb) {
        //Set local configuration in ConfigManager and write to user file
        // obj to replace userconfig
        // filename to store yaml ( ~ ./* ../* etc accepted)
        this.userconfig = obj;
        this.setOpts(obj);                               // Merge into combined options
        // By now sendInfo will send correct result back
        // And write to user's file
        ConfigController.writeYaml(ConfigController.resolve(filename), obj, cb);
    }

    static writeYaml(filename, obj, cb) {
        //Write yaml version of an object to a file
        try {
            const y = yaml.safeDump(obj);
            fs.writeFile(filename, y, {encoding: 'utf8'}, (err) => {
                if (err) { debug("Unable to write yaml to %s: %s", filename, err.message); }
                cb(err);
            });
        } catch(err) { // Typically a yaml dump error
            debug("ERROR unable to write yaml from %O",obj);
            cb(err);
            return;
        }
    }
}

exports = module.exports = ConfigController;
