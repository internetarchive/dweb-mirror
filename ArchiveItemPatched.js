/*
// Monkey patches dweb-archivecontroller,
// Note cant merge into dweb-archivecontroller as wont work in browser; and cant create subclass as want everywhere e.g. archivefile.fetch_metadata is used to use the cache
 */

//NPM repos
const path = require('path');
const debug = require('debug')('dweb-mirror:ArchiveItem');
const canonicaljson = require('@stratumn/canonicaljson');
const waterfall = require('async/waterfall');
const each = require('async/each');
const parallel = require('async/parallel');
// Other IA repos
const ArchiveItem = require('@internetarchive/dweb-archivecontroller/ArchiveItem');
const ArchiveMember = require('@internetarchive/dweb-archivecontroller/ArchiveMember');
const RawBookReaderResponse = require('@internetarchive/dweb-archivecontroller/RawBookReaderResponse');
const Util = require('@internetarchive/dweb-archivecontroller/Util');
// Other files from this repo
const MirrorFS = require('./MirrorFS');

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
        {collection_titles, collecton_sort_order, dir, files_count, is_dark, server} -> <IDENTIFIER>.extra.json
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
                    ["members", this.members],
                    ["files", this.exportFiles()],
                    ["extra", Object.fromEntries( ArchiveItem.extraFields.map(k => [k, this[k]]))],
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
            cb(err, o); }),
        cb => _parse("files", (err, o) => {
            if (!err) { res.files = o; res.files_count = res.files.length; }
            cb(err, o); }),
        cb => _parse("reviews", (err, o) => {
            res.reviews = o; // Undefined if failed but not an error
            cb(null); }),
        cb => _parse("members", (err, o) => {
            res.members = o; // Undefined if failed but not an error
            cb(null); }),
        cb => _parse("extra", (err, o) => {
            // Unavailable on archive.org but there on dweb.archive.org: collection_titles
            // Not relevant on dweb.archive.org, d1, d2, item_size, uniq, workable_servers
            ArchiveItem.extraFields.forEach(k => res[k] = o && o[k]);
            cb(null); }),
    ], (err, unused) => {
        if (err) {
            cb(err);
        } else { // This has to happen after the parallel because requires access to metadata
            if (["audio", "etree", "movies"].includes(res.metadata.mediatype)) {
                _parse("playlist", (err, o) => {
                    res.playlist = o; // maybe undefined
                    cb(err, res);    // Should fail if no playlist, so re-reads from server and gets playlist
                });
            } else { // Dont need a playlist
                cb(null, res);
            }
        } } )
};

// noinspection JSUnresolvedVariable
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
ArchiveItem.prototype.fetch_bookreader = function(opts={}, cb) {
    /*
    Fetch the bookreader data for this item if it hasn't already been.
    More flexible version than dweb-archive.ArchiveItem
    Monkey patched into dweb-archive.ArchiveItem so that it runs anywhere that dweb-archive attempts to fetch_bookreader
    Alternatives:
    skipCache:          load from net
    cached:             return from cache
    !cached:            Load from net, save to cache

    cb(err, this) or if undefined, returns a promise resolving to 'this'
    Errors              TransportError (404)

    Result is ai.bookreader = { brOptions, data, lendingInfo}
     */
    if (typeof opts === "function") { cb = opts; opts = {}; } // Allow opts parameter to be skipped
    const skipCache = opts.skipCache;           // If set will not try and read cache
    // noinspection JSUnresolvedVariable
    if (cb) { try { f.call(this, cb) } catch(err) {
        cb(err)}}
    else { return new Promise((resolve, reject) => { try { f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} })} catch(err) {reject(err)}})} // Promisify pattern v2
    function errOrDark(err) {
        //TODO - this is not defined here
        return err ? err : (this.is_dark && !opts.darkOk) ? new Error(`item ${this.itemid} is dark`) : null;
    }
    function f(cb) {
        if (this.itemid && !(this.bookreader || this.is_dark)) { // Check haven't already loaded or fetched metadata (is_dark wont have a .metadata)
            if (!skipCache) { // We have a cache directory to look in
                //TODO-CACHE-AGING need timing of how long use old metadata
                this.read_bookreader((err, bookapi) => { // RawBookReaderResponse = { data: { data, brOptions, lendingInfo }}
                    if (err) { // No cached version
                        this._fetch_bookreader(opts, (err, ai) => {
                            if (err) {
                                cb(err); // Failed to read during fetch_metadata & failed to fetch here
                            } else {
                                ai.saveBookReader({}, (err, res) => cb(errOrDark.call(this, null), res)); // resave as have new data
                            }  // Save data fetched (de-fjorded)
                        });    // resolves to this
                    } else {    // Local read succeeded.
                        this.loadFromBookreaderAPI(bookapi); // Saved Metadata will have processed Fjords and includes the reviews, files, and other fields of _fetch_metadata()
                        //TODO-BOOK ensure copying bookreader during a crawl to an explicit copyDirectory
                        if (MirrorFS.copyDirectory) { // If copyDirectory explicitly specified then save to it.
                            this.saveBookReader({}, (err, res) => cb(errOrDark.call(this, null), res));
                        } else {
                            cb(errOrDark.call(this, null), this);
                        }
                    }
                })
            } else { // No cache Directory or skipCache telling us not to use it for read or save
                this._fetch_bookreader(opts, cb); // Process Fjords and load .metadata and .files etc - handles darkOk
            }
        } else {
            cb(errOrDark.call(this, null), this);
        }
    }
};

ArchiveItem.prototype.fetch_page = function({wantStream=false, reqUrl=undefined, zip=undefined, file=undefined, scale=undefined, rotate=undefined, page=undefined}={}, cb) {
    /* Fetch a page from the item, caching it
        cb(err, data || stream) returns either data, or if wantStream then a stream
     */
    let zipfile;
    if (zip) zipfile = zip.split('/')[4];
    waterfall([
        (cbw) => this.fetch_metadata(cbw),
        (ai, cbw) => {
            // request URLs dont have server, and need to add datanode anyway - note passes scale & rotate
            const urls = page
                ? `https://${ai.server}/BookReader/BookReaderPreview.php?${Util.parmsFrom({id: this.itemid, itemPath: this.dir, server: this.server, page: page})}`
                : "https://" + ai.server + reqUrl;
            const debugname = `${this.itemid}_${file}`;
            const relFilePath = `${this.itemid}/_pages/` + (page ? page : `${zipfile}/scale${Math.floor(scale)}/rotate${rotate}/${file}`);
            if (page) { // This is the cover , its not scaled or rotated
                MirrorFS.cacheAndOrStream({ urls, wantStream, debugname, relFilePath}, cbw)
            } else { // Looking for page by number with scale and rotation
                MirrorFS.checkWhereValidFileRotatedScaled({file, scale, rotate, // Find which valid scale/rotate we have,
                    relFileDir: `${this.itemid}/_pages/${zipfile}`},
                    (err, relFilePath2) => { // undefined if not found
                        // Use this filepath if find an appropriately scaled one, otherwise use the one we really want from above
                        //TODO there is an edge case where find wrongly scaled file, but if copydir is set we'll copy that to relFilePath
                        MirrorFS.cacheAndOrStream({urls, wantStream, debugname, relFilePath: relFilePath2 || relFilePath }, cbw)
                    }
                )
            } }
    ], cb);
}

// noinspection JSUnresolvedVariable
ArchiveItem.prototype.fetch_metadata = function(opts={}, cb) {
    /*
    Fetch the metadata for this item if it hasn't already been.
    More flexible version than dweb-archive.ArchiveItem
    Monkey patched into dweb-archive.ArchiveItem so that it runs anywhere that dweb-archive attempts to fetch_metadata
    Alternatives:
    skipCache:          load from net
    cached:             return from cache
    !cached:            Load from net, save to cache

    cb(err, this) or if undefined, returns a promise resolving to 'this'
    Errors              TransportError (404)
     */
    if (typeof opts === "function") { cb = opts; opts = {}; } // Allow opts parameter to be skipped
    const skipCache = opts.skipCache;           // If set will not try and read cache
    // noinspection JSUnresolvedVariable
    if (cb) { try { f.call(this, cb) } catch(err) {
        cb(err)}}
    else { return new Promise((resolve, reject) => { try { f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} })} catch(err) {reject(err)}})} // Promisify pattern v2
    function errOrDark(err) {
        return err ? err : (this.is_dark && !opts.darkOk) ? new Error(`item ${this.itemid} is dark`) : null;
    }
    function f(cb) {
        if (this.itemid && !(this.metadata || this.is_dark)) { // Check haven't already loaded or fetched metadata (is_dark wont have a .metadata)
            if (!skipCache) { // We have a cache directory to look in
                //TODO-CACHE-AGING need timing of how long use old metadata
                this.read((err, metadata) => {
                    if (err) { // No cached version
                        this._fetch_metadata(Object.assign({}, opts, {darkOk: true}), (err, ai) => { // Process Fjords and load .metadata and .files etc - allow isDark just throw before caller
                            if (err) {
                                cb(err); // Failed to read & failed to fetch
                            } else {
                                ai.save({}, (err, res) => cb(errOrDark(null), res));
                            }  // Save data fetched (de-fjorded)
                        });    // resolves to this
                    } else {    // Local read succeeded.
                        this.loadFromMetadataAPI(metadata); // Saved Metadata will have processed Fjords and includes the reviews, files, and other fields of _fetch_metadata()
                        if (MirrorFS.copyDirectory) { // If copyDirectory explicitly specified then save to it.
                            this.save({}, (err, res) => cb(errOrDark(null), res));
                        } else {
                            cb(errOrDark(null), this);
                        }
                    }
                })
            } else { // No cache Directory or skipCache telling us not to use it for read or save
                this._fetch_metadata(opts, cb); // Process Fjords and load .metadata and .files etc - handles darkOk
            }
        } else {
            cb(errOrDark(null), this);
        }
    }
};

// noinspection JSUnresolvedVariable
ArchiveItem.prototype.fetch_query = function(opts={}, cb) {
    /*  Monkeypatch ArchiveItem.fetch_query to make it check the cache
        cb(err, [ArchiveMember])

        Strategy is:
        * Read <IDENTIFIER>_members_cached.json if it exists into .members
        * Expand each of `.members` from its `<IDENTIFIER>_member.json` if necessary and file exists.
        * Run _fetch_query which will also handled fav-*'s `members.json` files, and `query` metadata field.
        * Write the result back to `<IDENTIFIER>_members_cached.json`
        * Write each member to its own `<IDENTIFIER>_member.json`
     */
    if (typeof opts === "function") { cb = opts; opts = {}; } // Allow opts parameter to be skipped
    const skipCache = opts.skipCache; // Set if should ignore cache
    if (cb) { try { f.call(this, cb) } catch(err) { cb(err)}} else { return new Promise((resolve, reject) => { try { f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} })} catch(err) {reject(err)}})} // Promisify pattern v2

    function f(cb) {
        //TODO-CACHE-AGING
        // noinspection JSUnresolvedVariable
        const namepart = this._namepart();  // Can be undefined for example for list of members unconnected to an item
        if (!skipCache) {
            const relFilePath = namepart && path.join(namepart, namepart + "_members_cached.json");
            waterfall([
                (cb) => { // Read from members_cached.json files from cache if available
                    if (!relFilePath) {
                        cb();
                    } else {
                        MirrorFS.readFile(relFilePath, (err, jsonstring) => {
                            if (!err) {
                                try {
                                    const data = canonicaljson.parse(jsonstring);
                                    this.members = data.map(o => new ArchiveMember(o, {unexpanded: !o.publicdate}));
                                } catch(err) {
                                    debug("Cant parse json in %s: %s", relFilePath, err.message);
                                    this.members = []
                                }
                            }
                            cb();
                        });
                    } },
                (cb) => { // Expand the members if necessary and possible locally, errors are ignored
                    // unexpanded members typically come from either:
                    // a direct req from client to server for identifier:...
                    // or for identifier=fav-* when members loaded with unexpanded
                    if (this.members) {
                        Util.asyncMap(this.members,
                            (ams,cb2) => {
                                if (ams instanceof ArchiveMember) { // Expanded or unexpanded
                                    cb2(null, ams)
                                } else { ams.read({},(err, o) =>
                                    cb2(null, o ? new ArchiveMember(o) : ams)); }},
                            (err, arr) => {
                            this.members=arr; cb() }); // Expand where possible
                    } else {
                        cb();
                    }
                },
                // _fetch_query will optimize, it tries to expand any unexpanded members, and only does the query if needed (because too few pages retrieved)
                // unexpanded members are a valid response - client should do what it can to display them.
                (cb) => {
                    this._fetch_query(opts, cb) }, // arr of search result or slice of existing members
                (arr, cb) => {
                    // arr will be matching ArchiveMembers, possibly wrapped in Response (depending on opts) or undefined if not a collection or search
                    // fetch_query.members will have the full set to this point (note .files is the files for the item, not the ArchiveItems for the search)
                    if (this.members && relFilePath) {
                        MirrorFS.writeFile(relFilePath, canonicaljson.stringify(this.members), (err) => cb(err, arr))
                    } else {
                        cb(null, arr);
                    }
                },
                (arr, cb) => { // Save members
                    if (this.members) {
                        // noinspection JSUnusedLocalSymbols
                        this.members.filter(ams => ams.isExpanded()).forEach(ams=>ams.save((unusederr)=>{})); } // Note this returns before they are saved
                    cb(null, arr); // Return just the new members found by the query, dont worry about errors (logged in ams.save
                                   // Not that arr may or may not be wrapped in response by _fetch_query depending on opts
                }
            ], cb );
        } else {
            this._fetch_query(opts, cb);    // Uncached version (like ArchiveItem.fetch_query did before patching)
        }
    }
};


// noinspection JSUnresolvedVariable
ArchiveItem.prototype.saveThumbnail = function({skipFetchFile=false, wantStream=false} = {}, cb) {
    /*
    Save a thumbnail to the cache, note must be called after fetch_metadata
    wantStream      true if want stream instead of ArchiveItem returned
    skipFetchFile   true if should skip net retrieval - used for debugging
    cb(err, this)||cb(err, stream)  Callback on completion with self (mirroring), or on starting with stream (browser)
    */

    const namepart = this.itemid; // Its also in this.metadata.identifier but only if done a fetch_metadata

    if (!namepart) {
        cb(null,wantStream ? undefined : this);
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
                    af.cacheAndOrStream({skipFetchFile, wantStream}, recursable); // Recurse
                    // Exits, allowing recursable to recurse with next iteration
                } else { // Completed loop
                    // cb will be set except in the case of wantStream in which case will have been called with first stream
                    if (cb) cb(null, self); // Important to cb only after saving, since other file saving might check its SHA and dont want a race condition
                }
            };
            recursable(null, null);
        } else {  // No existing __ia_thumb.jpg or ITEMID_itemimage.jpg so get from services or thumbnail
            // noinspection JSUnresolvedVariable
            const servicesurl = `${Util.gatewayServer()}${Util.gateway.url_servicesimg}${this.itemid}`; // Direct to Archive server not via gateway
            // Include direct link to services
            if (!this.metadata.thumbnaillinks.includes(servicesurl)) this.metadata.thumbnaillinks.push(servicesurl);
            const relFilePath = path.join(this._namepart(), "__ia_thumb.jpg"); //TODO-IMAGE Assumes using __ia_thumb.jpg instead of ITEMID_itemimage.jpg
            const debugname = relFilePath;
            MirrorFS.cacheAndOrStream({relFilePath, skipFetchFile, wantStream, debugname,
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
ArchiveItem.prototype.fetch_playlist = function({wantStream=false} = {}, cb) {
    /*
    Save the related items to the cache, TODO-CACHE-AGING
    wantStream      true if want stream) alternative is obj. obj will be processed, stream will always be raw (assuming client processes it)
    cb(err, stream|obj)  Callback on completion with related items object (can be [])
    */
    const itemid = this.itemid; // Its also in this.metadata.identifier but only if done a fetch_metadata
    if (itemid) {
        // noinspection JSUnresolvedVariable
        const relFilePath = path.join(this._namepart(), this._namepart()+"_playlist.json");
        // noinspection JSUnresolvedVariable
        MirrorFS.cacheAndOrStream({wantStream, relFilePath,
            wantBuff: !wantStream, // Explicit because default for cacheAndOrStream if !wantStream is to return undefined
            urls: `https://archive.org/embed/${itemid}?output=json`, // Hard coded, would rather have in Util.gateway.url_playlist but complex
            debugname: itemid + "/" + itemid + "_playlist.json"
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
        cb(null, wantMembers ? [] : undefined);
    }
};

// noinspection JSUnresolvedVariable
ArchiveItem.prototype.relatedItems = function({wantStream=false, wantMembers=false} = {}, cb) {
    /*
    Save the related items to the cache, TODO-CACHE-AGING
    wantStream      true if want stream) alternative is obj
    cb(err, stream|obj)  Callback on completion with related items object (can be [])
    */
    const itemid = this.itemid; // Its also in this.metadata.identifier but only if done a fetch_metadata
    if (itemid) {
        // noinspection JSUnresolvedVariable
        const relFilePath = path.join(this._namepart(), this._namepart()+"_related.json");
        // noinspection JSUnresolvedVariable
        MirrorFS.cacheAndOrStream({wantStream, relFilePath,
            wantBuff: !wantStream, // Explicit because default for cacheAndOrStream if !wantStream is to return undefined
            urls: Util.gateway.url_related + itemid, //url_related currently ends in /
            debugname: itemid + "/" + itemid + "_related.json"
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
                cb(err, res)
            }
        });
    } else {
        cb(null, wantMembers ? [] : undefined);
    }
};


exports = module.exports = ArchiveItem;