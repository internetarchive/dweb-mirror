const debug = require('debug')('dweb-mirror:MirrorConfig');
const forever = require('async/forever');
const ConfigController = require('./ConfigController');
const CrawlManager = require('./CrawlManager');
const {ObjectDeeperAssign} = require('@internetarchive/dweb-archivecontroller');

class MirrorConfig extends ConfigController {
    /*
    Subclass of ConfigController specific to mirroring
     */
    constructor(...objs) {
        super(...objs);
    }

    static initializeUserConfig(cb) {
        //Return user configuration, initializing if required.
        this.initializeUserConfigFile(this.userConfigFile, this.defaultUserConfig, cb);
    }

    static new(filenames, setState, cb) {
        //filenames   Optional list of filenames for configation otherwies uses defaultConfigFiles
        //setState({directories})
        if (typeof filenames === "function") { cb = filenames; filenames = undefined}
        if (!(filenames && filenames.length)) { filenames = this.defaultConfigFiles; } // Doesnt include userConfigFile
        super.new(filenames, (err, config) => {
            if (!err) config.setupPeriodically(setState); // Periodically - rescan Directories;
            cb(err, config);
        });
    }

    resolveDirectories(setState) {
        //TODO note this could be slow - it uses glob.sync - see TODO in ConfigController.resolves
        // Handle ~/ ./ ../ and expand * or ?? etc
        //setState({directories}) optional
        const newDirectories = ConfigController.resolves(
          this.configOpts.filter(c => c.directories).pop().directories // Find last one to define directories
        );
        if (!Array.isArray(this.directories)) this.directories = []; // Handle start when its undefined
        const adding = newDirectories.filter(d => !this.directories.includes(d))
        const removing = this.directories.filter(d => !newDirectories.includes(d))
        if (adding.length || removing.length) {
            if (adding.length) debug("Adding directories %s", adding.join('; '));
             if (removing.length) debug("Removing directories %s", removing.join('; '));
            this.directories = newDirectories;
            if (setState) setState({directories: this.directories});
        }
    }

    setOpts(...opts) {
        // Extend base class to handle specific derivations of opts
        const oldDirectories = this.directories; // Save old directories
        super.setOpts(...opts); // Just combined and store ops
        // Note at this point this.directories will be set to all of them, which is not what we want.
        // Remove first so that resolveDirectories will report what its actually using
        this.directories = oldDirectories; // and restore as actually want only resolv
        this.resolveDirectories(); // Handle ~/ ./ ../ and expand * or ?? etc
        ["archiveui", "bookreader", "epubreader"]
          .map(d => this[d])
          .forEach(o => o.directory = ConfigController.firstExisting(o.directories));  // Handle ~/ ./ ../ * ?? and find first match
    }

    setupPeriodically(setState) {
        // Re-resolve the directories options to see if its changed
        // if changed will update mfs
        if (this.rescanDirectories) {
            forever((next) =>
              setTimeout(() => {
                  this.resolveDirectories(setState);
                  next();
              }, this.rescanDirectories * 1000)
            )
        }
    }

    setAndWriteUser(obj, cb) {
        //Set the configuration in the ConfigManager, and write to user file
        this.setAndWriteUserFile(MirrorConfig.userConfigFile, obj, cb);
    }

    writeUser(cb) {
        //Write user configuration to file
        this.writeUserFile(MirrorConfig.userConfigFile, cb);
    }

    deleteUserTask({identifier, query}) {
        //Remove task for identifier (handles multi-identifier tasks correctly)
        let task = this.findTask({identifier});
        if (task) {
            if (Array.isArray(task.identifier) && (task.identifier.length > 1)) {
                task.identifier.splice(task.identifier.indexOf(identifier), 1); // Old task - remove identifier
            } else {  // Single identifier or array length=1
                this.apps.crawl.tasks.splice(this.apps.crawl.tasks.indexOf(task), 1);
            }
        }
    }
    writeUserTaskLevel({identifier, level, query}, cb) {
        //Update, or create a new task for an identifier (handles multi-identifier tasks correctly)
        if (level === "none") {
            this.deleteUserTask({identifier, query});
        } else {
            let task = this.findTask({identifier, query});
            if (!task) {
                ObjectDeeperAssign(this, {apps: {crawl: {}}});
                if (!this.apps.crawl.tasks) {
                    this.apps.crawl.tasks = []
                }
                task = Object.assign({}, identifier ? {identifier} : null, query ? {query} : null)
                this.apps.crawl.tasks.push(task);
            } else if (Array.isArray(task.identifier) && (task.identifier.length > 1)) {
                task.identifier.splice(task.identifier.indexOf(identifier), 1); // Old task - remove identifier
                task = Object.assign({}, task, {identifier}); // New task for just this identifier
                this.apps.crawl.tasks.push(task);
            }
            // By this point this.apps.crawl.tasks[] should have a task {identifier}, possibly with old state i.e. findTask({identifier}) would now succeed
            task.level = level;     // Only change level of that task
        }
        this.writeUser(cb)  // And write back current state
    }
    findTask({identifier, query}) {
        //Find and return task form config
        return this.apps.crawl.tasks.find(t => (identifier && t.identifier && t.identifier.includes(identifier)) || (query && t.query === query));
    }

    /**
     * Find any task and return crawlInfo (which is the task)
     * @param identifier
     * @param query
     * @param mediatype
     * @returns {identifier, query, search, related } // A task object as in the config.apps.crawl.tasks
     */
    crawlInfo({identifier=undefined, query=undefined, mediatype=undefined}) {
        /*
           Check if member being crawled and return info suitable for adding into ArchiveMember and usable by the UI
         */
        let task = this.findTask({identifier, query});
        if (!task) {
            task = {}
        } else {
                const isDetailsOrMore = CrawlManager._levels.indexOf(task.level) >= CrawlManager._levels.indexOf("details");
                const isSearch = query || (mediatype === "collection") ; //TODO-UXLOCAL need to catch searches (which dont use regular identifiers)
                task.search = task.search || (isDetailsOrMore && isSearch && this.apps.crawl.opts.defaultDetailsSearch);
        }
        return task;
    }
}

MirrorConfig.userConfigFile =   "~/dweb-mirror.config.yaml"; // contents overwritten by writeUser or setAndWriteUser
// Default to just top 30 tiles of home page
MirrorConfig.defaultUserConfig = {apps: {crawl: { tasks: [ { identifier: [ "home"], level: "details", search:[{sort: "-downloads", rows: 30, level: "tile"}]} ]}}};
// config files (later override earlier) note the userConfigFile is always appended
// If this is ever more than one file in defaultConfigFiles then the code in dweb-archive that for statusFromConfig will need editing as assumes userConfigFile returned in position 1
MirrorConfig.defaultConfigFiles = [ "./configDefaults.yaml"];

exports = module.exports = MirrorConfig;

