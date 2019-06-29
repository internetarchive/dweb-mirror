/*
// Monkey patches dweb-archivecontroller,
// Note cant merge into dweb-archivecontroller as wont work in browser; and cant create subclass as want everywhere e.g. archivefile.fetch_metadata is used to use the cache
 */

//NPM repos
const path = require('path');
const debug = require('debug')('dweb-mirror:ArchiveItem');
const canonicaljson = require('@stratumn/canonicaljson');
const waterfall = require('async/waterfall');
const each = require('async/each'); // https://caolan.github.io/async/docs.html#each
const parallel = require('async/parallel'); //https://caolan.github.io/async/docs.html#parallel
const map = require('async/map'); //https://caolan.github.io/async/docs.html#map

// Other IA repos
const ArchiveItem = require('@internetarchive/dweb-archivecontroller/ArchiveItem');
const ArchiveMember = require('@internetarchive/dweb-archivecontroller/ArchiveMember');
const RawBookReaderResponse = require('@internetarchive/dweb-archivecontroller/RawBookReaderResponse');
const {gateway, gatewayServer, parmsFrom, ObjectFromEntries, specialidentifiers} = require('@internetarchive/dweb-archivecontroller/Util');
// Other files from this repo
const MirrorFS = require('./MirrorFS');

/**
 * Common arguments:
 * noStore:            Like HTTP Cache-Control: no-store, don't store the result
 * noCache:            Like HTTP Cache-Control: no-cache, don't return cached copy (but can store response)
 * skipNet             dont load from net (only cache)
 * skipCache:          dont load from cache (only net)  DEPRECATED - use noCache and/or noStore
 */

// noinspection JSUnresolvedVariable
ArchiveItem.prototype._namepart = function() {
    // The name used for the directory and file prefixes, normally the item identifier, but some special cases
    if (!this.itemid && this.query) {
        return "_SEARCH_"+MirrorFS.quickhash(this.query, {algorithm: 'sha1', format:'multihash58'})
    } else if (this.itemid) {
        return this.itemid;
    } else {
        return undefined; // Should be caught at higher level to decide not to use cache
    }
};

function _save1file(key, obj, namepart, cb) {
    // Returns nothing
    const relFilePath = path.join(namepart, `${namepart}_${key}.json`);
    if (typeof obj === "undefined") {
        cb(null);
    } else {
        MirrorFS.writeFile(relFilePath, canonicaljson.stringify(obj), (err) => {
            if (err) {
                console.error(`Unable to write ${key} to ${relFilePath}`);
                cb(err);
            } else {
                cb(null);
            }
        });
    }
}



// noinspection JSUnresolvedVariable
ArchiveItem.prototype.save = function(opts = {}, cb) {
    /*
        Save metadata for this file as JSON in multiple files.
        .metadata -> <IDENTIFIER>.meta.json
        .members -> <IDENTIFIER>.members.json
        .reviews -> <IDENTIFIER>.reviews.json
        .files -> <IDENTIFIER>.files.json
        {collection_titles, collection_sort_order, dir, files_count, is_dark, server} -> <IDENTIFIER>.extra.json
        and .member_cached.json is saved from ArchiveMember not from ArchiveItems

        If not already done so, will `fetch_metadata` (but not query, as that may want to be precisely controlled)

    */
    if (typeof opts === "function") { cb = opts; opts = {}; } // Allow opts parameter to be skipped
    if (!this.itemid) {
        // Must be a Search so dont try and save files - might save members
        debug("Search so not saving");
        cb(null, this);
    } else {
        const namepart = this._namepart(); // Its also in this.item.metadata.identifier but only if done a fetch_metadata

        if (!(this.metadata || this.is_dark)) {
            // noinspection JSUnusedLocalSymbols
            this.fetch_metadata((err, data) => {
                if (err) {
                    console.error(`Cant save because could not fetch metadata for %s: %s`, this.itemid, err.message);
                    cb(err);
                } else {
                    f.call(this); // Need the call because it loses track of "this"
                }
            });
        } else {
            f.call(this);
        }

        function f() {
            // MirrorFS._mkdir(dirpath, (err) => { // Not mkdir because MirrorFS.writeFile will
            // noinspection JSPotentiallyInvalidUsageOfThis
            // Note all these files should be in MirrorFS.isSpecialFile
            // noinspection JSPotentiallyInvalidUsageOfThis
            each(
                [
                    ["meta", this.metadata],    // Maybe empty if is_dark
                    ["members", this.membersFav], // Only save Favorited members
                    ["files", this.exportFiles()],
                    ["extra", ObjectFromEntries( ArchiveItem.extraFields.map(k => [k, this[k]]))], // NOTE DUPLICATE OF LINE IN fetch_query and save
                    ["reviews", this.reviews],
                    ["playlist", this.playlist], // Not this is a cooked playlist, but all cooking is additive
                ],
                (i, cbInner) => { // [ part, obj ]
                    _save1file(i[0], i[1], namepart, cbInner);
                },
                (err)=>{if (err) { cb(err) } else { cb(null, this);}});
        }
    }

};
// noinspection JSUnresolvedVariable
ArchiveItem.prototype.saveBookReader = function(opts = {}, cb) {
    /*
        Save BookReader for this file as JSON
        .bookreader -> <IDENTIFIER>.bookreader.json =
    */
    if (typeof opts === "function") { cb = opts; opts = {}; } // Allow opts parameter to be skipped
    if (!this.itemid) {
        // Must be a Search so dont try and save files or bookreader - might save members
        debug("Search so not saving bookReader");
        cb(null, this);
    } else {
        const namepart = this._namepart(); // Its also in this.item.metadata.identifier but only if done a fetch_metadata

        if (!(this.bookreader || this.is_dark)) {
            // noinspection JSUnusedLocalSymbols
            this.fetch_bookreader((err, ai) => {
                if (err) {
                    console.error(`Cant save because could not fetch bookreader for %s: %s`, this.itemid, err.message);
                    cb(err);
                } else {
                    f.call(this); // Need the call because it loses track of "this"
                }
            });
        } else {
            f.call(this);
        }
        function f() {
            // MirrorFS._mkdir(dirpath, (err) => { // Not mkdir because MirrorFS.writeFile will
            // noinspection JSPotentiallyInvalidUsageOfThis
            // Note all these files should be in MirrorFS.isSpecialFile
            _save1file("bookreader", this.bookreader, namepart, (err) => { if (err) {cb(err) } else {cb(null, this) }})
        }
    }
};

function _parse_common(namepart, part, cb) {
    const relFilePath = path.join(namepart, `${namepart}_${part}.json` );
    MirrorFS.readFile(relFilePath, (err, jsonstring) => {
        if (err) {
            cb(err);    // Not logging as not really an err for there to be no file, as will read
        } else {
            let o;
            try {
                o = canonicaljson.parse(jsonstring); // No reviver function, which would allow postprocessing
            } catch (err) {
                // It is on the other hand an error for the JSON to be unreadable
                debug("Failed to parse json at %s: part %s %s", namepart, part, err.message);
                cb(err);
                return
            }
            cb(null, o);
        }
    })
}

// noinspection JSUnresolvedVariable
// noinspection JSUnusedGlobalSymbols,JSUnresolvedVariable
ArchiveItem.prototype.read = function(opts = {}, cb) {
    /*
        Read metadata, reviews, files and extra from corresponding files
        cb(err, {files, files_count, metadata, reviews, collection_titles, dir, is_dark, server})  data structure fields of ArchiveItem
    */
    if (typeof opts === "function") { cb = opts; opts = {}; } // Allow opts parameter to be skipped
    const namepart = this.itemid;
    const res = {};
    function _parse(part, cb) { _parse_common(namepart, part, cb); }
    // This is a set of parallel reads, failure of some cause the whole thing to fail; some require postprocessing; and playlist occurs after metadata&files succeed
    parallel([
        cb => _parse("meta",(err, o) => {
            res.metadata = o;
            if (err) {
                cb(err);
            } else {
                if (["audio", "etree", "movies"].includes(res.metadata.mediatype)) {
                    _parse("playlist", (err, o) => {
                        res.playlist = o; // maybe undefined
                        cb(err);    // Should fail if no playlist, so re-reads from server and gets playlist
                    });
                } else {
                    cb(null);
                }
            }}),
        cb => _parse("files", (err, o) => {
            // TODO note at this point o.downloaded is meaningful - want to push it up one level
            if (!err) { res.files = o; res.files_count = res.files.length; }
            cb(err); }),
        cb => _parse("reviews", (err, o) => {
            res.reviews = o; // Undefined if failed but not an error
            cb(null); }),
        cb => _parse("members", (err, o) => {
            res.membersFav = o; // Undefined if failed but not an error
            cb(null); }),
        cb => _parse("extra", (err, o) => {
            // Unavailable on archive.org but there on dweb.archive.org: collection_titles
            // Not relevant on dweb.archive.org, d1, d2, item_size, uniq, workable_servers
            // Its absence should be considered an error as "servers" etc are required for bookreader.
            if (o) {
              ArchiveItem.extraFields.forEach(k => {
                if (o[k]) res[k] = o[k];
              });
            }
            cb(err); }),
    ], (err, unused) => cb(err, res));
};

// noinspection JSUnusedGlobalSymbols,JSUnresolvedVariable
ArchiveItem.prototype.read_bookreader = function(opts = {}, cb) {
    /*
       Read bookreader data from file and place in bookreader field on item
       file = { data, brOptions, lendingInfo, possibly metadata }
       item has bookreader: { data, brOptions, lendingInfo }
       API returns { data: { data, brOptions, lendingInfo, possibly metadata } }
       cb(err, {data { data, metadata, brOptions, lendingInfo, metadata}} format returned from BookReader api
    */
    if (typeof opts === "function") { cb = opts; opts = {}; } // Allow opts parameter to be skipped
    const namepart = this.itemid; // Possible undefined
    function _parse(part, cb) { _parse_common(namepart, part, cb); }
    _parse("bookreader", (err, o) => { // { data, brOptions, lendingInfo }
        if (err) {
            cb(err);
        } else {
            o.metadata = this.metadata;
            cb(null, new RawBookReaderResponse({data: o}));
        }
    });
};
// noinspection JSUnresolvedVariable
ArchiveItem.prototype.fetch_bookreader = function(opts={}, cb) { //TODO-API
  /*
  Fetch the bookreader data for this item if it hasn't already been.
  More flexible version than dweb-archive.ArchiveItem
  Monkey patched into dweb-archive.ArchiveItem so that it runs anywhere that dweb-archive attempts to fetch_bookreader
  opts = {
    noCache             Dont check cache, refetch from server, and store locally
    noStore             Dont store result
  }
  Alternatives:
  cached:             return from cache
  !cached:            Load from net, save to cache

  cb(err, this) or if undefined, returns a promise resolving to 'this'
  Errors              TransportError (404)

  Result is ai.bookreader = { brOptions, data, lendingInfo}
   */
  if (typeof opts === "function") { cb = opts; opts = {}; } // Allow opts parameter to be skipped
  const {noCache, noStore} = opts;
  // noinspection JSUnresolvedVariable
  if (cb) { try { f.call(this, cb) } catch(err) {
      cb(err)}}
  else { return new Promise((resolve, reject) => { try { f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} })} catch(err) {reject(err)}})} // Promisify pattern v2
  function tryRead(cb) { // Read if allowed
    //TODO-CACHE-AGING need timing of how long use old metadata
    if (noCache) {
      cb(new Error("no-cache"));
    } else {
      this.read_bookreader(cb); // RawBookReaderResponse = { data: { data, brOptions, lendingInfo }}
    }
  }
  function tryReadOrNet(cb) { // Try both files and net, cb(err, doSave)
    tryRead.call(this, (err, bookapi) => {
      if (err) {
        this._fetch_bookreader(opts, (err, unusedRes)=>cb(err, true)); // Will process and add to this.bookreader, but want to save as came from net
      } else {
        this.loadFromBookreaderAPI(bookapi);  // Saved Metadata will have processed Fjords and includes the reviews, files, and other fields of _fetch_metadata()
        cb(null, !!MirrorFS.copyDirectory);   // If copyDirectory explicitly specified then save to it, otherwise its from file so no need to save.
      }
    });
  }
  function trySave(doSave, cb) {
    if (!noStore && doSave) {
      this.saveBookReader({}, cb)
    } else {
      cb(null);
    }
  }
  function f(cb) {
    if (this.is_dark && !opts.darkOk) {
      cb(new Error(`item ${this.itemid} is dark`));
    } else {
      if (this.itemid && !this.bookreader) { // Check haven't already loaded or fetched metadata
        waterfall([
          tryReadOrNet.bind(this),
          trySave.bind(this)
        ], (err) => cb(err, this));
      } else {
        cb(null, this);
      }
    }
  }
};

// noinspection JSUnresolvedVariable
ArchiveItem.prototype.fetch_page = function({wantStream=false, wantSize=false, noCache=false, reqUrl=undefined,
                                              zip=undefined, file=undefined, scale=undefined, rotate=undefined,
                                              page=undefined, skipNet=false}={}, cb) { //TODO-API noCache
    /* Fetch a page from the item, caching it

        page      usually "cover_t.jpg" to get the page
        scale     factor to shrink raw image by (2 is about right for a full screen)
        rotate    0 for normal, unsure what other values are
        zip       Name of file holding the image
        file      file within zip
        noCache   Dont look in cache
        wantStream  Want results streamed (typically false if crawling)
        wantSize  Just want the size in bytes (downloaded)
        skipNet   Dont check on the net
        reqUrl    string as in brOptions.data ... uri from /BookReader.. (path and query, but not scale/rotate)
        cb(err, data || stream || size) returns either data, or if wantStream then a stream
     */
    let zipfile;
    if (zip) zipfile = zip.split('/')[4];
    waterfall([
        (cbw) =>
          this.fetch_metadata(cbw),
        (ai, cbw) => {
            // request URLs dont have server, and need to add data node anyway - note passes scale & rotate
            const urls = page
                ? `https://${ai.server}/BookReader/BookReaderPreview.php?${parmsFrom({id: this.itemid, itemPath: this.dir, server: this.server, page: page})}`
                : "https://" + ai.server + reqUrl;
            const debugname = `${this.itemid}_${file}`;
            const relFilePath = `${this.itemid}/_pages/` + (page ? page : `${zipfile}/scale${Math.floor(scale)}/rotate${rotate}/${file}`);
            if (page) { // This is the cover , its not scaled or rotated
                MirrorFS.cacheAndOrStream({ urls, wantStream, wantSize, debugname, noCache, relFilePath, skipNet}, cbw);
            } else { // Looking for page by number with scale and rotation
                MirrorFS.checkWhereValidFileRotatedScaled({file, scale, rotate, noCache, skipNet, // Find which valid scale/rotate we have,
                    relFileDir: `${this.itemid}/_pages/${zipfile}`},
                    (err, relFilePath2) => { // undefined if not found
                        // Use this filepath if find an appropriately scaled one, otherwise use the one we really want from above
                        //TODO there is an edge case where find wrongly scaled file, but if copydir is set we'll copy that to relFilePath
                        MirrorFS.cacheAndOrStream({urls, wantStream, wantSize, debugname, noCache, skipNet, relFilePath: relFilePath2 || relFilePath }, cbw);
                    }
                )
            } }
    ], cb);
};


// noinspection JSUnresolvedVariable
ArchiveItem.prototype.fetch_metadata = function(opts={}, cb) { //TODO-API opts:cacheControl
    /*
    Fetch the metadata for this item if it hasn't already been.
    More flexible version than dweb-archive.ArchiveItem
    Monkey patched into dweb-archive.ArchiveItem so that it runs anywhere that dweb-archive attempts to fetch_metadata
    Note that it adds information about the crawl and downloaded status

    Alternatives:
    opts { noStore, noCache, skipNet, skipCache } - see common args at top of this file
    cached:             return from cache
    !cached:            Load from net, save to cache

    cb(err, this) or if undefined, returns a promise resolving to 'this'
    Errors              TransportError (404)

    TODO-CACHEAGING - check on age of cache
     */
    if (typeof opts === "function") { cb = opts; opts = {}; } // Allow opts parameter to be skipped
    // noinspection JSUnresolvedVariable
    if (cb) { try { f.call(this, cb) } catch(err) {
        cb(err)}}
    else { return new Promise((resolve, reject) => { try { f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} })} catch(err) {reject(err)}})} // Promisify pattern v2
    function tryRead(cb) { // Try and read from disk, obeying options
        if (opts.noCache) {
            cb(new Error("NoCache"));
        } else {
            this.read((err, metadata) => {
                if (err) {
                    cb(err);
                } else {
                    this.loadFromMetadataAPI(metadata); // Saved Metadata will have processed Fjords and includes the reviews, files, and other fields of _fetch_metadata()
                    cb(null)
                }
            });
        }
    }
    function tryNet(cb) {  // Try and read from net, obeying options
        if (opts.skipNet) {
            cb(new Error("skipNet set"));
        } else {
            this._fetch_metadata(Object.assign({}, opts, {darkOk: true}), (err, unusedAI) => { // Process Fjords and load .metadata and .files etc - allow isDark just throw before caller
                cb(err); // Maybe or maybe not err
            });
        }
    }
    function tryReadOrNet(cb) { // Try and Read and if not, then get from net, obeying options cb(err, doSave)
        if (this.itemid && !(this.metadata || this.is_dark)) { // Check haven't already loaded or fetched metadata (is_dark wont have a .metadata)
            tryRead.call(this, (err) => {
                if (err) { // noCache, or not cached
                    tryNet.call(this, (err) => {
                        cb(err, true); // If net succeeded then save
                    });
                } else { // cached
                    cb(null, !!MirrorFS.copyDirectory); // cached but check for explicit requirement to copy
                }
            })
        } else {
            cb(null, false); // Didn't fetch so dont save, but not an error
        }
    }
    function trySave(doSave, cb) { // If requested, try and save, obeying options
        if (!doSave || opts.noStore) {
            cb(null);
        } else {
            this.save(cb);
        }
    }
    function f(cb) {
        if (this.itemid && !(this.metadata || this.is_dark)) { // If have not already fetched (is_dark means no .metadata field)
            if (opts.skipCache) {
                opts.noCache = true; opts.noStore = true; } // skipCache is deprecated
            waterfall([
                tryReadOrNet.bind(this), // passes doStore to cb
                trySave.bind(this),
            ], (err) => {
                cb(err ? err : (this.is_dark && !opts.darkOk) ? new Error(`item ${this.itemid} is dark`) : null, this);
            });
        } else {
            cb(null, this);
        }
    }
};

// noinspection JSUnresolvedVariable
ArchiveItem.prototype.fetch_query = function(opts={}, cb) { //TODO-API add noCache & noStore
  /*  Monkeypatch ArchiveItem.fetch_query to make it check the cache
      cb(err, [ArchiveMember])

      opts = { skipNet, noCache, noStore,     see common argument documentation at top of this file
                wantFullResp }                see _fetch_query


      Strategy is:
      * Read <IDENTIFIER>_members_cached.json if it exists into .members
      * Expand each of `.members` from its `<IDENTIFIER>_member.json` if necessary and file exists.
      * Run _fetch_query which will also handled fav-*'s `members.json` files, and `query` metadata field.
      * Write the result back to `<IDENTIFIER>_members_cached.json`
      * Write each member to its own `<IDENTIFIER>_member.json`
   */
  if (typeof opts === "function") { cb = opts; opts = {}; } // Allow opts parameter to be skipped
  const {noCache, noStore, skipNet} = opts;
  if (cb) { try { f.call(this, cb) } catch(err) { cb(err)}} else { return new Promise((resolve, reject) => { try { f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} })} catch(err) {reject(err)}})} // Promisify pattern v2

  function f(cb1) {
    //TODO-CACHE-AGING
    // noinspection JSUnresolvedVariable
    const namepart = this._namepart();  // Can be undefined for example for list of members unconnected to an item
    const relFilePath = namepart && path.join(namepart, namepart + "_members_cached.json");
    if (!Array.isArray(this.membersFav)) this.membersFav = [];
    if (!Array.isArray(this.membersSearch)) this.membersSearch = [];
    waterfall([
      (cb2) => { // Read from members_cached.json files from cache if available
        if (!relFilePath) {
            cb2();
        } else {
          if (!noCache) { // Dont read old members if not caching
            MirrorFS.readFile(relFilePath, (err, jsonstring) => {
              if (!err) {
                try {
                  const data = canonicaljson.parse(jsonstring);
                  this.membersSearch = data.map(o => new ArchiveMember(o, {unexpanded: !o.publicdate}));
                } catch (err) {
                  debug("Cant parse json in %s: %s", relFilePath, err.message);
                  this.membersSearch = []
                }
              }
              cb2();
            });
          } else {
            cb2();
          }
        } },
        (cb2) => {
          // Try and read extras file which for search will contain numFound (it wont have been read by fetch_metadata because no identifier)
          if (!namepart) { // Some queries e.g. for identifier dont have namepart  or cache
            cb2();
          } else {
            _parse_common(namepart, "extra", (err, o) => {
              if (!err) {
                ArchiveItem.extraFields.forEach(k => { if (o[k]) this[k] = o[k]; } );
              }
              cb2();
          })}
        },
        (cb2) => { // Expand the members if necessary and possible locally, errors are ignored
        // unexpanded members typically come from either:
        // a direct req from client to server for identifier:...
        // or for identifier=fav-* when members loaded with unexpanded

        map(this.membersSearch,
          (ams,cb3) => {
            if ((ams instanceof ArchiveMember && ams.isExpanded()) || noCache) { // Expanded or unexpanded or not using cache
              cb3(null, ams)
            } else { ams.read({},(err, o) =>
              cb3(null, o ? new ArchiveMember(o) : ams)); }}, // If failed to read, just pass on ams to next stage
          (err, arr) => {
            this.membersSearch=arr; cb2() }); // Expand where possible
      },
      (cb2) => { // Favorites Expand the members if necessary and possible locally, errors are ignored
        // unexpanded members typically come from either:
        // a direct req from client to server for identifier:...
        // or for identifier=fav-* when members loaded with unexpanded

        map(this.membersFav,
          (ams,cb3) => {
            if ((ams instanceof ArchiveMember && ams.isExpanded()) || noCache) { // Expanded or unexpanded or not using cache
              cb3(null, ams)
            } else { ams.read({},(err, o) =>
              cb3(null, o ? new ArchiveMember(o) : ams)); }}, // If failed to read, just pass on ams to next stage
          (err, arr) => {
            this.membersFav=arr; cb2() }); // Expand where possible
      },
      // _fetch_query will optimize, it tries to expand any unexpanded members, and only does the query if needed (because too few pages retrieved)
      // unexpanded members are a valid response - client should do what it can to display them.
      (cb2) => {
        if (skipNet) {
          cb2(null, this.currentPageOfMembers(opts.wantFullResp)); // This page of members
        } else {
          this._fetch_query(opts, cb2) // arr of search result or slice of existing members
        }
      },
      (res, cb2) => {
        // arr will be matching ArchiveMembers, possibly wrapped in Response (depending on opts) or undefined if not a collection or search
        // fetch_query.members will have the full set to this point (note .files is the files for the item, not the ArchiveItems for the search)
        if (this.membersSearch && this.membersSearch.length && relFilePath && !noStore) {
          // Just store membersSearch, but pass on full set with possible response
          each( [
              ["extra", ObjectFromEntries( ArchiveItem.extraFields.map(k => [k, this[k]]))], // NOTE DUPLICATE OF LINE IN fetch_query and save
              ["members_cached", this.membersSearch]
            ],
            (i, cbInner) => { // [ part, obj ]
              _save1file(i[0], i[1], namepart, cbInner);
            },
            (err)=>{if (err) { cb2(err) } else { cb2(null, res);}});
        } else {
          cb2(null, res);
        }
      },
      (res, cb2) => { // Save members to their cache
        if (!noStore) {
          each(this.membersFav.concat(this.membersSearch).filter(ams => ams.isExpanded()),
            (ams, cb3) => ams.save((unusederr) => cb3(null)), // Ignore errors saving
            (unusedErr, unusedRes) => {}); // Not waiting for this to finish
        }
        cb2(null, res); // Return just the new members found by the query, dont worry about errors (logged in ams.save
                       // Note that res could be an array or a Response object, depending on opts
      }
    ],
      (err, res) =>
    cb(err, res));
  }
};


// noinspection JSUnresolvedVariable
ArchiveItem.prototype.saveThumbnail = function({skipFetchFile=false, noCache=false, wantStream=false} = {}, cb) {  //TODO-API
    /*
    Save a thumbnail to the cache, note must be called after fetch_metadata
    wantStream      true if want stream instead of ArchiveItem returned
    skipFetchFile   true if should skip net retrieval - used for debugging
    noCache         true to skip reading cache
    cb(err, this)||cb(err, stream)  Callback on completion with self (mirroring), or on starting with stream (browser)
    */

    const namepart = this.itemid; // Its also in this.metadata.identifier but only if done a fetch_metadata

    if (!namepart || Object.keys(specialidentifiers).includes(namepart)) { // Skip thumbnail if no itemid, or special with no thumbnail
        cb(null, wantStream ? undefined : this);
    } else {
        //MirrorFS._mkdir(dirpath, (err) => { // No longer making since a) comes after .save and b) mirrorFS.cacheAndOrStream does so
        //TODO-THUMBNAILS use new ArchiveItem.thumbnailFile that creates a AF for a pseudofile
        const self = this; // this not available inside recursable or probably in writable('on)
        const thumbnailFiles = this.files.filter(af =>
            af.metadata.name === "__ia_thumb.jpg"
            || af.metadata.name.endsWith("_itemimage.jpg")
        );
        if (thumbnailFiles.length) {//TODO-THUMBNAIL if more than 1, select smallest (or closest to 10k)
            // noinspection JSUnusedLocalSymbols
            // Loop through files using recursion (list is always short)
            const recursable = function (err, streamOrUndefined) {
                if (err) {
                    debug(`saveThumbnail: failed in cacheAndOrStream for ${namepart}: %s`, err.message);
                    if (cb && (thumbnailFiles.length === 0)) {   // cb will be undefined if cleared after calling with a stream
                        cb(err);
                        return; // Failed as no other files, (and didn't start another stream else cb would be undefined)
                    }
                    // Otherwise intentionally drops through after error and tries next file
                }
                if (wantStream && streamOrUndefined && cb) { // Passed back from first call to cacheOrStream if wantStream is set
                    cb(null, streamOrUndefined);
                    cb = undefined;
                } // Clear cb so not called when complete
                let af;
                if (typeof (af = thumbnailFiles.shift()) !== "undefined") {
                    af.cacheAndOrStream({skipFetchFile, noCache, wantStream}, recursable); // Recurse
                    // Exits, allowing recursable to recurse with next iteration
                } else { // Completed loop
                    // cb will be set except in the case of wantStream in which case will have been called with first stream
                    if (cb) cb(null, self); // Important to cb only after saving, since other file saving might check its SHA and dont want a race condition
                }
            };
            recursable(null, null);
        } else {  // No existing __ia_thumb.jpg or ITEMID_itemimage.jpg so get from services or thumbnail
            // noinspection JSUnresolvedVariable
            const servicesurl = `${gatewayServer()}${gateway.url_servicesimg}${this.itemid}`; // Direct to Archive server not via gateway
            // Include direct link to services
            if (!this.metadata.thumbnaillinks) this.metadata.thumbnaillinks = [];
            if (!this.metadata.thumbnaillinks.includes(servicesurl)) this.metadata.thumbnaillinks.push(servicesurl);
            const relFilePath = path.join(this._namepart(), "__ia_thumb.jpg"); //TODO-THUMBNAILS Assumes using __ia_thumb.jpg instead of ITEMID_itemimage.jpg
            const debugname = relFilePath;
            MirrorFS.cacheAndOrStream({relFilePath, skipFetchFile, wantStream, noCache, debugname,
                urls: this.metadata.thumbnaillinks,
            }, (err, streamOrUndefined) => {
                if (err) {
                    debug("Unable to cacheOrStream %s", debugname);
                    cb(err);
                } else {
                    cb(null, wantStream ? streamOrUndefined : this);
                }

            });
        }
    }
};

// noinspection JSUnresolvedVariable
ArchiveItem.prototype.fetch_playlist = function({wantStream=false, noCache=false} = {}, cb) { //TODO-API noCache
    /*
    Save the related items to the cache, TODO-CACHE-AGING
    wantStream      true if want stream) alternative is obj. obj will be processed, stream will always be raw (assuming client processes it)
    noCache         true if want to ignore local cache, noStore not to save result (not currently used)
    cb(err, stream|obj)  Callback on completion with related items object (can be [])
    */
    const identifier = this.itemid; // Its also in this.metadata.identifier but only if done a fetch_metadata
    if (identifier) {
        // noinspection JSUnresolvedVariable
        const relFilePath = path.join(this._namepart(), this._namepart()+"_playlist.json");
        // noinspection JSUnresolvedVariable
        MirrorFS.cacheAndOrStream({wantStream, relFilePath, noCache,
            wantBuff: !wantStream, // Explicit because default for cacheAndOrStream if !wantStream is to return undefined
            urls: `https://archive.org/embed/${identifier}?output=json`, // Hard coded, would rather have in Util.gateway.url_playlist but complex
            debugname: identifier + "/" + identifier + "_playlist.json"
        }, (err, res) => {
            // Note that if wantStream, then not doing expansion and saving, but in most cases called will expand with next call.
            if (!wantStream && !err) {
                try {
                    cb(null, this.processPlaylist(canonicaljson.parse(res)));
                } catch (err) { cb(err); } // Catch bad JSON
            } else {
                cb(err, res);
            }
        });
    } else {
        cb(null, wantStream ? undefined : [] );
    }
};

// noinspection JSUnresolvedVariable
ArchiveItem.prototype.relatedItems = function({wantStream=false, wantMembers=false, noCache=false} = {}, cb) { //TODO-API noCache
    /*
    Save the related items to the cache, TODO-CACHE-AGING
    wantStream      true => cb(err, stream)
    wantMembers     true => cb(err, [ArchiveMember*]
    !wantStream && !wantMembers => cb(err, { hits: hit: [ {}* ]  }
    cb(err, stream|obj)  Callback on completion with related items object (can be [])
    */
    const identifier = this.itemid; // Its also in this.metadata.identifier but only if done a fetch_metadata
    if (identifier) {
        // noinspection JSUnresolvedVariable
        const relFilePath = path.join(this._namepart(), this._namepart()+"_related.json");
        // noinspection JSUnresolvedVariable
        MirrorFS.cacheAndOrStream({wantStream, relFilePath, noCache,
            wantBuff: !wantStream, // Explicit because default for cacheAndOrStream if !wantStream is to return undefined
            urls: gateway.url_related + identifier, //url_related currently ends in /
            debugname: identifier + "/" + identifier + "_related.json"
        }, (err, res) => {
            // Note that if wantStream, then not doing expansion and saving, but in most cases called will expand with next call.
            if (!wantStream && !err) {
                try {
                    const rels = canonicaljson.parse(res);
                    if (wantMembers) {
                        // Same code in ArchiveItem.relatedItems
                        cb(null, rels.hits.hits.map(r => ArchiveMember.fromRel(r)))
                    } else {
                        cb(null, rels);
                    }
                } catch (err) { cb(err); } // Catch bad JSON
            } else {
                cb(err, res); // Could be err or stream
            }
        });
    } else {
        cb(null, wantMembers ? [] : undefined);
    }
};
ArchiveItem.addCrawlInfoRelated = function(rels, {config=undefined}={}, cb) {
  /**
   *   Add .crawlInfo and .downloaded for each result in rels the Related items API
   *   rels  result of RelatedApi i.e. {hits: {hits: [ _id, _source: { FIELDS OF MEMBER }]}}
   */

  const hits = rels.hits.hits;
  parallel([
    cb2 => each(hits,
      (hit, cb3) => {
        Object.assign(hit._source, {crawl: config.crawlInfo(hit._id)});
        cb3(null)
      },
      cb2),
    cb2 => each(hits,
      (hit, cb1) => { new ArchiveItem({identifier: hit._id}).addDownloadedInfoFiles((err, ai) => {
        if (err) {
          // Shouldnt happen since addDownloadedInfoMembers reports and ignores its own errors
          debug("addCrawlInfoRelated -> addDownloadedInfoMembers failed for %s in %s: %o", this.itemid, hit._id, err);
        } else {
          hit._source.downloaded = ai.downloaded;
        }
        cb1(null); // Dont pass on error
      })}, cb2),
    ], cb);
};

ArchiveItem.prototype.addDownloadedInfoFiles = function(cb) {
  // Add .downloaded info on all files, and summary on Item
  // Note ArchiveItem might not yet have metadata.
    waterfall([
      // Add info on files if not there already - this can be done in parallel
      cb1 => this.fetch_metadata({skipNet: true}, cb1),
      (unusedThis, cb1) => {
        if ((typeof this.downloaded !== "object") || (this.downloaded === null)) // Could be undefined (legacy boolean or null as called for each member
          this.downloaded = {};
        if (!Array.isArray(this.files))
          this.files = [];
        // Add info on each file
        each(this.files, // Could be empty
          // relatively inexpensive, as caches result on files.json at final step, only needs to look at disk if uncached
          (af, cb2) => af.isDownloaded(cb2), // Should never throw error
          cb1)},
      cb1 => { // Add statistical data to item, (note this.files could be empty)
        const filesDownloaded = this.files.filter(af => af.downloaded);
        this.downloaded.files_all_size = this.files.reduce((sum, af) => sum + (parseInt(af.metadata.size)||0), 0);
        this.downloaded.files_all_count = this.files.length;
        this.downloaded.files_size = filesDownloaded.reduce((sum, af) => sum + (parseInt(af.metadata.size)||0), 0);
        this.downloaded.files_count = filesDownloaded.length;
        this.downloaded.files_details = this.minimumForUI().every(af => af.downloaded);
        cb1(null);
      },
      cb1 => { // Save file as have changed files info
        if (!(this.itemid && this.files.length)) {
          cb1(null)
        } else {
          _save1file("files", this.exportFiles(), this._namepart(), cb1);
        } }
    ], err => {
      // Done Report error because it could just be because havent downlodaed files info via metadata API,
      // if (err) debug("Failure in addDownloadedInfoFiles for %s %O", this.itemid, err);
      // Also dont block
      cb(null, this); // AI is needed for callback in addDownloadedInfoMembers
    });
};

ArchiveItem.prototype.addDownloadedInfoPages = function(cb) {
  // For texts, Add .downloaded info on all pages, and summary on Item
  // Note ArchiveItem might not yet have bookreader field loaded when this is called.
  this.fetch_metadata({skipNet: true}, (err, ai) => {
    if (err || !ai || ai.metadata.mediatype !== "texts") {
      cb(null, undefined); // Not a book - dont consider when checking if downloaded
    } else {
      this.fetch_bookreader({skipNet: true}, (err, ai) => {
        if (err || !ai.bookreader) {
          cb(null, false); // No book info, presume not downloaded
        } else {
          if ((typeof this.downloaded !== "object") || (this.downloaded === null)) this.downloaded = {}; // Could be undefined (legacy boolean or null as called for each member
          waterfall([
            cb0 => parallel([
              cb1 => this.fetch_page({
                wantSize: true,
                reqUrl: `/arc/archive.org/download/${this.itemid}/cover_t.jpg`,
                page: 'cover_t.jpg',
                skipNet: true
              }, cb1),  // TODO Dont currently store the cover_t size/downloaded, its minor discrepancy since usually smaller and wont have full download without it anyway
              cb1 => each(
                [].concat(...this.bookreader.brOptions.data),
                (d, cb2) => {
                  if (d.downloaded) {
                    cb2();
                  } else {
                    // See ALMOST-SAME-CODE-BOOKMETA
                    const url = new URL(d.uri);
                    url.searchParams.append("scale", 2);
                    url.searchParams.append("rotate", 0);
                    this.fetch_page({
                      wantSize: true,
                      zip: url.searchParams.get("zip"),
                      file: url.searchParams.get("file"),
                      scale: 2,
                      rotate: 0,
                      reqUrl: url.pathname + url.search,
                      skipNet: true
                    }, (err, size) => {
                      if (err) {
                        d.downloaded = false;
                      } else {
                        d.downloaded = true;
                        d.size = size;
                      }
                      cb2();
                    });
                  }}, cb1),
            ], (err, res) => cb0(null)),
            cb0 => {
              // Note .flat isnt valid till node 11.x
              const downloadedPages = [].concat(...this.bookreader.brOptions.data).filter(pg => pg.downloaded);
              this.downloaded.pages_size = downloadedPages.reduce((sum, pg) => sum + pg.size, 0);
              this.downloaded.pages_count = downloadedPages.length;
              this.downloaded.pages_details = downloadedPages.length === [].concat(...this.bookreader.brOptions.data).length;
              _save1file("bookreader", this.bookreader, this._namepart(), cb0);
            },
          ], cb);
        }
      });
    }
  });
}

ArchiveItem.prototype.addDownloadedInfoToMembers = function(cb) {
  // Add data to all members - which can be done in parallel
  each((this.membersFav || []).concat(this.membersSearch || []),
    // On each member, just adding info on files, as dont want to recurse down (and possibly loop) on members that are collections
    //TODO-DOWNLOAD shortcut, dont attempt to find metadata https://github.com/internetarchive/dweb-mirror/issues/142
    (member, cb1) => { new ArchiveItem({identifier: member.identifier}).addDownloadedInfoFiles((err, ai) => {
      if (err) {
        // Shouldnt happen since addDownloadedInfoMembers reports and ignores its own errors
        debug("addDownloadedInfoMembers failed for %s in %s: %o", this.itemid, member.identifier, err);
      } else {
        member.downloaded = ai.downloaded;
      }
      cb1(null);
    }) },
    cb);
};

ArchiveItem.prototype.summarizeMembers = function(cb) {
  // Add summary information about members to this.downloaded
  // cb(err);
  const membersDownloaded = this.membersFav.concat(this.membersSearch || []).filter(am => (typeof am.downloaded !== "undefined"));
  this.downloaded.members_size = membersDownloaded.reduce((sum, am) => sum + am.downloaded.files_size, 0);
  this.downloaded.members_details_count = membersDownloaded.filter(am => am.downloaded.details).length;
  cb(null);
};

ArchiveItem.prototype.addDownloadedInfoMembers = function(cb) {
  // Fetch members from cache (but not net), add .downloaded field on all members, and summary on Item
  if ((typeof this.downloaded !== "object") || (this.downloaded === null)) { // Could be undefined, or legacy boolean
    this.downloaded = {};
  }
  waterfall([
    cb1 => {
      if (!this.itemid) {
        if (!this.downloaded.members_all_count) this.downloaded.members_all_count = this.numFound; // As in result of a search
        cb1(null);
      } else {
        ArchiveMember.fromIdentifier(this.itemid)
          .read({}, (err, o) => {
            if (!err) {
              this.downloaded.members_all_count = o.item_count; // Unfortunately missing from item extras
            }
            cb1(null); // Ignore error from reading
      })}},
    cb1 => { // Load any members searched from _members_cached.json (_membersFav will already be loaded)
      if (this.membersSearch) {
        cb1(null, null);
      } else {
        this.fetch_query({skipNet: true}, cb1); // Page of members returned, can ignore
      } },
    (unusedArr, cb1) =>
      this.addDownloadedInfoToMembers(cb1),
    cb1 =>
      this.summarizeMembers(cb1)
    ],cb);
};

ArchiveItem.prototype.addCrawlInfoMembers = function({config}, cb) {
  // Add .downloaded field on all members, and summary on Item
  if ((typeof this.downloaded !== "object") || (this.downloaded === null)) { // Could be undefined, or legacy boolean or null
    this.downloaded = {};
  }
  // Add data to all members - which can be done in parallel
  each((this.membersFav || []).concat(this.membersSearch || [] ),
    // On each member, just adding info on files, as dont want to recurse down (and possibly loop) on members that are collections
    (member, cb1) => member.addCrawlInfo({config}, cb1),
    cb);
};

// noinspection JSUnresolvedVariable
ArchiveItem.prototype.addCrawlInfo = function({config}, cb) {
  // In place add
  // Note that .itemid &| .metadata may be undefined
  Object.assign(this, {crawl: config.crawlInfo(this.itemid, this.metadata && this.metadata.mediatype)});
  if  ((typeof this.downloaded !== "object") || (this.downloaded === null)) { // Could be undefined, or legacy boolean
    this.downloaded = {};
  }
  waterfall([
    cb1 => this.fetch_metadata({skipNet: true}, cb1), // Fetch metadata first as wanted by multiple of these
    (unusedAI, cb1) => parallel([ //TODO-bOOK put back to parallel
      // Process files
      cb2 => this.addDownloadedInfoFiles(cb2),
      // Process pages (for texts only)
      cb2 => this.addDownloadedInfoPages(cb2),
      // Process members (collections only)
      cb2 => this.addDownloadedInfoMembers(cb2),
      cb2 => this.addCrawlInfoMembers({config}, cb2),
     ], err => //TODO-BOOK re-collapse
      cb1(err))
    ], err => {
      this.downloaded.details = this.metadata.mediatype !== "texts"
        ? (this.downloaded.files_details && this.downloaded.pages_details)
        : this.downloaded.files_details
      cb(err);
  });
};

// noinspection JSUnresolvedVariable
ArchiveItem.prototype.exportFiles = function() {  // Note overridden in dweb-mirror.ArchiveItemPatched
  // Note we are storing d.downloaded in the metadata because we only have one level deep, this is undone when read back in TODO
  return this.files.map(f => Object.assign({downloaded: f.downloaded}, f.metadata));
};

exports = module.exports = ArchiveItem;