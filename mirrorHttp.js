#!/usr/bin/env node
/* Serve the mirrored files via HTTP

This is intended as a fairly generic server for a number of cases, with some configuration to allow for different situations,

See: https://github.com/mitra42/dweb-universal/blob/master/uri%20structure%20for%20http%20server.md

From that doc ...
/arc/archive.org/metadata/$ITEMID|$ROOT/$ITEMID/$ITEMID_meta.json<br/>Domain($URI)|Check disk mirror<br/>then gun (which should fallback)<br/>then http
DONE file, need pass on
/gun/$PATH|transports.get("gun:/gun/$PATH")|GUN client > local peer > Remote peers
/ipfs/$PATH|transports.get("ipfs:/ipfs/$PATH")|IPFS which should fallback to https://ipfs.io
/arc/archive.org/download/$ITEMID/$FILE|$ROOT/$ITEMID/$FILE<br/>Domain($URI)|Look locally then try all dweb locations
/arc/*|Domain($URI)|Should resolve name, load and return or redirect

TODO handle range

 */
// External packages
process.env.DEBUG="express:* dweb-mirror:mirrorHttp dweb-transports dweb-transports:* dweb-objects dweb-objects:*";    //TODO-MIRROR comment out when done testing FS
//process.env.DEBUG=process.env.DEBUG + " dweb-mirror:mirrorHttp";    //TODO-MIRROR comment out when done testing FS
const debug = require('debug')('dweb-mirror:mirrorHttp');
const express = require('express'); //http://expressjs.com/
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const morgan = require('morgan'); //https://www.npmjs.com/package/morgan
const path = require('path');

// IA packages
global.DwebTransports = require('@internetarchive/dweb-transports');
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names
const wrtc = require('wrtc');

// Local files
const config = require('./config'); // Global configuration, will add app specific requirements

const app = express();
debug('Starting HTTP server');
DwebTransports.p_connect({
    transports: ["HTTP", "WEBTORRENT", "GUN", "IPFS"],
    webtorrent: {tracker: { wrtc }},
}); // Async, handling may fail while this is happening

app.use(morgan('combined')); //TODO write to a file then recycle that log file (see https://www.npmjs.com/package/morgan )

app.get('/info', function(req, res) {
    console.log("XXX info matches")
    res.status(200).send('hello world'); //TODO say something about configuration etc
});
app.get('/arc/archive.org/metadata/:itemid', function(req, res, next) {
    //TODO - move this to subclass of ArchiveItem once have merged code from other laptop
    let filename = path.join(config.directory, req.params.itemid, `${req.params.itemid}_meta.json`);
    fs.readFile(filename, (err, metadataJson) => {
        if (err) {
            debug('No local copy of: %s', filename);
            next();
        } else {
            let filename = path.join(config.directory, req.params.itemid, `${req.params.itemid}_files.json`);
            fs.readFile(filename, (err, filesJson) => {
                let files = JSON.parse(filesJson);
                let filesCount = files.length;
                if (err) {
                    debug('No local copy of: %s', filename);
                    next();
                } else {
                    let filename = path.join(config.directory, req.params.itemid, `${req.params.itemid}_reviews.json`);
                    fs.readFile(filename, (err, reviewsJson) => {
                        if (err) {
                            debug('No local copy of: %s', filename);
                            next();
                        } else {
                            res.json({
                                //Omitted from standard dweb.archive.org/metadata/foo call as irrelevant and/or unavailable:
                                //  Unavailable but would be good: collection_titles
                                // Unavailable and not needed: created, d1, d2, dir, item_size, server, uniq, workable_servers
                                files: files,
                                files_count: filesCount,
                                metadata: JSON.parse(metadataJson),
                                reviews: JSON.parse(reviewsJson),
                            });
                        }
                    });
                }
            });
        }
    });
});

app.get('/arc/archive.org/metadata/:itemid', function(req, res, next) {
    debug("Falling back to transports for %s", req.path);
    DwebTransports.p_rawfetch('dweb:' + req.path).then(data => {
        debug("Retrieved metadata for %s", data.metadata.identifier); // Combined data metadata/files/reviews
        res.json(data);
        //TODO save these locally
    });
});

app.use('/download/', express.static(config.directory));


app.listen(4244); // Intentionally same port as Python gateway defaults to, api should converge

