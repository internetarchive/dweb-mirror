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
 */
// External packages
//Not debugging: express:*
// noinspection JSUnresolvedVariable

/* To add a new special page
    Search on SEE-OTHER-ADD-SPECIAL-PAGE
    Document in README.md and USING.md
 */

//TODO-URI add compatability with archive.org standard urls scan this file first, should be a git issue but
const debug = require('debug')('dweb-mirror:mirrorHttp');
const url = require('url');
const express = require('express'); //http://expressjs.com/
const morgan = require('morgan'); //https://www.npmjs.com/package/morgan
const path = require('path');
const fs = require('fs');   // See https://nodejs.org/api/fs.html
//const ParallelStream = require('parallel-streams');
const waterfall = require('async/waterfall');
const RawBookReaderResponse = require('@internetarchive/dweb-archivecontroller/RawBookReaderResponse');

// IA packages
const {gateway, specialidentifiers, homeQuery} = require('@internetarchive/dweb-archivecontroller/Util');
// Local files
const MirrorFS = require('./MirrorFS');
const CrawlManager = require('./CrawlManager');
const ArchiveFile = require('./ArchiveFilePatched');
const ArchiveItem = require('./ArchiveItemPatched'); // Needed for fetch_metadata patch to use cache
const ArchiveMember = require('./ArchiveMemberPatched');

const httpOrHttps = "http"; // This server is running on http, not https (at least currently)

const app = express();
function mirrorHttp(config, cb) {
    debug('Starting HTTP server on %d, Caching in %o', config.apps.http.port, config.directories);
// noinspection JSUnresolvedVariable
    app.use(morgan(config.apps.http.morgan)); //TODO write to a file then recycle that log file (see https://www.npmjs.com/package/morgan )
    app.use(express.json());

//app.get('*/', (req, res, next) => { req.url = req.params[0]; next(); } // Strip trailing '/'
    app.use((req, res, next) => {
        // Pre Munging - applies to all queries
        /* Turn the range headers on a req into an options parameter can use in streams */
        req.opts = {};
        const range = req.range(Infinity);
        if (range && range[0] && range.type === "bytes") {
            Object.assign(req.opts, {start: range[0].start, end: range[0].end});
            debug("Range request = %O", range);
        }
        // Detect if want server to skip cache
        req.opts.noCache = req.headers["cache-control"] && ["no-cache", "max-age=0"].includes(req.headers["cache-control"]);
        req.opts.copyDirectory = req.query.copyDirectory; // Usually undefined
        debug("STARTING: %s %s %s %s", req.url,
          (typeof req.opts.start !== "undefined") ? `bytes ${req.opts.start}-${req.opts.end}` : "",
          (req.opts.noCache ? "NOCACHE" : ""),
          (req.opts.copyDirectory ? req.opts.copyDirectory : "" ));
        next();
    });
  function reqQuery(req, ...more) {
    // New query parameters have defaults for mirror and transport which can be overridden and ... more which can't
    return Object.assign( {mirror: req.headers.host, transport: "HTTP"}, req.query, ...more)
  }
  function errAndNext(req, res, next, err) {
    // There might be an easier way to do this, but this is how to handle something that could fail but want to try for others
    if (err) {
      if (!req.errs) { req.errs = []; }
      req.errs.push(err);
    }
    next(); // Try next... next(err) would give an immediate error, the last step below will check for err and use it instead of generic 404
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
                debug('No file in: %s %s', filepath, err.message);
                next(); // Drop through to next attempt - will probably fail
            } else {
                debug("sent file %s", filepath);
            }
        });
    }


    function sendRelated(req, res, next) {
        // req.opts = { noCache, copyDirectory}
        const identifier = req.params[0];
        const ai = new ArchiveItem({identifier});
        waterfall([
                (cb) => cb((identifier && ! Object.keys(specialidentifiers).includes(identifier)) ? null : new Error(`ERROR There is no related info for special identifier ${identifier}`)),
                (cb) => ai.fetch_metadata(req.opts, cb),
                (ai, cb) => ai.relatedItems({copyDirectory: req.opts.copyDirectory, wantMembers: false, noCache: req.opts.noCache}, cb),
                (res, cb) => ArchiveItem.addCrawlInfoRelated(res, {config, copyDirectory: req.opts.copyDirectory}, (err) => cb(err, res)),
            ], (err, obj) => {
              if (err) {
                next(err);
//                res.status(404).send(err.message);
              } else {
                res.json(obj)
            }}
        );
    }

    function sendPlaylist(req, res, next) {
        // req.opts = { noCache}
        const ai = new ArchiveItem({identifier: req.params[0]});
        waterfall([
                (cb) => ai.fetch_metadata(req.opts, cb),
                (ai, cb) => ai.fetch_playlist({copyDirectory: req.opts.copyDirectory, wantStream: true, noCache: req.opts.noCache}, cb)
            ], (err, s) => _proxy(req, res, next, err, s, {"Content-Type": "application/json"})
        );
    }

// There are a couple of proxies e.g. proxy-http-express but it disables streaming when headers are modified.
    function proxyUpstream(req, res, next, headers = {}) {
        // Note req.url will start with "/"
        // req.opts = { start, end, noCache}
        // noinspection JSUnresolvedVariable
        proxyUrl(req, res, next, [config.upstream, req.url].join(''), headers);
    }

    function proxyUrl(req, res, next, url, headers = {}) {
        // Proxy a request to somewhere under urlbase, which should NOT end with /
        // req.opts = { start, end, noCache}
        DwebTransports.createReadStream(url, Object.assign({}, req.opts, {preferredTransports: config.connect.preferredStreamTransports}), (err, s) => {
            _proxy(req, res, next, err, s, headers);
        })
    }

    function _proxy(req, res, next, err, s, headers) {
        if (err) {
            debug("Failed to proxy", err.message);
            errAndNext(req, res, next, err);
        } else {
          res.status(200); // Assume error if dont get here
          res.set(headers);
          s.pipe(res);
          s.on('error', err => { // Make sure to catch error though too late to do anything useful with it.
            debug("Stream had error, %o", err.message, err);
            next(err); // Will generate immediate 400
            //res.destroy(err); // Doesnt work - "Empty reply from server" no headers get sent
            // Doesnt work as already sent headers ... errAndNext(req, res, next, err);
          });
        }
    }

// noinspection JSUnusedLocalSymbols
    function temp(req, res, next) {
        console.log(req);
        next();
    }

    function streamArchiveFile(req, res, next) {
        // Note before this is called req.opts = {start, end}
        //TODO-CACHE-AGING Look at cacheControl in options https://expressjs.com/en/4x/api.html#res.sendFile (maxAge, immutable)
        // req.opts { start, end, noCache, copyDirectory }
        try {
            const filename = req.params[0]; // Use this form since filename may contain '/' so can't use :filename
            const itemid = req.params['itemid'];
            const opts = Object.assign({}, req.opts, {wantStream: true});
            let af; // Passed out from waterfall to end
            debug('Sending ArchiveFile %s/%s', itemid, filename);
            const ai = new ArchiveItem({identifier: itemid});
            waterfall([
                    (cb) => ai.fetch_metadata({copyDirectory: req.opts.copyDirectory}, cb), // Dont pass on noCache, we'll be streaming after already fetched
                    (archiveitem, cb) => ArchiveFile.new({archiveitem, filename, copyDirectory: req.opts.copyDirectory}, cb),
                    // Note will *not* cache if pass opts other than start:0 end:undefined|Infinity
                    (archivefile, cb) => {
                        af = archivefile;
                        archivefile.cacheAndOrStream(opts, cb);
                    },
                ],
                (err, s) => { // Have stream of file or error
                    if (err) {
                        // Failed - report
                        debug("ERROR: streamArchiveFile failed for %s/%s: %s", itemid, filename, err.message);
                        res.status(404).send(err.message);
                    } else {
                        // Succeeded - pipe back to user with headers
                        res.status(req.opts.end ? 206 : 200); // True if there was a range request
                        res.set('Accept-ranges', 'bytes');
                        if (req.opts.end) res.set("Content-Range", `bytes ${req.opts.start}-${Math.min(req.opts.end, af.metadata.size) - 1}/${af.metadata.size}`);
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
        // req.opts = { noCache}
        let wantCrawlInfo;
        let o;
        // especially: `${Util.gatewayServer()}${Util.gateway.url_advancedsearch}?output=json&q=${encodeURIComponent(this.query)}&rows=${this.rows}&page=${this.page}&sort[]=${sort}&and[]=${this.and}&save=yes`;
        if (req.query.q && req.query.q.startsWith("collection:") && req.query.q.includes('simplelists__items:')) { // Only interested in standardised q=collection:ITEMID..
          //TODO when Aaron has built entry point e.g. members/COLLECTION then rebuild this and dweb-archivecontroller.ArchiveItem._fetch_query to use it
          // Special case: query just looking for members of a collection
          //e.g. collection%3Amitratest%20OR%20simplelists__items%3Amitratest%20OR%20simplelists__holdings%3Amitratest%20OR%20simplelists__items%3Amitratest
          const identifier = req.query.q.split(' OR ')[0].split(':')[1];
          o = new ArchiveItem({sort: req.query.sort, identifier}); // Dont set query, allow _fetch_query to build default
          wantCrawlInfo = true;
        // Another special case - a query just looking to expand identifiers
        } else if (req.query.q && req.query.q.startsWith("identifier:")
          && !req.query.q.includes('*')                               // exclude eg identifier:electricsheep-flock*
          && (req.query.q.lastIndexOf(':(') === 10)) {
          // Special case: query just looking for fields on a list of identifiers
          const ids = req.query.q.slice(12, -1).split(' OR '); // ["foo","bar"]
          o = new ArchiveItem();
          o.membersFav = ids.map(identifier => ArchiveMember.fromIdentifier(identifier));
          // The members will be expanded by fetch_query either from local cache or by querying upstream
          wantCrawlInfo = false;
        } else if (req.query.q === homeQuery) {
          o = new ArchiveItem({identifier: "home", sort: req.query.sort, query: req.query.q })
          wantCrawlInfo = true;
        } else {
          o = new ArchiveItem({sort: req.query.sort, query: req.query.q});
          wantCrawlInfo = true;
        }
        // By this point via any route above, we have o as an object with either a .query or .membersFav || .membersSearch
        // as array of unexpanded members (which fetch_query|_fetch_query will get)
        o.rows = parseInt(req.query.rows, 10) || 75;
        o.page = parseInt(req.query.page, 10) || 1; // Page incrementing is done by anything iterating over pages, not at this point
        o.and = req.query.and; // I dont believe this is used anywhere
        o.fetch_metadata(req.opts, (err, unused) => { // Not passing noCache as query usually after a fetch_metadata
            if (err) {
                debug('streamQuery could not fetch metadata for %s', o.itemid);
                next(err);
            } else {
                o.fetch_query({copyDirectory: req.opts.copyDirectory, wantFullResp: true, noCache: req.opts.noCache}, (err, resp) => { // [ArchiveMember*]
                    if (err) {
                        debug('streamQuery for q="%s" failed with %s', o.query, err.message);
                        res.status(404).send(err.message);
                        next(err);
                    } else {
                        // Note we are adding crawlinfo to o - the ArchiveItem, but the resp.response.docs
                        // is an array of pointers into same objects so its getting updated as well
                      if (!wantCrawlInfo) {
                        res.json(resp);
                      } else {
                        o.addCrawlInfo({config, copyDirectory: req.opts.copyDirectory}, (unusederr, unusedmembers) => {
                          resp.response.downloaded = o.downloaded;
                          resp.response.crawl = o.crawl;
                          res.json(resp);
                        });
                      }
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

        req.opts = {noCache}

         */
        function sendJpegStream(s) {
            // Stream back with appropriate status and Content-type
            res.status(200); // Assume error if dont get here
            res.set({"Content-Type": "image/jpeg; charset=UTF-8"});
            s.pipe(res);
        }

        const itemid = req.params['itemid'];
        debug('Sending Thumbnail for %s', itemid);
        const noCache = req.opts.noCache;

        if (Object.keys(specialidentifiers).includes(itemid)) { //See SEE-OTHER-ADD-SPECIAL-PAGE (this should be automatic once added to specialidentifiers)
            res.redirect(url.format({
                pathname: specialidentifiers[itemid].thumbnaillinks,
            }));
        } else {
            MirrorFS.checkWhereValidFile(itemid + "/__ia_thumb.jpg", {noCache, copyDirectory: req.opts.copyDirectory}, (err, existingFilePath) => {
                if (!err) {
                    sendJpegStream(fs.createReadStream(existingFilePath));
                } else {
                    // We dont already have the file
                    const ai = new ArchiveItem({identifier: itemid});
                    waterfall([
                            (cb) => ai.fetch_metadata({noCache, copyDirectory: req.opts.copyDirectory}, cb),
                            (archiveitem, cb2) => archiveitem.saveThumbnail({noCache, copyDirectory: req.opts.copyDirectory, wantStream: true, }, cb2)
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
    }

  function sendInfo(req, res) {
    DwebTransports.p_statuses((err, transportStatuses) => {
      res.status(200).set('Accept-Ranges', 'bytes').json({"config": config.configOpts, transportStatuses, directories: config.directories});
    });
  }


    function sendBookReaderJSIA(req, res, next) {
        waterfall([
            (cb) => new ArchiveItem({identifier: req.query.id})
                .fetch_metadata(req.opts, cb),
            (ai, cb) => ai.fetch_bookreader(req.opts, cb)
        ], (err, ai) => {
            if (err) {
                res.status(404).send(err.message); // Its neither local, nor from server
            } else {
                res.json({
                    data: RawBookReaderResponse.fromArchiveItem(ai).cooked({
                        server: req.query.server,
                        protocol: httpOrHttps
                    })
                });
            }
        });
    }

    function sendBookReaderImages(req, res, next) {
        //debug("sendBookReaderImages: item %s file %s scale %s rotate %s", req.query.zip.split('/')[3], req.query.file, req.query.scale, req.query.rotate)
        // eg http://localhost:4244/BookReader/BookReaderImages.php?zip=/27/items/IDENTIFIER/unitednov65unit_jp2.zip&file=unitednov65unit_jp2/unitednov65unit_0006.jp2&scale=4&rotate=0
        // or http://localhost:4244/download/IDENTIFIER/page/cover_t.jpg
        // req.opts = { noCache}
        const identifier = req.params['identifier'] || (req.query.zip ? req.query.zip.split('/')[3] : undefined);
        new ArchiveItem({identifier})
            .fetch_page({
                    copyDirectory: req.opts.copyDirectory,
                    wantStream: true,
                    reqUrl: req.url,
                    zip: req.query.zip,
                    page: req.params['page'],
                    file: req.query.file,
                    scale: req.query.scale,
                    rotate: req.query.rotate,
                    noCache: req.opts.cache
                },
                (err, s) => _proxy(req, res, next, err, s, {"Content-Type": "image/jpeg"})
            )
    }

// Keep these lines in alphabetical order unless there is a reason not to (e.g. because capture specific before generic)
//app.get('/', (req,res)=>{debug("ROOT URL");});
    app.get('/', (req, res) => {
        res.redirect(url.format({
            pathname: "/archive/archive.html",
            query: reqQuery(req, {identifier: "local"})
        }))
    });

    // Not currently used, but might be soon, ConfigDetailsComponent now uses admin/setconfig/IDENTIFIER/LEVEL
    app.post('/admin/setconfig', function (req, res, next) {
        config.setAndWriteUser(req.body, err => {
            if (err) {
                next(err);
            } else {
                sendInfo(req, res);  // Send info again, as UI will need to display this
            }
        });
    });
    app.get('/admin/setconfig/:identifier/:level', function (req, res, next) {
        const identifier = req.params["identifier"] === "_" ? undefined : req.params["identifier"];
        const delayTillReconsider = 3000; // ms time to wait for another key press before running crawl
        const crawlid = 0; // Always setting on default crawl which will be '0'
        // req.query.q is either "string to find" or structured like "collection:foo AND name:bar" it is NOT urlencoded by here
        config.writeUserTaskLevel({identifier, query: req.query.q, level: req.params["level"]}, err => {
            if (err) {
                next(err);
            } else {
                sendInfo(req, res);  // Send info again, as UI will need to display this
                if ( CrawlManager.crawls.length)
                  CrawlManager.crawls[crawlid].suspendAndReconsider({identifier, delayTillReconsider, config});
            }
        });
    });
    //TODO-CRAWLCTL - see https://github.com/internetarchive/dweb-mirror/issues/132
    app.get('/admin/crawl/restart/:crawlid', (req, res) => {
      CrawlManager.crawls[req.params["crawlid"]].restart();
      res.json(CrawlManager.crawls[req.params["crawlid"]].status());
    });
    app.get('/admin/crawl/pause/:crawlid', (req, res) => {
      CrawlManager.crawls[req.params["crawlid"]].pause();
        res.json(CrawlManager.crawls[req.params["crawlid"]].status());
    });
    app.get('/admin/crawl/resume/:crawlid', (req, res) => {
      CrawlManager.crawls[req.params["crawlid"]].resume();
      res.json(CrawlManager.crawls[req.params["crawlid"]].status());
    });
    app.get('/admin/crawl/empty/:crawlid', (req, res) => {
      CrawlManager.crawls[req.params["crawlid"]].empty();
        res.json(CrawlManager.crawls[req.params["crawlid"]].status());
    });
    app.get('/admin/crawl/status', (req, res) => {
        res.json(CrawlManager.status());
    });
  app.get('/admin/crawl/add', (req, res) => {
    // Expect opts identifier, query, copyDirectory, but could be adding search, related, in future
    // Order is significant, config should NOT be overridable by query parameters.
    CrawlManager.add({...req.query, config}, err => {
      if (err) { // No errors expected
        next(err);
      } else {
        sendInfo(req, res); // Send info again for UI
      }
    });
  });
    app.get('/admin/crawl/add/:identifier', (req, res) => {
      CrawlManager.add({config, identifier: req.params.identifier, copyDirectory: req.opts.copyDirectory}, err => {
        if (err) { // No errors expected
          next(err);
        } else {
          sendInfo(req, res); // Send info again for UI
        }
      });
    });
    app.get('/arc/archive.org', (req, res) => {
        res.redirect(url.format({pathname: "/archive/archive.html", query: reqQuery(req)}));
    });
    app.get('/arc/archive.org/advancedsearch', streamQuery);
    app.get('/arc/archive.org/details', (req, res) => {
        res.redirect(url.format({pathname: "/archive/archive.html", query: reqQuery(req)}));
    });
// noinspection JSUnresolvedFunction
    app.get('/arc/archive.org/details/:identifier', (req, res) => {
        res.redirect(url.format({
            pathname: "/archive/archive.html",
            query:  reqQuery(req, {identifier: req.params['identifier']})
        })); // Move itemid into query and redirect to the html file
    });
//TODO-BOOK this will be needed on dweb.me as well OR make archive.html handle /arc/archive.org/details/foo
    app.get('/arc/archive.org/details/:identifier/page/:page', (req, res) => {  // Bookreader passes page in a strange place in the URL - we can ignore it
        res.redirect(url.format({
            pathname: "/archive/archive.html",
            query: reqQuery(req, {identifier: req.params['identifier'], page: req.params['page']})
        })); // Move itemid into query and redirect to the html file
    });
// noinspection JSUnresolvedFunction
    app.get(gateway.urlDownload + '/:itemid/__ia_thumb.jpg', (req, res, next) => streamThumbnail(req, res, next)); //streamThumbnail will try archive.org/services/img/itemid if all else fails
    app.get(gateway.urlDownload + '/:identifier/page/:page', sendBookReaderImages);
    app.get(gateway.urlDownload + '/:identifier', (req, res) => {
      res.redirect(url.format({
        pathname: "/archive/archive.html",
        query: reqQuery(req, {identifier: req.params['identifier'], download: 1})
      }));
    });
    app.get(gateway.urlDownload + '/:itemid/*', streamArchiveFile);

// noinspection JSUnresolvedFunction
    // This is used by bookreader
    app.get('/arc/archive.org/images/*', function (req, res, next) { // noinspection JSUnresolvedVariable
        _sendFileFromDir(req, res, next, config.archiveui.directory + "/images");
    });

// metadata handles two cases - either the metadata exists in the cache, or if not is fetched and stored.
// noinspection JSUnresolvedFunction
//TODO complete as part of https://github.com/internetarchive/dweb-mirror/issues/211
    app.get('/arc/archive.org/metadata/:identifier', function (req, res, next) {
      const identifier = req.params.identifier
      _newArchiveItem(identifier, config, req.opts, (err, ai) => {
        if (err) {
          res.status(404).send(err.message); // Its neither local, nor from server nor special
        } else {
          ai.addCrawlInfo({config, copyDirectory: req.opts.copyDirectory}, (unusederr) => {
            res.json(ai.exportMetadataAPI());
          })
        }
      });
    })
    app.get('/arc/archive.org/metadata/*', function (req, res, next) { // Note this is metadata/<ITEMID>/<FILE> because metadata/<ITEMID> is caught above
        // noinspection JSUnresolvedVariable
        proxyUpstream(req, res, next, {"Content-Type": "application/json"})
    }); //TODO should be retrieving. patching into main metadata and saving but note, not using on dweb-mirror when IPFS off
// noinspection JSUnresolvedFunction
    app.get('/arc/archive.org/mds/v1/get_related/all/*', sendRelated);
// noinspection JSUnresolvedFunction
    app.get('/arc/archive.org/mds/*', function (req, res, next) { // noinspection JSUnresolvedVariable
        proxyUrl(req, res, next, [gateway.mds, req.params[0]].join('/'), {"Content-Type": "application/json"})
    });
    app.get('/arc/archive.org/playlist/*', sendPlaylist);
  // noinspection JSUnresolvedFunction
  app.get('/arc/archive.org/search', (req, res) => {
    res.redirect(url.format({
      pathname: "/archive/archive.html",
      query: reqQuery(req)
    })); // redirect to archive.html with same query
  });
  // noinspection JSUnresolvedFunction
  // Also catch search.php
  app.get('/arc/archive.org/search.php', (req, res) => {
    res.redirect(url.format({
      pathname: "/archive/archive.html",
      query: reqQuery(req)
    })); // redirect to archive.html with same query
  });
// noinspection JSUnresolvedFunction
    app.get('/arc/archive.org/serve/:itemid/*', streamArchiveFile);
// noinspection JSUnresolvedFunction
    app.get('/arc/archive.org/services/img/:itemid', (req, res, next) => streamThumbnail(req, res, next)); //streamThumbnail will try archive.org/services/img/itemid if all else fails
// noinspection JSUnresolvedFunction
    app.get('/arc/archive.org/thumbnail/:itemid', (req, res, next) => streamThumbnail(req, res, next)); //streamThumbnail will try archive.org/services/img/itemid if all else fails
// noinspection JSUnresolvedFunction
    app.get('/archive/bookreader/BookReader/*', function (req, res, next) {
        _sendFileFromDir(req, res, next, config.bookreader.directory);
    });
    app.get('/archive/*', function (req, res, next) { // noinspection JSUnresolvedVariable
        _sendFileFromDir(req, res, next, config.archiveui.directory);
    });
//TODO add generic fallback to use Domain.js for name lookup

//e.g. '/BookReader/BookReaderJSIA.php?id=unitednov65unit&itemPath=undefined&server=undefined&format=jsonp&subPrefix=unitednov65unit&requestUri=/details/unitednov65unit')
    app.get('/BookReader/BookReaderJSIA.php', sendBookReaderJSIA);
    app.get('/BookReader/BookReaderImages.php', sendBookReaderImages);

// noinspection JSUnresolvedVariable
    app.get('/contenthash/:contenthash', (req, res, next) =>
        MirrorFS.checkWhereValidFile(undefined, {
                digest: req.params['contenthash'],
                format: 'multihash58',
                algorithm: "sha1",
                copyDirectory: req.opts.copyDirectory,
            },
            (err, filepath) => {
              if (!err && filepath) {
                res.sendFile(filepath, {maxAge: "31536000000", immutable: true}, err => {
                  if (err) next()
                });
              } else {
                next(); // Not found by contenthash.
              }
            }));
    app.get('/contenthash/*', proxyUpstream); // If we dont have a local copy, try the server

  app.get('/includes/*', (req, res) => { res.redirect("/archive" + req.originalUrl); }); // Matches archive.org and dweb.me
  app.get('/ipfs/*', (req, res, next) => proxyUrl(req, res, next, 'ipfs:' + req.url)); // Will go to next if IPFS transport not running
  //app.get('/ipfs/*', proxyUpstream); //TODO dweb.me doesnt support /ipfs see https://github.com/internetarchive/dweb-mirror/issues/101
  app.get('/ipfs/*', (req, res, next) => proxyUrl(req, res, next, 'https://ipfs.io' + req.url)); // Will go to next if IPFS transport not running
  // Recognize unmodified archive URLs, these shouldnt be generated by any code in dweb-archive or dweb-mirror
  app.get('/metadata*', (req, res) => { res.redirect("/arc/archive.org" + req.originalUrl); });
  app.get('/search*', (req, res) => { res.redirect("/arc/archive.org" + req.originalUrl); });
  app.get('/details/*', (req, res) => { res.redirect("/arc/archive.org" + req.originalUrl); });
  app.get('/download/*', (req, res) => { res.redirect("/arc/archive.org" + req.originalUrl); });

// noinspection JSUnresolvedVariable
    app.get('/favicon.ico', (req, res, next) => res.sendFile(config.archiveui.directory + "/favicon.ico", {
        maxAge: "86400000",
        immutable: true
    }, (err) => err ? debug('favicon.ico %s', err.message) : debug('sent /favicon.ico'))); // Dont go to Error, favicons often aborted

    app.get('/images/*', function (req, res, next) { // noinspection JSUnresolvedVariable - used in archive.js for /images/footer.png
        _sendFileFromDir(req, res, next, config.archiveui.directory + "/images");
    });
  app.get('/languages/*', function (req, res, next) { // noinspection JSUnresolvedVariable - used in archive.js for /images/footer.png
    _sendFileFromDir(req, res, next, config.archiveui.directory + "/languages");
  });
// noinspection JSUnresolvedFunction
    app.get('/info', sendInfo);

    app.use((req, res, next) => {
        // See errAndNext() above which builds req.errs
        debug("FAILING: %s", req.url);
        if (req.errs && req.errs.length === 1) {
            next(req.errs[0]); // Just one error, use it
        } else if (req.errs && req.errs.length > 0) {
          next(new Error(req.errs.map(err => err.message).join('\n'))); // return them all
        } else {
          next(); // Generic 404
        }
    });

// noinspection JSUnresolvedVariable
    const server = app.listen(config.apps.http.port); // Intentionally same port as Python gateway defaults to, api should converge
    server.on('error', (err) => {
        if (err.code === "EADDRINUSE") {
            debug("A server, probably another copy of internetarchive is already listening on port %s", config.apps.http.port);
        } else {
            debug("Server hit error %o", err);
            throw(err); // Will be uncaught exception
        }
    });
    cb(null, server);   // Just in case this becomes async
}

//SEE-IDENTICAL-CODE-CANONICALIZETASKS in dweb-mirror.mirrorHttp and dweb-archive.LocalComponent
function canonicalizeTasks(tasks) {
  /* Turn an array of tasks where identifiers may be arrays or singles into canonicalized form - one task per identifier */
  // This turns each task into an array of tasks with one identifier per task, then flattens that array of arrays into a 1D array
  return [].concat(...tasks.map(task =>
    Array.isArray(task.identifier)
      ? task.identifier.map(identifier => Object.assign({}, task, {identifier}))
      : task ));
}

function _newArchiveItem(identifier, config, opts, cb) {
  // Enhanced version of new ArchiveItem + fetch_metadata + handling special
  const ai = new ArchiveItem({identifier});
  if (Object.keys(specialidentifiers).includes(identifier)) {
    ai.metadata = {};
    Object.entries(specialidentifiers[identifier]).forEach(kv => ai.metadata[kv[0]] = kv[1]); // Copy over
    if (ai.itemid === "local") {
      ArchiveMember.expandMembers(
        canonicalizeTasks(config.apps.crawl.tasks)
          .map(t => new ArchiveMember({
            identifier: t.identifier,
            query: t.query,
            sort: t.sort || ["-downloads"],
            mediatype: t.query ? "search" : undefined
          }, {unexpanded: true})),
        (err,res) => {
          ai.membersFav = res;
          cb(err, ai);
        });
    } else {
      cb(null, ai);
    }
  } else {
    ai.fetch_metadata(Object.assign({darkOk: true}, opts), cb);
  }
}


exports = module.exports = mirrorHttp;