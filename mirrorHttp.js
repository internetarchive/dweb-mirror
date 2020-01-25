/* global DwebTransports */
/* Serve the mirrored files via HTTP

This is intended as a fairly generic server for a number of cases, with some configuration to allow for different situations,

See: https://github.com/mitra42/dweb-universal/blob/master/uri%20structure%20for%20http%20server.md (TODO which may be out of date)

See URL_MAPPING.md (TODO which may be out of date) for summary of below rules plus what they call
//TODO remove /archive/ forwards, work directly with those files as on archive.org and www-dweb.dev.archive.org
*/
// External packages
//Not debugging: express:*
// noinspection JSUnresolvedVariable

/* To add a new special page
    Search on SEE-OTHER-ADD-SPECIAL-PAGE
    Document in README.md and USING.md
 */

//TODO-URI add compatibility with archive.org standard urls scan this file first, should be a git issue but
const debug = require('debug')('dweb-mirror:mirrorHttp');
const url = require('url');
const express = require('express'); // http://expressjs.com/
const morgan = require('morgan'); // https://www.npmjs.com/package/morgan
const path = require('path');
const fs = require('fs');   // See https://nodejs.org/api/fs.html
//const ParallelStream = require('parallel-streams');
const waterfall = require('async/waterfall');
const parallel = require('async/parallel');

// IA packages
const { RawBookReaderResponse, RawBookReaderJSONResponse, gateway, specialidentifiers, homeQuery, routed } = require('@internetarchive/dweb-archivecontroller');

// Local files
const MirrorFS = require('./MirrorFS');
const CrawlManager = require('./CrawlManager');
const ArchiveFile = require('./ArchiveFilePatched');
const ArchiveItem = require('./ArchiveItemPatched'); // Needed for fetch_metadata patch to use cache
const ArchiveMember = require('./ArchiveMemberPatched');
const { searchExpress, doQuery } = require('./search');

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
        req.opts.protoHost =
          process.env.APPLICATION_ROOT  // OLIP
          ? process.env.APPLICATION_ROOT
          : req.headers["x-forwarded-for"]
          ? (req.headers["x-forwarded-proto"] + "://" + req.headers["x-forwarded-host"] + req.headers["x-forwarded-port"])
          : (req.protocol + "://" + req.headers.host);
      next();
    });
  /**
   * Redirect, passes query parameters in order of precedence .... queryParms; those in the query; transport & mirror
   * @param queryParms { parameters to pass in query, can override {mirror, transport} and in query}
   * @returns {function(req, res)}
   * Identical code in dweb  and dweb-mirror
   */
  function redirectWithQuery(queryParms={}) {
    return function (req, res) {
      if (req.params.identifier) {queryParms.identifier = req.params.identifier}; // For urls that include identifier pass to queryParms
      if (queryParms[0]) { queryParms[queryParms[0]] = req.params[queryParms[0]]; delete queryParms["0"]; } // {0:"page"} means take the * in the url and pass as the page=
      const redirUrl = url.format({
        pathname: "/archive.html",
        // New query parameters have defaults for mirror and transport which can be overridden and ... more which can't
        query: Object.assign({mirror: req.headers.host, transport: "HTTP"}, req.query, queryParms)
      });
      debug("redirecting to: %s",redirUrl);
      res.redirect(redirUrl);
    }
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
//app.use('/download/', express.static(dir)); // Simplistic, better ...

  function _sendFileOrError(req, res, next, filepath) {
    // Note filepaths are going to be unix/OSX style TODO-WINDOWS will need to split and re-join params[0]
    res.sendFile(filepath, function (err) {
      if (err) {
        debug('No file in: %s %s', filepath, err.message);
        next(); // Drop through to next attempt - will probably fail
      } else {
        debug("sent file %s", filepath);
      }
    });
  }
  function _sendFileOrErrorPath(req, res, next) {
    _sendFileOrError(req, res, next, config.archiveui.directory + req.path); // Note req.path starts with /
  }
  function _sendFileUrlArchive(req, res, next) {
      // dir: Directory path, not starting or ending in /
    _sendFileOrError(req, res, next, path.join(config.archiveui.directory, req.params[0]));
  }
  function _sendFileFromBookreader(req, res, next) {
    // Urls like /bookreader/BookReader/*
    _sendFileOrError(req, res, next, path.join(config.bookreader.directory, req.params[0]));
  }
  function _sendFileFromEpubreader(req, res, next) {
    // Urls like /epubreader/*
    _sendFileOrError(req, res, next, path.join(config.epubreader.directory, req.params[0]));
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
                //next(err);
                res.status(404).send(err.message);
              } else {
                res.json(obj)
            }}
        );
    }

  function sendPlaylist(req, res, next) {
    // req.opts = { noCache}
    new ArchiveItem({identifier: req.params['identifier']})
      .fetch_metadata(req.opts, (err, ai) => {  // Note this will get playlist, (fetch_playlist requires this first anyway)
        if (!err) {
          res.json(ai.playlist); // Will be a cooked playlist, but all cooking of playlists is additive.
        } else {
          next(err);  // Will 500 error
        }
      });
  }

  // There are a couple of proxies e.g. proxy-http-express but it disables streaming when headers are modified.
  // Note req.url will start with "/"
  // proxyUrl goes through DTS name mapping, so normally can be a raw URL to archive.org
  // req.opts = { start, end, noCache}
  // noinspection JSUnresolvedVariable
  function proxyUrl(prefix, headers={}) {
    return function(req, res, next) {
      // Proxy a request to somewhere under urlbase, which should NOT end with /
      // req.opts = { start, end, noCache}
      const url = routed(prefix + req.url);
      debug("Proxying from %s", url);
      DwebTransports.createReadStream(
        url,
        Object.assign({}, req.opts, {preferredTransports: config.connect.preferredStreamTransports}), (err, s) => {
          _proxy(req, res, next, err, s, headers);
      });
    }
  }
  // like proxyUrl but return proxy function that sets JSON content-type header
  function proxyJson(prefix) { return proxyUrl(prefix, {"Content-Type": "application/json"})}

  // Pass a stream to the result
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
        // especially: `/advancedsearch}?output=json&q=${encodeURIComponent(this.query)}&rows=${this.rows}&page=${this.page}&sort[]=${sort}&and[]=${this.and}&save=yes`;
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
          o = new ArchiveItem({identifier: "home", sort: req.query.sort, query: req.query.q });
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
        req.opts.wantCrawlInfo = wantCrawlInfo;
        doQuery(o, req.opts, config, (err, resp) => {
          if (err) {
            next(err); // doQuery will have reported the error
          } else {
            res.json(resp);
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

  function sendBookReaderJSIA(req, res, unusedNext) {
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
            // On www-dweb-mirror we are running thru ingress, so serer http but browser needs to use https - can use x-forwarded-proto to distinguish
            protocol: req.headers["x-forwarded-proto"] || httpOrHttps
          })
        });
      }
    });
  }

  function sendBookReaderJSON(req, res, unusedNext) {
    waterfall([
      (cb) => new ArchiveItem({identifier: req.params.identifier || req.query.itemId})
        .fetch_metadata(req.opts, cb),
      (ai, cb) => ai.fetch_bookreader(req.opts, cb)
    ], (err, ai) => {
      if (err) {
        res.status(404).send(err.message); // Its neither local, nor from server
      } else {
        //TODO need server from req I think
        res.json(RawBookReaderJSONResponse.fromArchiveItem(ai, {
          server: req.headers.host,
          // On www-dweb-mirror we are running thru ingress, so serer http but browser needs to use https - can use x-forwarded-proto to distinguish
          protocol: req.headers["x-forwarded-proto"] || httpOrHttps
      }));
      }
    });
  }
  function  sendBookReaderImages(req, res, next) {
        //debug("sendBookReaderImages: item %s file %s scale %s rotate %s", req.query.zip.split('/')[3], req.query.file, req.query.scale, req.query.rotate)
        // eg /BookReader/BookReaderImages.php?zip=/27/items/IDENTIFIER/unitednov65unit_jp2.zip&file=unitednov65unit_jp2/unitednov65unit_0006.jp2&scale=4&rotate=0
        // or /download/IDENTIFIER/page/cover_t.jpg
        // or /tutur-smara-bhuwana/page/leaf1_w2000.jpg from mediawiki/ArchiveLeaf
        // or (book preview as e.g. already lent out): /BookReader/BookReaderPreview.php?id=bdrc-W1KG14545&subPrefix=bdrc-W1KG14545&itemPath=/34/items/bdrc-W1KG14545&server=ia803001.us.archive.org&page=leaf4&fail=preview&&scale=11.652542372881356&rotate=0  app.get(['/epubreader/*', '/archive/epubreader/*'], _sendFileFromEpubreader);
        // Note the urls for Image and Preview are gratuitously different ! so need to capture both sets of parameters
        // req.opts = { noCache}
        const identifier = req.params['identifier'] || req.query.id || (req.query.zip ? req.query.zip.split('/')[3] : undefined);
        new ArchiveItem({identifier})
            .fetch_page({
                    copyDirectory: req.opts.copyDirectory,
                    wantStream: true,
                    zip: req.query.zip, // Images only
                    page: req.params['page'] || req.query.page,
                    file: req.query.file, // Images ony
                    scale: req.query.scale,     // Note this will be quantized
                    rotate: req.query.rotate,
                    itemPath: req.query.itemPath, // Preview only
                    subPrefix: req.query.subPrefix, // Preview only
                    noCache: req.opts.cache
                },
                (err, s) => _proxy(req, res, next, err, s, {"Content-Type": "image/jpeg"})
            )
    }

// Keep these lines in alphabetical order
// unless there is a reason not to (e.g. because capture specific before generic) in which case document in order!
  // If ther is a redir.html file it will use it, otherwise it will do a standard redirect)
  app.get('/', (req, res, next) => {
      res.sendFile(config.archiveui.directory + "/redir.html", (err) => { next(); })})
  app.get('/', redirectWithQuery({identifier: "local"}));
  // Note app.get('/*'... is at the end after catch everythig else

    // Not currently used, but might be soon, ConfigDetailsComponent now uses admin/setconfig/IDENTIFIER/LEVEL
    /*
    app.post('/admin/setconfig', function (req, res, next) {
        config.setAndWriteUser(req.body, err => {
            if (err) {
                next(err);
            } else {
                sendInfo(req, res);  // Send info again, as UI will need to display this
            }
        });
    });
    */
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

  function crawlManager(f) {
    return function(req, res) {
     CrawlManager.crawls[req.params["crawlid"]][f]();
     res.json(CrawlManager.crawls[req.params["crawlid"]].status());
    }
  }
    //TODO-CRAWLCTL - see https://github.com/internetarchive/dweb-mirror/issues/132
    // TODO refactor this to be a single service CrawlManager.app(req,res,next) which takes /admin/crawl/:cmd/:crawlid
    app.get('/admin/crawl/restart/:crawlid', crawlManager("restart"));
    app.get('/admin/crawl/pause/:crawlid', crawlManager("pause"));
    app.get('/admin/crawl/resume/:crawlid', crawlManager("resume"));
    app.get('/admin/crawl/empty/:crawlid', crawlManager("empty"));
    app.get('/admin/crawl/status', (req, res) => res.json(CrawlManager.status()) );
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
  app.get([
    '/arc/archive.org',
    '/details',
    '/details/:identifier',
    '/search',
    '/search.php',
    '/stream/:identifier/:unusedPrefix'
  ], redirectWithQuery());
  app.get('/arc/archive.org/*', (req, res) => { res.redirect(req.originalUrl.slice(16)); }); // Moved to new pattern
  app.get('/advancedsearch', streamQuery);
  app.get('/advancedsearch.php', streamQuery);
  // Bookreader passes page in a strange place in the URL e.g. page/n1/mode/2up
  app.get('/details/:identifier/page/*', redirectWithQuery({0: "page"}));
  app.get('/download/:identifier/page/:page', sendBookReaderImages);
  app.get('/download/:identifier', redirectWithQuery({download: 1}));
  app.get([
    '/download/:itemid/*',
    '/serve/:itemid/*'],  streamArchiveFile);
  app.get(['/images/*',
    '/includes/*', // matches archive.org & dweb.archive.org but not dweb.me
    '/jw/*', // matches archive.org but not dweb.me
    '/components/*', // Web components - linked from places we have no control over
    '/languages/*'], _sendFileOrErrorPath);
  // metadata handles two cases - either the metadata exists in the cache, or if not is fetched and stored.
  // TODO complete as part of https://github.com/internetarchive/dweb-mirror/issues/211
  app.get('/metadata/:identifier', function (req, res, unusedNext) {
      const identifier = req.params.identifier;
      _newArchiveItem(identifier, config, req.opts, (err, ai) => {
        if (err) {
          res.status(404).send(err.message); // Its neither local, nor from server nor special
        } else {
          parallel([
            cb => ai.addCrawlInfo({config, copyDirectory: req.opts.copyDirectory}, cb),
            cb => ai.addMagnetLink({copyDirectory: req.opts.copyDirectory, config}, cb)
            ],
            (err, unusedArr) => {
              if (err) {
                res.status(500).send(err.message)
              } else {
                res.json(ai.exportMetadataAPI());
              }
          });
        }
      })
    });
  // Note this is metadata/<ITEMID>/<FILE> because metadata/<ITEMID> is caught above
  // Note wont work as while goes explicitly to dweb.archive.org since pattern metadata/IDENTIFIER/FILE not handled by dweb-archivecontroller/Routing yet
  // this will be diverted to dweb-metadata which cant handle this pattern yet - see https://github.com/internetarchive/dweb-archivecontroller/issues/11
  // TODO should be retrieving. patching into main metadata and saving but note, not using on dweb-mirror when IPFS off
  // app.get('/metadata/*', proxyJson("https://archive.org"));
  app.get('/mds/v1/get_related/all/*', sendRelated);
// noinspection JSUnresolvedFunction
  app.get('/mds/*', proxyJson("https://be-api.us.archive.org/"));
  // Playlists are on a weird URL distinguished only by output=json
  app.get('/embed/:identifier', (req, res, next) => {
    if (req.query.output === "json") {
      sendPlaylist(req, res, next);
    } else {
      next();
    }
  });
  app.get('/playlist/:identifier', sendPlaylist);
  // Special URL from mediawiki e.g. https://archive.org/stream/bdrc-W1FPL497/bdrc-W1FPL497#page/n2/mode/1up
  // see https://github.com/internetarchive/dweb-mirror/issues/289 as this might be temporary
  app.get([
    '/download/:itemid/__ia_thumb.jpg',
    '/services/img/:itemid',
    '/thumbnail/:itemid' // Deprecated in favor of services/img)
    ], streamThumbnail); //streamThumbnail will try archive.org/services/img/itemid if all else fails
  app.get(['/bookreader/BookReader/*','/archive/bookreader/BookReader/*'] , _sendFileFromBookreader);
  //e.g. '/BookReader/BookReaderJSIA.php?id=unitednov65unit&itemPath=undefined&server=undefined&format=jsonp&subPrefix=unitednov65unit&requestUri=/details/unitednov65unit')
  app.get('/BookReader/BookReaderJSIA.php', sendBookReaderJSIA);
  //e.g. http://ia802902.us.archive.org/BookReader/BookReaderJSON.php?itemPath=%2F28%2Fitems%2FArtOfCommunitySecondEdition&itemId=ArtOfCommunitySecondEdition&server=ia802902.us.archive.org
  app.get([ '/BookReader/BookReaderJSON.php',
    '/books/:identifier/ia_manifest' //e.g. https://api.archivelab.org/books/ArtOfCommunitySecondEdition/ia_manifest
  ], sendBookReaderJSON);
  app.get('/BookReader/BookReaderImages.php', sendBookReaderImages);
  //e.g. /BookReader/BookReaderPreview.php?id=bdrc-W1KG14545&subPrefix=bdrc-W1KG14545&itemPath=/34/items/bdrc-W1KG14545&server=ia803001.us.archive.org&page=leaf4&fail=preview&&scale=11.652542372881356&rotate=0  app.get(['/epubreader/*', '/archive/epubreader/*'], _sendFileFromEpubreader);
  app.get('/BookReader/BookReaderPreview.php', sendBookReaderImages);
  app.get('/ipfs/*', proxyUrl('ipfs:')); // Will go to next if IPFS transport not running
  //app.get('/ipfs/*', proxyUpstream); // TODO dweb.me doesnt support /ipfs see https://github.com/internetarchive/dweb-mirror/issues/101
  app.get('/ipfs/*', proxyUrl('https://ipfs.io')); // Will go to next if IPFS transport not running
  // Recognize unmodified archive URLs

// noinspection JSUnresolvedVariable
    app.get('/favicon.ico', (req, res, unusedNext) => res.sendFile(config.archiveui.directory + "/favicon.ico", {
        maxAge: "86400000",
        immutable: true
    }, (err) => err ? debug('favicon.ico %s', err.message) : debug('sent /favicon.ico'))); // Dont go to Error, favicons often aborted

  app.get('/info', sendInfo);
  const sharp = require('sharp');
  //IIF support e.g. https://iiif.archivelab.org/iiif/mantra-pangwisesan%240/1026,1245,2316,617/full/0/default.jpg
  // TODO-IIIF move to a function, probably on ArchiveItem
  app.get('/iiif/:identifierindex/:ltwh/full/0/default.jpg', (req, res, next) => {
    res.status(200);
    const [left,top,width,height] = req.params.ltwh.split(',');
    const [identifier, index] = req.params.identifierindex.split('$');
    const ai = new ArchiveItem({identifier: identifier});
    waterfall([
      (cb) => ai.fetch_metadata(req.opts, cb),
      (ai, cb) => ai.fetch_bookreader(req.opts, cb),
      (ai, cb) => {
        const manifest = ai.pageManifests()[index];
        ai.fetch_page(ai.pageParms(manifest, {
          copyDirectory: req.opts.copyDirectory,
          wantStream: true,
          scale: 1,
          noCache: req.opts.cache
        }), cb)},
    ],
      (err, s) => {
        const sh = sharp();
        s.pipe(sh);
        sh.extract({left: parseInt(left), top: parseInt(top), width: parseInt(width), height: parseInt(height)}).pipe(res)
      }
    );
  });
  app.get('/opensearch', searchExpress);
  // Echo back headers - for debugging
  app.get('/echo', (req, res, next) => {
    res.status(200);
    res.json(req.headers);
  });

  // For debugging routing
  app.use('/xyzzy', (req, res, next) => {
    // Expect for .get /xyzzy/*: /xyzzy/foo url=original=path=/xyzzy/foo baseUrl=undefined
    // Expect for .use '/xyzzy : /xyzzy/foo url=path=/foo/bar baseUrl=/xyzzy original=/xyzzy/foo/bar
    debug("xyzzy: .url=%s, .baseUrl=%s, .originalUrl=%s .path=%s .route=%s", req.url, req.baseUrl, req.originalUrl, req.path, req.route);
    next();
  })

  // ----------- Below here are intentionally at the end -------
  // Lastly try a file - this will get archive.html, dweb-archive-bundle.js, favicon.ico, dweb-archive-styles.css
  app.get('/archive/*', _sendFileUrlArchive); // Must be after /archive/bookreader etc and before '/*'
  app.get('/*', _sendFileUrlArchive);
  // TODO add generic fallback to use Transports.js to lookup name and forward - but might auto-fix things that should really be caught and thought about

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
            sort: t.sort, // Maybe undefined in which case specified in ArchiveItem.defaultSortStr
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
