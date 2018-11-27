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
TODO update this summary
/info:  config as JSON
/arc/archive.org/metadata/:itemid > DIR/:itemid/(_meta,_files,_reviews) || (dweb:/arc/archive.org/metadata/:itemid > Transports >cache) > { files, files_count, metadata, reviews }
/arc/archive.org/download/:itemid/:filename > DIR/:itemid/:filename || dweb:/arc/archive.org/download/:itemid/:filename > Transports FORK>cache

TODO-GATEWAY - special case for both metadata and download when already on dweb.me will need from archive.org and then replicate stuff gateway does
TODO-OFFLINE - if it detects info fails, then goes offline, doesnt come back if auto-reconnects
 */
// External packages
//Not debugging: express:*
process.env.DEBUG="dweb-mirror:* parallel-streams:* dweb-transports dweb-transports:* dweb-objects dweb-objects:* dweb-archive dweb-archive:*";
//process.env.DEBUG=process.env.DEBUG + " dweb-mirror:mirrorHttp";
const debug = require('debug')('dweb-mirror:mirrorHttp');
const url = require('url');
const express = require('express'); //http://expressjs.com/
const morgan = require('morgan'); //https://www.npmjs.com/package/morgan
const path = require('path');
const ParallelStream = require('parallel-streams');

// IA packages
global.DwebTransports = require('@internetarchive/dweb-transports');
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names
const wrtc = require('wrtc');

// Local files
const config = require('./config'); // Global configuration, will add app specific requirements
const ArchiveFile = require('./ArchiveFilePatched');
const ArchiveItem = require('./ArchiveItemPatched'); // Needed for fetch_metadata patch to use cache
const MirrorCollection = require('./MirrorCollection');
const MirrorSearch = require('./MirrorSearch');

//TODO-HTTP check configuration - presence of config.archiveui.directory and that in it is dweb-{transports,objects}-bundle.js

const app = express();
// noinspection JSUnresolvedVariable
debug('Starting HTTP server on %d', config.apps.http.port);
DwebTransports.p_connect({
    //transports: ["HTTP", "WEBTORRENT", "GUN", "IPFS"],
    transports: ["HTTP"],
    webtorrent: {tracker: { wrtc }},
}).then(() => {
    const Thttp =  DwebTransports.http();
    if (Thttp) Thttp.supportFunctions.push("createReadStream");
}); // Async, handling may fail while this is happening

// noinspection JSUnresolvedVariable
app.use(morgan(config.apps.http.morgan)); //TODO write to a file then recycle that log file (see https://www.npmjs.com/package/morgan )

//app.get('*/', (req, res, next) => { req.url = req.params[0]; next(); } // Strip trailing '/'
app.use((req, res, next) => {
    // Pre Munging - applies to all queries
    debug("STARTING: %s",req.url);
    /* Turn the range headers on a req into an options parameter can use in streams */
    const range = req.range(Infinity);
    if (range && range[0] && range.type === "bytes"){
        req.streamOpts = {start: range[0].start, end: range[0].end};
        debug("Range request = %O", range);
    }
    next();
});


function loadedAI({itemid=undefined, metaapi=undefined}={}, cb) {
    // Get an ArchiveItem, from net or cache
    new ArchiveItem({itemid, metaapi})
        .fetch_metadata((err, ai) => {
        if (err) {
            debug("loadedAI: Unable to retrieve metadata for %s", itemid);
            cb(err);
        } else {
            debug("loadedAI: Retrieved metadata for %s", ai.metadata.identifier); // Combined data metadata/files/reviews
            cb(null, ai);
        }
    });
}

// Serving static (e.g. UI) files
//app.use('/arc/archive.org/download/', express.static(config.directory)); // Simplistic, better ...

function _sendFileFromDir(req, res, next, dir) {
    /* send a file, dropping through to next if it fails,
       dir: Directory path, not ending in /
     */
    const filepath = path.join(dir, req.params[0]); //TODO-WINDOWS will need to split and re-join params[0]
    res.sendFile(filepath, function (err) {
        if (err) {
            debug('No file in: %s', filepath);
            next(); // Drop through to next attempt - will probably fail
        } else {
            debug("sent file %s", filepath);
        }
    });
}

function _proxy(req, res, next, err, s, headers) {
    if (err) {
        debug("Failed to proxy", err.message);
        next(err);
    } else {
        res.status(200); // Assume error if dont get here
        res.set(headers);
        s.pipe(res);
    }
}
function sendRelated(req, res, next) {
    const itemid = req.params[0];
    loadedAI({itemid}, (err, archiveitem) => {
        if (err) { next(err);}
        else {
            // noinspection JSUnresolvedVariable
            archiveitem.relatedItems({
                cacheDirectory: config.directory,
                wantStream: true
            }, (err, s) => _proxy(req, res, next, err, s, {"Content-Type": "application/json"}));
        }
    })
}
// There are a couple of proxies e.g. proxy-http-express but it disables streaming when headers are modified.
function proxyUrl(req, res, next, urlbase, headers={}) {
    // Proxy a request to somewhere under urlbase, which should NOT end with /
    const url = [urlbase, req.params[0]].join('/');
    DwebTransports.createReadStream(url, req.streamOpts, (err, s) => {
        if (err) {
            debug("Unable to fetch %s err=%s", url, err.message);
            next(err);
        } else {
            res.status(200); // Assume error if dont get here
            res.set(headers);
            s.pipe(res);
        }
    })
}


function sendrange(req, res, val) {
    const range = req.range(Infinity);
    if (range && range[0] && range.type === "bytes" && (range[0].start !== 0 || range[0].end !== Infinity)) {
        debug("Range request = %O", range);
        //TODO-RANGE copy Content-Range from download:itemid
        res.status(206).send(val.slice(range[0].start, range[0].end + 1));
    } else {
        res.status(200).send(val);
    }
}

function temp(req, res, next) {

    console.log(req);
    next();
}

function streamArchiveFile(req, res, next) {
    try {
        const filename = req.params[0]; // Use this form since filename may contain '/' so can't use :filename
        const itemid = req.params['itemid'];
        debug('Sending ArchiveFile %s/%s', itemid, filename);
        loadedAI({itemid}, (err, archiveitem) => { // ArchiveFile.p_new can do this, but wont use cached metadata
            ArchiveFile.p_new({itemid: itemid, archiveitem, filename}, (err, af) => {
                if (err) {
                    debug("ArchiveFile.p_new({itemid:%s, filename:%s}) failed: %s", itemid, filename, err.message);
                    res.status(404).send(err.message);
                } else {
                    res.status(req.streamOpts ? 206 : 200);
                    res.set('Accept-ranges', 'bytes');
                    if (req.streamOpts) res.set("Content-Range", `bytes ${req.streamOpts.start}-${Math.min(req.streamOpts.end, af.metadata.size) - 1}/${af.metadata.size}`);
                    // noinspection JSUnresolvedVariable
                    const opts = Object.assign({}, req.streamOpts, {
                        cacheDirectory: config.directory,
                        wantStream: true
                    });
                    res.set("Content-Type", af.mimetype());   // Not sure what happens if doesn't find it.

                    // Note will *not* cache if pass opts other than start:0 end:undefined|Infinity
                    af.cacheAndOrStream(opts, (err, s) => {
                        if (err) {
                            next(err);
                        }
                        else {
                            s
                                .pipe(ParallelStream.log(m => `${itemid}/${filename} ${JSON.stringify(opts)} len=${m.length}`, {
                                    name: "crsdata",
                                    objectMode: false
                                })) //Just debugging stream on way in
                                .pipe(res);
                        }
                    });
                    debug("XXX=completed");
                    //TODO-CACHE Look at cacheControl in options https://expressjs.com/en/4x/api.html#res.sendFile
                }
            });
        });
    } catch (err) {
        debug('ERROR caught unhandled error in streamArchiveFile for %s: %s', req.url, err.message);
        next(err);
    }
}

function streamQuery(req, res, next) {
    let o;
    // especially: `${Util.gatewayServer()}${Util.gateway.url_advancedsearch}?output=json&q=${encodeURIComponent(this.query)}&rows=${this.limit}&page=${this.page}&sort[]=${sort}&and[]=${this.and}&save=yes`;
    if (req.query.q && req.query.q.startsWith("collection:") && (req.query.q.lastIndexOf(':') === 10)) { // Only interested in standardised q=collection:ITEMID
        const itemid = req.query.q.split(':').pop();
        o = new MirrorCollection({sort: req.query.sort, itemid})
    } else {
        o = new MirrorSearch({sort: req.query.sort, query: req.query.q});
    }
    o.limit = parseInt(req.query.rows, 10);
    o.page=parseInt(req.query.page, 10); // Page incrementing is done by anything iterating over pages, not at this point
    o.and=req.query.and; // I dont believe this is used anywhere
    o.fetch_metadata((err, resp) => {
        if (err) {
            debug('streamQuery couldnt fetch metadata for %s',o.itemid);
            next(err);
        } else {
            o.fetch_query({wantFullResp: true}, (err, resp) => {
                if (err) {
                    debug('streamQuery for q="%s" failed with %s', o.query, err.message );
                    next(err);
                } else {
                    res.json(resp);
                }
            });
        }
    });

}


function streamThumbnail(req, res, next) {
    const itemid = req.params['itemid'];
    debug('Sending Thumbnail for %s', itemid);
    loadedAI({itemid}, (err, archiveitem) => { // ArchiveFile.p_new can do this, but wont use cached metadata
        if (err) { // Failed to load itemid
            next(err);
        } else {
            // noinspection JSUnresolvedVariable
            archiveitem.saveThumbnail({cacheDirectory: config.directory, wantStream: true}, (err, s) => {
                if (err) {
                    debug("item %s.saveThumbnail failed: %s", itemid, err.message);
                    next(err);
                } else {
                    res.status(200); // Assume error if dont get here
                    res.set({"Content-Type": "image/jpeg; charset=UTF-8"} );
                    s.pipe(res);
                }
            });
        }
    });
}

app.get('/arc/archive.org', (req, res) => { res.redirect(url.format({pathname: "/archive/archive.html", query: req.query})); });
app.get('/arc/archive.org/advancedsearch', streamQuery);
app.get('/arc/archive.org/details', (req, res) => { res.redirect(url.format({pathname: "/archive/archive.html", query: req.query})); });
// noinspection JSUnresolvedFunction
app.get('/arc/archive.org/details/:itemid', (req, res) => {
    req.query.item = req.params['itemid']; // Move itemid into query
    res.redirect(url.format({pathname: "/archive/archive.html", query: req.query})); // and redirect to the html file
});
// noinspection JSUnresolvedFunction
app.get('/arc/archive.org/download/:itemid/__ia_thumb.jpg', (req, res, next) => streamThumbnail(req, res, next) ); //streamThumbnail will try archive.org/services/img/itemid if all else fails
app.get('/arc/archive.org/download/:itemid/*', streamArchiveFile);
// noinspection JSUnresolvedFunction
app.get('/arc/archive.org/images/*',  function(req, res, next) { // noinspection JSUnresolvedVariable
    _sendFileFromDir(req, res, next, config.archiveui.directory+"/images" ); } );
app.get('/images/*',  function(req, res, next) { // noinspection JSUnresolvedVariable - used in archive.js for /images/footer.png
    _sendFileFromDir(req, res, next, config.archiveui.directory+"/images" ); } );

// metadata handles two cases - either the metadata exists in the cache, or if not is fetched and stored.
// noinspection JSUnresolvedFunction
app.get('/arc/archive.org/metadata/:itemid', function(req, res, next) {
    loadedAI({itemid: req.params.itemid}, (err, ai) => {
        if (err) {
            next(err);
        } else {
            res.json(ai.exportMetadataAPI());
        }
    })
});
app.get('/arc/archive.org/metadata/*', function(req, res, next) {
    proxyUrl(req, res, next, config.archiveorg.metadata,{"Content-Type": "application/json"} )}); //TODO should be retrieving. patching into main metadata and saving
// noinspection JSUnresolvedFunction
app.get('/arc/archive.org/mds/v1/get_related/all/*', sendRelated);
// noinspection JSUnresolvedFunction
app.get('/arc/archive.org/mds/*', function(req, res, next) { // noinspection JSUnresolvedVariable
    proxyUrl(req, res, next, config.archiveorg.mds, {"Content-Type": "application/json"} )}); //TODO-CONFIG and also handle APIs better
// noinspection JSUnresolvedFunction
app.get('/arc/archive.org/serve/:itemid/*', streamArchiveFile);
// noinspection JSUnresolvedFunction
app.get('/arc/archive.org/services/img/:itemid', (req, res, next) => streamThumbnail(req, res, next) ); //streamThumbnail will try archive.org/services/img/itemid if all else fails
// noinspection JSUnresolvedFunction
app.get('/arc/archive.org/thumbnail/:itemid', (req, res, next) => streamThumbnail(req, res, next) ); //streamThumbnail will try archive.org/services/img/itemid if all else fails
// noinspection JSUnresolvedFunction
app.get('/archive/*',  function(req, res, next) { // noinspection JSUnresolvedVariable
    _sendFileFromDir(req, res, next, config.archiveui.directory ); } );

//TODO add generic fallback to use Domain.js for name lookup

// noinspection JSUnresolvedVariable
app.get('/favicon.ico', (req, res, next) => res.sendFile( config.archiveui.directory+"/favicon.ico", (err)=>err ? next(err) : debug('sent /favicon.ico')) );

// noinspection JSUnresolvedFunction
app.get('/info', function(req, res) {
    res.status(200).set('Accept-Ranges','bytes').json({"config": config}); //TODO this may change to include info on transports (IPFS, WebTransport etc)
});

// noinspection JSUnresolvedFunction
app.get('/testing', function(req, res) {
    sendrange(req, res, 'hello my world'); //TODO say something about configuration etc
});

app.use((req,res,next) => {
    debug("FAILING: %s",req.url);
    next();
})

// noinspection JSUnresolvedVariable
app.listen(config.apps.http.port); // Intentionally same port as Python gateway defaults to, api should converge

