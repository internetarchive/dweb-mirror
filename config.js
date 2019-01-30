// Standard repos
const debug = require('debug')("dweb-mirror:config");
// Other files in this repo
const MirrorConfig = require('./MirrorConfig');
const configDefaults = require('./configDefaults.js');
const ACUtil = require('@internetarchive/dweb-archivecontroller/Util.js'); //for Object.deeperAssign

// Note duplicates of this in config and crawl.js

configvalues = Object.deeperAssign({}, configDefaults, READ JSON FROM somewhere)



const config = new MirrorConfig(configDefaults); //TODO-CONFIG TODO-API
debug("config summary: directory:%o archiveui:%s", config.directories, config.archiveui.directory);

exports = module.exports = config;
