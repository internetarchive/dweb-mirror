/* OBSOLETED
//Standard repos
// Other files from this repo
const MirrorSearch = require('./MirrorSearch');

class MirrorCollection extends MirrorSearch {
    /-*
    A class to manage an Internet Archive 'Collection' by a special kind of query
    This handles all three kinds of collections since ArchiveItem does: (info in item; list in collection; query in collection)

     *-/

    constructor({itemid=undefined, metaapi=undefined, sort="-downloads"}={}) {
        /-*
        options {
            itemid:     the item to fetch - required if "item" not specified
            item:       if already fetched, usually not
        }
        *-/
        super({itemid, metaapi, sort, query:'collection:'+itemid});
    }

}

exports = module.exports = MirrorCollection;
*/