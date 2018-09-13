//const ArchiveFile = require('@internetarchive/dweb-archive/ArchiveFile.js');
const ArchiveFile = require('./ArchiveFilePatched.js');
const DwebTransports = require('@internetarchive/dweb-transports');
const path = require('path');
const ParallelStream = require('parallel-streams');


class SaveFiles extends ParallelStream {
    /*
    input: Stream of ArchiveFile
    output: {archivefile, size} where size is -1 if nothing saved (because sha1 matched.

    options {
        directory: Parent of Items
        skipfetchfile: true for debugging - dont actually fetch the file
        }
     */

    constructor(options = {}) {
        const defaultoptions = {
            paralleloptions: {limit: 10, retryms: 100},
            name: "SaveFiles",
        };
        super(Object.assign(defaultoptions, options));
        this.directory = options.directory;
        this.skipfetchfile = options.skipfetchfile;
    }

    _parallel(archivefile, encoding, cb) {    // A archivefile got written to this stream, fetch and store
        /*
        _parallel has same profile as _transform except is run in parallel
        All paths through this must end with a cb with an optional final data.
        It is allowable to use this.push() before the final cb() but not after.
        */
        function cb2(err, size) { cb(err, {archivefile, size}); }
        try {
            archivefile.checkShaAndSave({directory: this.directory, skipfetchfile: this.skipfetchfile}, cb2);
        } catch(err) {
            console.error("MirrorFS._parallel caught error", err.message);
            cb(err);
        }
    }

}
exports = module.exports = SaveFiles;
