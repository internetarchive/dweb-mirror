// Standard repos
const debug = require('debug')("dweb-mirror:config");
// Other files in this repo
const MirrorConfig = require('./MirrorConfig');

// Note duplicates of this in config and crawl.js

//console.log(require('js-yaml').safeDump(configDefaults, {noArrayIndent: true})) // Uncomment to get example in yaml
const configuser = MirrorConfig.readYamlSync("~/dweb-mirror.config.yaml"); //TODO-CONFIG move to async readYaml(filename, cb)
const configDefaults = MirrorConfig.readYamlSync("./configDefaults.yaml"); //TODO-CONFIG move to async readYaml(filename, cb)


const config = new MirrorConfig(configDefaults, configuser);
debug("config summary: directory:%o archiveui:%s", config.directories, config.archiveui.directory);

exports = module.exports = config;

/* TODO-CONFIG removing async
    mirrorHttp - async at top
    crawl - async at top
    collectionpreseed - async at top
 */