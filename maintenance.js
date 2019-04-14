#!/usr/bin/env node
// noinspection JSUnresolvedVariable
process.env.DEBUG="dweb-transports dweb-transports:* dweb-archivecontroller:* dweb-mirror:* parallel-streams:* dweb-objects dweb-objects:* dweb-mirror:HashStore";  // Get highest level debugging of these two libraries, must be before require(dweb-transports) //TODO-MIRROR check using GUN for metadata

// noinspection JSUnusedLocalSymbols
const debug = require('debug')("dweb-mirror:maintenance");
// Other IA repos
// noinspection JSUndefinedPropertyAssignment
global.DwebTransports = require('@internetarchive/dweb-transports');
// noinspection JSUndefinedPropertyAssignment
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names

//This Repo
// noinspection JSUnusedLocalSymbols
const ArchiveItem = require('./ArchiveItemPatched');
// noinspection JSUnusedLocalSymbols
const ArchiveFile = require('./ArchiveFilePatched');
const ArchiveMember = require('./ArchiveMemberPatched');
const MirrorConfig = require('./MirrorConfig');
const MirrorFS = require('./MirrorFS');
const HashStore = require('./HashStore');

MirrorConfig.new((err, config) => {

// noinspection JSUnresolvedVariable
    MirrorFS.init({
        directories: config.directories,
        httpServer: "http://localhost:" + config.apps.http.port,
        preferredStreamTransports: config.connect.preferredStreamTransports
    });
    MirrorFS.maintenance({ipfs: true}, (err, res) => console.log("maintenance done", err, res));

    /* Note that nothing above here requires connecting,

     */
    /*
    DwebTransports.connect({
        //transports: ["HTTP", "WEBTORRENT", "IPFS"],
        transports: ["HTTP"],
        //webtorrent: {tracker: { wrtc }},
    }, (err, unused) => {
        if (err) {
            debug("Failed to connect");
        } else {
        }
    });
    */
})