/*
// Monkey patches dweb-archivecontroller,
// Note cant merge into dweb-archivecontroller as wont work in browser; and cant create subclass as want everywhere e.g. archivefile.fetch_metadata is used to use the cache
 */

//NPM repos
const fs = require('fs');   // See https://nodejs.org/api/fs.html
const path = require('path');
const debug = require('debug')('dweb-mirror:ArchiveItem');
const canonicaljson = require('@stratumn/canonicaljson');
const waterfall = require('async/waterfall');
// Other IA repos
const ArchiveItem = require('@internetarchive/dweb-archivecontroller/ArchiveItem');
const ArchiveMemberSearch = require('@internetarchive/dweb-archivecontroller/ArchiveMemberSearch');
const Util = require('@internetarchive/dweb-archivecontroller/Util');
// Other files from this repo
const MirrorFS = require('./MirrorFS');
const config = require('./config');

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

// noinspection JSUnresolvedVariable
ArchiveItem.prototype._dirpath = function(directory) {
    const namepart = this._namepart();
    return namepart ? path.join(directory, namepart) : undefined;
    };

// noinspection JSUnresolvedVariable
ArchiveItem.prototype.save = function({cacheDirectory = undefined} = {}, cb) {
    /*
        Save metadata for this file as JSON in multiple files.
        .metadata -> <IDENTIFIER>.meta.json
        .reviews -> <IDENTIFIER>.reviews.json
        .files -> <IDENTIFIER>.files.json
        {collection_titles} -> <IDENTIFIER>.extra.json
        Note `.members` will be saved in `<IDENTIFIER>_members.json` by Subclassing in MirrorCollection
        and .member_cached.json is saved from ArchiveMemberSearch not from ArchiveItems

        If not already done so, will `fetch_metadata` (but not query, as that may want to be precisely controlled)

    */
    console.assert(cacheDirectory, "ArchiveItem needs a directory in order to save");
    if (!this.itemid) {
        // Must be a Search so dont try and save files - might save members
        debug("Search so not saving");
        cb(null, this);
    } else {
        const namepart = this.itemid; // Its also in this.item.metadata.identifier but only if done a fetch_metadata
        const dirpath = this._dirpath(cacheDirectory);

        if (!this.metadata) {
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
            MirrorFS._mkdir(dirpath, (err) => {
                if (err) {
                    console.error(`Cannot mkdir ${dirpath} so cant save item ${namepart} %s`, err.message);
                    cb(err);
                } else {
                    Util.forEach(   // TODO move to async.forEach which has same syntax
                        [
                            ["meta", this.metadata],
                            ["members", this.members],
                            ["files", this.exportFiles()],
                            ["extra", {collection_titles: this.collection_titles}],
                            ["reviews", this.reviews]
                        ],
                        (i, cbInner) => { // [ part, obj ]
                            const filepath = path.join(dirpath, `${namepart}_${i[0]}.json`);
                            if (typeof i[1] === "undefined") {
                                cbInner(null);
                            } else {
                                fs.writeFile(filepath, canonicaljson.stringify(i[1]), (err) => {
                                    if (err) {
                                        console.error(`Unable to write ${i[0]} to ${filepath}`);
                                        cbInner(err);
                                    } else {
                                        cbInner(null);
                                    }
                                });
                            }
                        },
                        (err)=>{if (err) { cb(err) } else { cb(null, this);}});
                }
            });
        }
    }

};
// noinspection JSUnresolvedVariable
// noinspection JSUnusedGlobalSymbols
ArchiveItem.prototype.read = function({cacheDirectory = undefined} = {}, cb) {
    /*
        Read metadata, reviews, files and extra from corresponding files
        cacheDirectory: Top level of directory to look for data in
        TODO-CACHE-MULTI allow cacheDirectory to be an array
        cb(err, {files, files_count, metadata, reviews, collection_titles})  data structure suitable for "item" field of ArchiveItem
    */
    const namepart = this.itemid;
    const res = {};
    const dirpath = this._dirpath(cacheDirectory);  // Undefined if just members and neither query nor itemid
    function _parse(part, cb) {
        const filename = path.join(dirpath, `${namepart}_${part}.json`);
        fs.readFile(filename, (err, jsonstring) => {
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
                }
                cb(null, o);
            }
        })
    }

    _parse("meta", (err, o) => {
        // errors: if called with an error when reading files
        if (err) {
            cb(new errors.NoLocalCopy());   // If can't read _meta then skip to reading from net rest are possibly optional though may be dependencies elsewhere.
        } else {
            res.metadata = o;
            _parse("files", (err, o) => {
                if (err) {
                    cb(new Error(`There is no local copy of the files for ${namepart}`));   // If can't read _meta then skip to reading from net rest are possibly optional though may be dependencies elsewhere.
                } else {
                    res.files = o;  // Undefined if failed which would be an error
                    res.files_count = res.files.length;
                    _parse("reviews", (err, o) => {
                        res.reviews = o; // Undefined if failed
                        _parse("members", (err, o) => {
                            res.members = o; // Undefined if failed
                            _parse("extra", (err, o) => {
                                // Unavailable on archive.org but there on dweb.archive.org: collection_titles
                                // Not relevant on dweb.archive.org, d1, d2, dir, item_size, server, uniq, workable_servers
                                res.collection_titles = o && o.collection_titles;
                                cb(null, res);
                            });
                        });
                    });
                }
            });
        }
    });
};

// noinspection JSUnresolvedVariable
ArchiveItem.prototype.fetch_metadata = function(opts={}, cb) {
    /*
    Fetch the metadata for this item if it hasn't already been.
    More flexible version than dweb-archive.ArchiveItem
    Monkey patched into dweb-archive.ArchiveItem so that it runs anywhere that dweb-archive attempts to fetch_metadata
    Alternatives:
    !cacheDirectory:    load from net
    cached:             return from cache
    !cached:            Load from net, save to cache

    cb(err, this) or if undefined, returns a promise resolving to 'this'
    Errors              TransportError (404)
     */
    if (typeof opts === "function") { cb = opts; opts = {}; } // Allow opts parameter to be skipped
    const skipCache = opts.skipCache;           // If set will not try and read cache
    // noinspection JSUnresolvedVariable
    const cacheDirectory = config.directory;    // Cant pass as a parameter because things like "more" won't
    if (cb) { return f.call(this, cb) } else { return new Promise((resolve, reject) => f.call(this, (err, res) => { if (err) {reject(err)} else {resolve(res)} }))}        //NOTE this is PROMISIFY pattern used elsewhere
    function f(cb) {
        if (this.itemid && !this.metadata) { // Check haven't already loaded or fetched metadata
            if (cacheDirectory && !skipCache) { // We have a cache directory to look in
                //TODO-CACHE-AGING need timing of how long use old metadata
                this.read({cacheDirectory}, (err, metadata) => {
                    if (err) { // No cached version
                        this._fetch_metadata((err, ai) => { // Process Fjords and load .metadata and .files etc
                            if (err) {
                                cb(err); // Failed to read & failed to fetch
                            } else {
                                ai.save({cacheDirectory}, cb);  // Save data fetched (de-fjorded)
                            }
                        });    // resolves to this
                    } else {    // Local read succeeded.
                        this.loadFromMetadataAPI(metadata); // Saved Metadata will have processed Fjords and includes the reviews, files, and other fields of _fetch_metadata()
                        cb(null, this);
                    }
                })
            } else { // No cache Directory or skipCache telling us not to use it for read or save
                this._fetch_metadata(cb); // Process Fjords and load .metadata and .files etc
            }
        } else {
            cb(null, this);
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
        const cacheDirectory = config.directory;    // Cant pass as a parameter because things like "more" won't
        const namepart = this._namepart();  // Can be undefined for example for list of members unconnected to an item
        if (cacheDirectory && !skipCache) {
            const dirpath = namepart && this._dirpath(cacheDirectory);
            const filepath = dirpath && namepart && path.join(dirpath, namepart + "_members_cached.json");
            waterfall([
                (cb) => { // Read from members_cached.json files from cache if available
                    if (!filepath) {
                        cb();
                    } else {
                        fs.readFile(filepath, (err, jsonstring) => {
                            if (!err) {
                                this.members = canonicaljson.parse(jsonstring).map(o => new ArchiveMemberSearch(o));
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
                            (am,cb2) => {
                                if (am instanceof ArchiveMemberSearch) { cb2(null, am) }
                                else { am.read({cacheDirectory}, (err, o) => cb2(null, o ? new ArchiveMemberSearch(o) : am)); }}   ,
                            (err, arr) => {this.members=arr; cb() }); // Expand where possible
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
                    if (this.members && filepath) {
                        MirrorFS.writeFile(filepath, canonicaljson.stringify(this.members), (err) => cb(err, arr))
                    } else {
                        cb(null, arr);
                    }
                },
                (arr, cb) => { // Save members
                    if (this.members) {
                        // noinspection JSUnusedLocalSymbols
                        this.members.filter(ams => ams instanceof ArchiveMemberSearch).forEach(ams=>ams.save({cacheDirectory}, (unusederr)=>{})); } // Note this returns before they are saved
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
ArchiveItem.prototype.saveThumbnail = function({cacheDirectory = undefined,  skipfetchfile=false, wantStream=false} = {}, cb) {
    /*
    Save a thumbnail to the cache,
    wantStream      true if want stream instead of ArchiveItem returned
    skipfetchfile   true if should skip net retrieval - used for debugging
    cb(err, this)||cb(err, stream)  Callback on completion with self (mirroring), or on starting with stream (browser)
    */

    console.assert(cacheDirectory, "ArchiveItem needs a directory in order to save");
    const namepart = this.itemid; // Its also in this.metadata.identifier but only if done a fetch_metadata
    const dirpath = this._dirpath(cacheDirectory);

    if (!this.itemid) {
        cb(null,this);
    } else {
        MirrorFS._mkdir(dirpath, (err) => { // Will almost certainly exist since typically comes after .save
            //TODO-THUMBNAILS use new ArchiveItem.thumbnailFile that creates a AF for a pseudofile
            if (err) {
                console.error(`Cannot mkdir ${dirpath} so cant save item ${namepart}`, err);
                cb(err);
            } else {
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
                            af.cacheAndOrStream({cacheDirectory, skipfetchfile, wantStream}, recursable); // Recurse
                            // Exits, allowing recursable to recurse with next iteration
                        } else { // Completed loop
                            // cb will be set except in the case of wantStream in which case will have been called with first stream
                            if (cb) cb(null, self); // Important to cb only after saving, since other file saving might check its SHA and dont want a race condition
                        }
                    };
                    recursable(null, null);
                } else {  // No existing __ia_thumb.jpg or ITEMID_itemimage.jpg so get from services or thumbnail
                    // noinspection JSUnresolvedVariable
                    const servicesurl = `${config.archiveorg.servicesImg}/${this.itemid}`;
                    // Include direct link to services
                    if (!this.metadata.thumbnaillinks.includes(servicesurl)) this.metadata.thumbnaillinks.push(servicesurl);
                    const dirpath = this._dirpath(cacheDirectory);
                    const filepath = path.join(dirpath, "__ia_thumb.jpg"); // Assumes using __ia_thumb.jpg instead of ITEMID_itemimage.jpg
                    const debugname = namepart + "/__ia_thumb.jpg";
                    MirrorFS.cacheAndOrStream({
                        cacheDirectory, filepath, skipfetchfile, wantStream, debugname,
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
        });
    }
};
// noinspection JSUnresolvedVariable
ArchiveItem.prototype.relatedItems = function({cacheDirectory = undefined, wantStream=false} = {}, cb) {
    /*
    Save the related items to the cache, TODO-CACHE-AGING
    wantStream      true if want stream instead of object returned
    cb(err, obj)  Callback on completion with related items object
    */
    console.assert(cacheDirectory, "relatedItems needs a directory in order to save");
    const itemid = this.itemid; // Its also in this.metadata.identifier but only if done a fetch_metadata
    // noinspection JSUnresolvedVariable
    const dirpath = this._dirpath(cacheDirectory);
    // noinspection JSUnresolvedVariable
    MirrorFS.cacheAndOrStream({cacheDirectory, wantStream,
        urls: config.archiveorg.related + "/" + itemid,
        filepath: path.join(dirpath, itemid+"_related.json"),
        debugname: itemid + itemid + "_related.json"
    }, cb);
};

exports = module.exports = ArchiveItem;