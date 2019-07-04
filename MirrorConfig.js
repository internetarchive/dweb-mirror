const debug = require('debug')('dweb-mirror:MirrorConfig');
const ConfigController = require('./ConfigController');
const CrawlManager = require('./CrawlManager');
const {ObjectDeeperAssign} = require('@internetarchive/dweb-archivecontroller/Util');

class MirrorConfig extends ConfigController {
    /*
    Subclass of ConfigController specific to mirroring
     */
    constructor(...objs) {
        super(...objs);
    }

    // Initialize user config if reqd
    static initializeUserConfig(cb) {
        this.initializeUserConfigFile(this.userConfigFile, this.defaultUserConfig, cb);
    }

    static new(filenames, cb) {
        if (typeof filenames === "function") { cb = filenames; filenames = undefined}
        if (!(filenames && filenames.length)) { filenames = this.defaultConfigFiles; } // Doesnt include userConfigFile
        super.new(filenames, cb);
    }

    setOpts(...opts) {
        // Extend base class to handle specific derivations of opts
        super.setOpts(...opts); // Just combined and store ops
        this.directories = ConfigController.resolves(this.directories); // Handle ~/ ./ ../ and expand * or ?? etc
        // noinspection JSUnresolvedVariable
        this.archiveui.directory = ConfigController.firstExisting(this.archiveui.directories); // Handle ~/ ./ ../ * ?? and find first match
    }

    setAndWriteUser(obj, cb) {
        this.setAndWriteUserFile(MirrorConfig.userConfigFile, obj, cb);
    }

    writeUser(cb) {
        this.writeUserFile(MirrorConfig.userConfigFile, cb);
    }

    deleteUserTask(identifier) {
        let task = this.findTask(identifier);
        if (task) {
            if (Array.isArray(task.identifier) && (task.identifier.length > 1)) {
                task.identifier.splice(task.identifier.indexOf(identifier), 1); // Old task - remove identifier
            } else {  // Single identifier or array length=1
                this.apps.crawl.tasks.splice(this.apps.crawl.tasks.indexOf(task), 1);
            }
        }
    }
    writeUserTaskLevel(identifier, level, cb) {
        if (level === "none") {
            this.deleteUserTask(identifier);
        } else {
            let task = this.findTask(identifier);
            if (!task) {
                ObjectDeeperAssign(this, {apps: {crawl: {}}});
                if (!this.apps.crawl.tasks) {
                    this.apps.crawl.tasks = []
                }
                task = {identifier};
                this.apps.crawl.tasks.push(task);
            } else if (Array.isArray(task.identifier) && (task.identifier.length > 1)) {
                task.identifier.splice(task.identifier.indexOf(identifier), 1); // Old task - remove identifier
                task = Object.assign({}, task, {identifier}); // New task for just this identifier
                this.apps.crawl.tasks.push(task);
            }
            // By this point this.apps.crawl.tasks[] should have a task {identifier}, possibly with old state i.e. findTask(identifier) would now succeed
            task.level = level;     // Only change level of that task
        }
        this.writeUser(cb)  // And write back current state
    }
    findTask(identifier) {
        return this.apps.crawl.tasks.find(t => t.identifier.includes(identifier));
    }
    crawlInfo(identifier, mediatype=undefined) {
        /*
           Check if member being crawled and return info suitable for adding into ArchiveMember and usable by the UI
         */
        let task = this.apps.crawl.tasks.find(t => t.identifier.includes(identifier));
        if (!task) {
            task = {}
        } else {
                const isDetailsOrMore = CrawlManager._levels.indexOf(task.level) >= CrawlManager._levels.indexOf("details");
                const isSearch = mediatype === "collection"; //TODO-UXLOCAL need to catch searches
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

