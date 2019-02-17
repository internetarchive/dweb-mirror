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

See URL_MAPPING.md for summary of below rules plus what they call.

TODO-GATEWAY - special case for both metadata and download when already on dweb.me will need from archive.org and then replicate stuff gateway does
TODO-OFFLINE - if it detects info fails, then goes offline, doesnt come back if auto-reconnects
 */
// External packages
//Not debugging: express:*
// noinspection JSUnresolvedVariable
process.env.DEBUG="dweb-mirror:* parallel-streams:* dweb-transports dweb-transports:* dweb-objects dweb-objects:* dweb-archive dweb-archive:* dweb-archivecontroller:*";
//process.env.DEBUG=process.env.DEBUG + " dweb-mirror:mirrorHttp";
const debug = require('debug')('dweb-mirror:mirrorHttp');
const url = require('url');
const express = require('express'); //http://expressjs.com/
const morgan = require('morgan'); //https://www.npmjs.com/package/morgan
const path = require('path');
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const ParallelStream = require('parallel-streams');
const waterfall = require('async/waterfall');


// IA packages
global.DwebTransports = require('@internetarchive/dweb-transports'); // Must be before DwebObjects
// noinspection JSUndefinedPropertyAssignment
global.DwebObjects = require('@internetarchive/dweb-objects'); //Includes initializing support for names
const ACUtil = require('@internetarchive/dweb-archivecontroller/Util'); // for ACUtil.gateway
//auto test for presence of wrtc, its not available on rachel
let wrtc;
try {
    wrtc = require('wrtc');
} catch(err) {
    debug("wrtc not present");
}
// Local files
const MirrorFS = require('./MirrorFS');
const MirrorConfig = require('./MirrorConfig');
const ArchiveFile = require('./ArchiveFilePatched');
const ArchiveItem = require('./ArchiveItemPatched'); // Needed for fetch_metadata patch to use cache
const ArchiveMember = require('./ArchiveMemberPatched');
// noinspection JSUnusedLocalSymbols
const ArchiveMemberSearch = require('./ArchiveMemberSearchPatched');

const app = express();

MirrorConfig.new((err, config) => {
    if (err) { debug("Exiting because of error", err.message);} else {


// noinspection JSUnresolvedVariable
debug('Starting HTTP server on %d, Caching in %o', config.apps.http.port, config.directories);
MirrorFS.init({directories: config.directories, httpServer:"http://localhost:"+config.apps.http.port, urlUrlstore: config.transports.ipfs.urlUrlstore});
const connectOpts = {
    //transports: ["HTTP", "WEBTORRENT", "GUN", "IPFS"],
    transports: ["HTTP"],
}
if (wrtc) connectOpts.webtorrent = {tracker: {wrtc}}

DwebTransports.p_connect(connectOpts).then(() => {
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
                debug("loadedAI: Retrieved metadata for %s", ai.itemid); // Combined data metadata/files/reviews
                cb(null, ai);
            }
        });
}

// Serving static (e.g. UI) files
//app.use('/arc/archive.org/download/', express.static(dir)); // Simplistic, better ...

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


function sendRelated(req, res, next) {
    const itemid = req.params[0];
    loadedAI({itemid}, (err, archiveitem) => {
        if (err) { next(err);}
        else {
            // noinspection JSUnresolvedVariable
            archiveitem.relatedItems({ wantStream: true}, (err, s) =>
                _proxy(req, res, next, err, s, {"Content-Type": "application/json"}));
        }
    })
}
// There are a couple of proxies e.g. proxy-http-express but it disables streaming when headers are modified.
function proxyUpstream(req, res, next, headers={}) {
    // Note req.url will start with "/"
    // noinspection JSUnresolvedVariable
    proxyUrl(req, res, next, [config.upstream, req.url].join(''), headers);
}
function proxyUrl(req, res, next, url, headers={}) {
    // Proxy a request to somewhere under urlbase, which should NOT end with /
    DwebTransports.createReadStream(url, req.streamOpts, (err, s) => {
        _proxy(req, res, next, err, s, headers);
    })
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

// noinspection JSUnusedLocalSymbols
function temp(req, res, next) {

    console.log(req);
    next();
}

function streamArchiveFile(req, res, next) {
    // Note before this is called req.streamOpts = {start, end}
    //TODO-CACHE-AGING Look at cacheControl in options https://expressjs.com/en/4x/api.html#res.sendFile (maxAge, immutable)
    try {
        const filename = req.params[0]; // Use this form since filename may contain '/' so can't use :filename
        const itemid = req.params['itemid'];
        const opts = Object.assign({}, req.streamOpts, { wantStream: true });
        let af; // Passed out from waterfall to end
        debug('Sending ArchiveFile %s/%s', itemid, filename);
        waterfall([
                (cb) => loadedAI({itemid}, cb),
                (archiveitem, cb) => ArchiveFile.new({archiveitem, filename}, cb),
                // Note will *not* cache if pass opts other than start:0 end:undefined|Infinity
                (archivefile, cb) => {
                    af = archivefile;
                    archivefile.cacheAndOrStream(opts, cb)},
            ],
            (err, s)=> {
                if (err) {
                    // Failed - report
                    debug("streamArchiveFile failed for %s/%s: %s",itemid, filename, err.message);
                    res.status(404).send(err.message);
                } else {
                    // Succeeded - pipe back to user with headers
                    res.status(req.streamOpts ? 206 : 200);
                    res.set('Accept-ranges', 'bytes');
                    if (req.streamOpts) res.set("Content-Range", `bytes ${req.streamOpts.start}-${Math.min(req.streamOpts.end, af.metadata.size) - 1}/${af.metadata.size}`);
                    // noinspection JSUnresolvedVariable
                    res.set("Content-Type", af.mimetype());   // Not sure what happens if doesn't find it.
                    // Uncomment first .pipe to log bytes on way out.
                    s
                        //.pipe(ParallelStream.log(m => `${itemid}/${filename} ${JSON.stringify(opts)} len=${m.length}`, {name: "crsdata",  objectMode: false }))
                        .pipe(res)
                }
            }
        );
    } catch (err) {
        debug('ERROR caught unhandled error in streamArchiveFile for %s: %s', req.url, err.message);
        next(err);
    }
}

function streamQuery(req, res, next) {
    let o;
    // especially: `${Util.gatewayServer()}${Util.gateway.url_advancedsearch}?output=json&q=${encodeURIComponent(this.query)}&rows=${this.rows}&page=${this.page}&sort[]=${sort}&and[]=${this.and}&save=yes`;
    if (req.query.q && req.query.q.startsWith("collection:") && (req.query.q.lastIndexOf(':') === 10)) { // Only interested in standardised q=collection:ITEMID
        // Special case: query just looking for members of a collection
        const itemid = req.query.q.split(':').pop();
        o = new ArchiveItem({sort: req.query.sort, itemid, query: `collection:${itemid}`})
    } else if (req.query.q && req.query.q.startsWith("identifier:")
        && !req.query.q.includes('*')                               // exclude eg identifier:electricsheep-flock*
        && (req.query.q.lastIndexOf(':') === 10)) {
        // Special case: query just looking for fields on a list of identifiers
        const ids = req.query.q.slice(11).split(' OR '); // ["foo","bar"]
        o = new ArchiveItem();
        o.members = ids.map(identifier => new ArchiveMember({identifier}));
        // The members will be expanded by fetch_query either from local cache or by querying upstream
    } else {
        o = new ArchiveItem({sort: req.query.sort, query: req.query.q});
    }
    o.rows = parseInt(req.query.rows, 10);
    o.page=parseInt(req.query.page, 10); // Page incrementing is done by anything iterating over pages, not at this point
    o.and=req.query.and; // I dont believe this is used anywhere
    o.fetch_metadata((err, unused) => {
        if (err) {
            debug('streamQuery could not fetch metadata for %s',o.itemid);
            next(err);
        } else {
            o.fetch_query({wantFullResp: true}, (err, resp) => {
                if (err) {
                    debug('streamQuery for q="%s" failed with %s', o.query, err.message );
                    res.status(404).send(err.message);
                    next(err);
                } else {
                    res.json(resp);
                }
            });
        }
    });

}


function streamThumbnail(req, res, next) {
    /*
    Stream back the icon,
    In many cases we will have the icon, but nothing else for the item (eg its a tile on a collection), in that case just send the icon
    Otherwise fetch metadata, find it in several possible places.
     */
    function sendJpegStream(s) {
        // Stream back with appropriate status and Content-type
        res.status(200); // Assume error if dont get here
        res.set({"Content-Type": "image/jpeg; charset=UTF-8"} );
        s.pipe(res);
    }
    const itemid = req.params['itemid'];
    debug('Sending Thumbnail for %s', itemid);
    MirrorFS.checkWhereValidFile(itemid+"/__ia_thumb.jpg", {}, (err, existingFilePath) => {
        if (!err) {
            sendJpegStream(fs.createReadStream(existingFilePath));
        } else {
            // We dont already have the file
            waterfall([
                    (cb1) => loadedAI({itemid}, cb1),
                    (archiveitem, cb2) => archiveitem.saveThumbnail({wantStream: true}, cb2)
                ],
                (err, s) => {
                    if (err) {
                        debug("Failed to stream Thumbnail for %s: %s", itemid, err.message);
                        next(err)
                    } else {
                        sendJpegStream(s);
                    }
                }
            );
        }
    });
}

//app.get('/', (req,res)=>{debug("ROOT URL");});

app.get('/', (req,res)=>{res.redirect(url.format({pathname:"/archive/archive.html", query: {transport:"HTTP", mirror: req.headers.host}}))});
app.get('/arc/archive.org', (req, res) => { res.redirect(url.format({pathname: "/archive/archive.html", query: req.query})); });
app.get('/arc/archive.org/advancedsearch', streamQuery);
app.get('/arc/archive.org/details', (req, res) => { res.redirect(url.format({pathname: "/archive/archive.html", query: req.query})); });
// noinspection JSUnresolvedFunction
app.get('/arc/archive.org/details/:itemid', (req, res) => {
    req.query.item = req.params['itemid']; // Move itemid into query
    res.redirect(url.format({pathname: "/archive/archive.html", query: req.query})); // and redirect to the html file
});
// noinspection JSUnresolvedFunction
app.get(ACUtil.gateway.urlDownload + '/:itemid/__ia_thumb.jpg', (req, res, next) => streamThumbnail(req, res, next) ); //streamThumbnail will try archive.org/services/img/itemid if all else fails
app.get(ACUtil.gateway.urlDownload + '/:itemid/*', streamArchiveFile);
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
            res.status(404).send(err.message); // Its neither local, nor from server
        } else {
            res.json(ai.exportMetadataAPI());
        }
    })
});
app.get('/arc/archive.org/metadata/*', function(req, res, next) { // Note this is metadata/<ITEMID>/<FILE> because metadata/<ITEMID> is caught above
    // noinspection JSUnresolvedVariable
    proxyUrl(req, res, next, [config.upstream+req.url].join('/'), {"Content-Type": "application/json"} )}); //TODO should be retrieving. patching into main metadata and saving
// noinspection JSUnresolvedFunction
app.get('/arc/archive.org/mds/v1/get_related/all/*', sendRelated);
// noinspection JSUnresolvedFunction
app.get('/arc/archive.org/mds/*', function(req, res, next) { // noinspection JSUnresolvedVariable
    proxyUrl(req, res, next, [ACUtil.gateway.mds,req.params[0]].join('/'), {"Content-Type": "application/json"} )});
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
app.get('/contenthash/:contenthash', (req, res, next) =>
    MirrorFS.checkWhereValidFile(undefined, {digest: req.params['contenthash'], format: 'multihash58', algorithm: "sha1"},
        (err, filepath) => res.sendFile(filepath, {maxAge: "31536000000", immutable: true}, err => { if (err) next()})));
app.get('/contenthash/*', proxyUpstream); // If we dont have a local copy, try the server

// noinspection JSUnresolvedVariable
app.get('/favicon.ico', (req, res, next) => res.sendFile( config.archiveui.directory+"/favicon.ico", {maxAge: "86400000", immutable: true}, (err)=>err ? next(err) : debug('sent /favicon.ico')) );


// noinspection JSUnresolvedFunction
app.get('/info', function(req, res) {
    res.status(200).set('Accept-Ranges','bytes').json({"config": config.configOpts}); //TODO this may change to include info on transports (IPFS, WebTransport etc) //TODO-CONFIG needs hash for writing
});

app.use((req,res,next) => {
    debug("FAILING: %s",req.url);
    next();
});

// noinspection JSUnresolvedVariable
app.listen(config.apps.http.port); // Intentionally same port as Python gateway defaults to, api should converge

    } // Config load success
} ); // config load
