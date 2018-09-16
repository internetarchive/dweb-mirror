#!/usr/bin/env node
/* Serve the mirrored files via HTTP

This is intended as a fairly generic server for a number of cases, with some configuration to allow for different situations,

See: https://github.com/mitra42/dweb-universal/blob/master/uri%20structure%20for%20http%20server.md

From that doc ...
/arc/archive.org/metadata/:itemid|$ROOT/:itemid/:itemid_meta.json<br/>Domain($URI)|Check disk mirror<br/>then gun (which should fallback)<br/>then http
DONE file, need pass on
/gun/$PATH|transports.get("gun:/gun/$PATH")|GUN client > local peer > Remote peers
/ipfs/$PATH|transports.get("ipfs:/ipfs/$PATH")|IPFS which should fallback to https://ipfs.io
/arc/archive.org/download/:itemid/:filename|$ROOT/:itemid/:filename<br/>Domain($URI)|Look locally then try all dweb locations
/arc/*|Domain($URI)|Should resolve name, load and return or redirect


Summary of below:
/info:  config as JSON
/arc/archive.org/metadata/:itemid > DIR/:itemid/(_meta,_files,_reviews) > { files, files_count, metadata, reviews }  ...
/arc/archive.org/metadata/:itemid > dweb:/arc/archive.org/metadata/:itemid > Transports
/arc/archive.org/download/:itemid/:filename > dweb:/arc/archive.org/download/:itemid/:filename

TODO - special case for both metadata and download when already on dweb.me
TODO - replace download's fetch & send with retrieving a stream and passing on to request
TODO - figure out why Gun not responding
TODO -

 */
// External packages
process.env.DEBUG="express:* dweb-mirror:* dweb-transports dweb-transports:* dweb-objects dweb-objects:*";
//process.env.DEBUG=process.env.DEBUG + " dweb-mirror:mirrorHttp";
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
const ArchiveFile = require('./ArchiveFilePatched');
const ArchiveItem = require('./ArchiveItemPatched');

function sendrange(req, res, val) {
    let range = req.range(Infinity);
    if (range && range[0] && range.type === "bytes") {
        debug("Range request = %O", range);
        res.status(206).send(val.slice(range[0].start, range[0].end + 1));
    } else {
        res.status(200).send(val);
    }
}


const app = express();
debug('Starting HTTP server on %d', config.apps.http.port);
DwebTransports.p_connect({
    transports: ["HTTP", "WEBTORRENT", "GUN", "IPFS"],
    webtorrent: {tracker: { wrtc }},
}); // Async, handling may fail while this is happening

app.use(morgan('combined')); //TODO write to a file then recycle that log file (see https://www.npmjs.com/package/morgan )

app.get('/info', function(req, res) {
    res.status(200).json({"config": config}); //TODO this may change to include info on transports (IPFS, WebTransport etc)
});

// metadata handles two cases - either the metadata exists in the cache, or if not is fetched and stored.
app.get('/arc/archive.org/metadata/:itemid', function(req, res, next) {
    //TODO-CACHE need timing of how long use old metadata
    let ai = new ArchiveItem({itemid: req.params.itemid});
    ai.loadMetadata({cacheDirectory: config.directory}, (err, ai) => {
        if (err) {
            next(err);  // Dont try again
        } else {
            debug("Retrieved metadata for %s", ai.item.metadata.identifier); // Combined data metadata/files/reviews
            res.json(ai.item);
        }
    });
});

//app.use('/arc/archive.org/download/', express.static(config.directory)); // Simplistic, better ...

app.get('/arc/archive.org/download/:itemid/:filename', function(req, res, next) {
    //TODO - move this to subclass of ArchiveItem or ArchiveFile
        let filepath = path.join(config.directory, req.params.itemid, req.params.filename);
        res.sendFile(filepath, function(err) {
            if (err) {
                debug('No local copy of: %s/%s', req.params.itemid, req.params.filename);
                next(); // Drop through to next attempt
            } else {
                debug("sent file %s", filepath);
            }
        }) //TODO-CACHE Look at cacheControl in options https://expressjs.com/en/4x/api.html#res.sendFile
    });
/*
app.get('/arc/archive.org/download/:itemid/:filename', function(req, res) {
    debug("Falling back to transports for %s", req.path);
    ArchiveFile.p_new({itemid: req.params.itemid, filename: req.params.filename}, (err, af) => {
        af.p_urls((err, urls) => {  // Should always return even if urls is []
            DwebTransports.p_rawfetch(urls)
                .then((data) => res.send(data));   //TODO need streaming version THEN merge with file version THEN TODO-CB rewrite w/o promise THEN TODO-CACHE need to cache file (save)
        });
    });
});
*/
app.get('/arc/archive.org/download/:itemid/:filename', function(req, res, next) {
    debug("Falling back to transports to stream %s", req.path);
    ArchiveFile.p_new({itemid: req.params.itemid, filename: req.params.filename}, (err, af) => {
        if (err) {
            debug("ArchiveFile.p_new({itemid:%s, filename:%s}) failed: %s", req.params.itemid, req.params.filename, err.message);
            res.status(404).send(err.message);
        } else {
            let range = req.range(Infinity);
            let opts = {};
            if (range && range[0] && range.type === "bytes") {
                opts = {start: range[0].start, end: range[0].end};
                debug("Range request = %O", range);
                res.status(206);
            } else {
                res.status(200);
            }
            af.p_urls((err, urls) => {  // Should always return even if urls is []
                DwebTransports.p_f_createReadStream(urls)
                    .then((f) => {
                        let s = f(opts); // Stream
                        s.pipe(res);
                    })
                //TODO retest mirroring.js with new fork
                //TODO fork to cache
                //TODO find out why Gun doesnt retrieve metadata
                //TODO find out why metadata not stored in this process, nor is cached version used
                //TODO make stream store in file as well.
                //TODO merge with file version THEN TODO-CB rewrite w/o promise THEN TODO-CACHE need to cache file (save)
            });
        }
    });
});


//TODO get('/arc/archive.org/download/:itemid/:filename => IA or IPFS etc and TODO save these locally and TODO-CACHE check timing

app.get('/testing', function(req, res) {
    sendrange(req, res, 'hello my world'); //TODO say something about configuration etc
});



app.listen(config.apps.http.port); // Intentionally same port as Python gateway defaults to, api should converge

