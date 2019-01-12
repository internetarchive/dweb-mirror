#API for dweb-mirror v0.1.0

This document covers the API for v0.1.0 of dweb-mirror which will be the first semi-stable one. 

#### Outline of APIs

* Config file: Control the behavior of each of the apps in this package
* Apps can be built on top of dweb-archivecontroller's classes:
  ArchiveItem, ArchiveMember, ArchiveFile which are extended by this package.
* A set of classes that provide higher level support esp:
  * TODO-DOC fill in here

#### Expected API changes

The API may change fairly frequently up until v1.0.0. Likely changes should be documented here. 

# Config file

#### Expected changes
config.js is definately going to change to provide both generic control, and an ability to fine grain configuration 
at the app; collection; and item; levels. 

For now - the file is (inadequate) self-documentation  TODO-DOCS

# Files on disk

Files are stored in a 2 level directory structure, each Archive Item is a directory, and each Archive File is a file. 
Metadata is stored in specially named files. 

### Cache outline for each Item.

|file|from|
|----|----|
|<IDENTIFIER>.meta.json|ArchiveItem.metadata|
|<IDENTIFIER>.reviews.json|ArchiveItem.reviews|
|<IDENTIFIER>.files.json|ArchiveItem.files|
|<IDENTIFIER>.extra.json|ArchiveItem.{collection_titles}|
|<IDENTIFIER>.member.json|ArchiveItem.members|
|<IDENTIFIER>.members.json|List of members - this file is a normal ArchiveFile in fav-* collections|
|<IDENTIFIER>.members_cached.json|ArchiveMemberSearch.*|
|__ia_thumb.jpg|Image file ~10kbytes|


# Local classes
#### Common features and parameters
```
cacheDirectory  points at top level of a cache. TODO will allow multiple directories and/or get from config
cb(err, res)    Unless otherwise documented callbacks return an error, (subclass of Error) or null, 
                and optional return data.  
                Some functions also support an absent cb as returning a Promise, otherwise cb is required 
                feel free to add Promise support to any function lacking it.
```

# ArchiveController and Extensions

See [dweb-archivecontroller/API.md](https://github.com/internetarchive/dweb-archivecontroller/blob/master/API.md) for docs before dweb-mirror extensions, 
only changes made in dweb-mirror appear here.

## ArchiveFile

##### cacheAndOrStream({cacheDirectory = undefined,  skipFetchFile=false, wantStream=false, start=0, end=undefined} = {}, cb)

Return a stream for an ArchiveFile, checking the cache first, and caching the file if not already cached.

See MirrorFS.cacheAndOrStream for arguments. TODO-link

## ArchiveItem

##### save({cacheDirectory = undefined} = {}, cb)

Save metadata for this file as JSON in multiple files (see File Outline)
```
cb(err, this)   Errors if cant fetch metadata, or save failed
```

If not already done so, will `fetch_metadata` (but not query, as that may want to be precisely controlled)

##### read({cacheDirectory = undefined} = {}, cb)

Read metadata, reviews, files and extra from corresponding files - see `Files on disk`
```
cb(err, {files, files_count, metadata, reviews, collection_titles})  data structure suitable for "item" field of ArchiveItem
```

##### fetch_metadata(opts={}, cb)

Fetch the metadata for this item if it hasn't already been.

A more flexible version than dweb-archive.ArchiveItem.fetch_metadata,
which is monkey patched into dweb-archive.ArchiveItem so that it runs anywhere that dweb-archive attempts to fetch_metadata

```
Alternatives:
!cacheDirectory:    load from net
cached:             return from cache
!cached:            Load from net, save to cache

cb(err, this)       (optional - returns promise if undefined)
Errors              TransportError (404)
```

##### fetch_query(opts={}, cb)

Fetch the next page of the query for this item.

A more flexible version than dweb-archive.ArchiveItem.fetch_query 
which is monkey patched into dweb-archive.ArchiveItem so that it runs anywhere that dweb-archive attempts to fetch_query.

```
opts { skipCache, ...}  skipCache means don't check the cache, behaves like the unpatched ArchiveItem.fetch_query
```
Strategy is:
* Read <IDENTIFIER>_members_cached.json if it exists into .members
* Expand each of `.members` from its `<IDENTIFIER>_member.json` if necessary and file exists.
* Run _fetch_query which will also handled fav-*'s `members.json` files, and `query` metadata field.
* Write the result back to `<IDENTIFIER>_members_cached.json`
* Write each member to its own `<IDENTIFIER>_member.json`

##### saveThumbnail({cacheDirectory = undefined,  skipFetchFile=false, wantStream=false} = {}, cb)

Save a thumbnail to the cache,
```
wantStream      true if want stream instead of ArchiveItem returned
skipFetchFile   true if should skip net retrieval - used for debugging
cb(err, this)||cb(err, stream)  Callback on completion with self (mirroring), or on starting with stream (browser)
```

##### relatedItems({cacheDirectory = undefined, wantStream=false} = {}, cb)
Save the related items to the cache
```
wantStream      true if want stream instead of object returned
cb(err, obj)  Callback on completion with related items object
```

## ArchiveMember 

##### static read({cacheDirectory = undefined, identifier = undefined}, cb)
Read member info for an item
```
identifier: Where to look - can be a real identifier or pseudo-one for a saved search
cb(err, data structure from file)
```
##### read({cacheDirectory = undefined}, cb)
Read member info for an item
```
cb(err, data structure from file)
```

## ArchiveMemberSearch

##### save({cacheDirectory = undefined} = {}, cb)
Save the results of a search as a `<IDENTIFIER>_member.json` file
```
cb(err, this)
```

# Other classes

## HashStore
A generic hashstore, table/key/value triples.

Note this is similar to that in dweb-gateway but its usage does a different mapping for data stored.

Note - it is all static functions since there is no meaningful instance. 

##### properties
```
config {
    dir     Prefix for Directory where data stored (actual directories are <dir><table> so this should typically end with a punctuation or /
}
tables {}   Caches pointers to leveldb objects that manage tables (each being a stored in a directory)
```

##### parameters of all methods
```
table   name of table (by convention, in dweb-mirror we use the mapping as the table name e.g. `sha1.filepath`
key     name of key (by convention its the left side of the table name e.g. the sha1.
        For some functions (put) it may be an object mapping keys to val in which case val is ignored
val     value to store

```

##### static init(config)
Save configuration (see `properties`)

##### static put(table, key, val, cb(err, unused))
Store value to key

##### get(table, key, cb(err, value)) 
Retrieve value stored to key, returns `undefined` if not found (not an error)

##### del(table, key)
Delete value stored at the key, future `get` will return undefined.

##### map(table, cb(key, value), {options unused})
Creates a stream, that calls cb(key, value) for each key/value pair. 
```
return stream     So that further .on can be added 
```

##### keys(table)
Returns a promise that resolves to an array of keys. 

TODO this will probably be improved to add a cb(err, keys) paramter

## MirrorConfig
TODO-DOCS document API

## CrawlManager, CrawlFile TODO

A set of related classes for managing crawling

### configuration
The crawl is initialized from a datastructure, or indirectly from JSON syntax is:
```
config:     [ configtask ]
configtask: { identifier, level, query, search, related}
identifier: Archive identifier OR array of them OR `` for Home
level:      any of _levels (e.g. "tile") How deep to fetch an item
query:      Alternative to identifier, specify a query
search:     searchopts  Apply to each search result (or member of a collection)
related:    searchopts  Apply to each of the related items
searchopts: { sort, rows, level, search, related } specify a search, and what to apply to each result.
sort:       Sort order for search e.g. "-downloads"
rows:       How many results to fetch
```
#### Configuration file example
```
  { identifier: "foo", level: "metadata" }
  { identifier: "prelinger", level: "details", search: [                     // Fetch details for prelinger
        { sort: "-downloads", rows: 100, level: "details" }        // Query first 100 items and get their details
        { sort: "-downloads", rows: 200, level: "tile" } ] }  // and next 200 items and get their thumbnails only
  ]
```

### class CrawlManager
Currently (may change) one instance only - that has parameterisation for crawls.

##### Attributes
```
_levels     ["tile", "metadata", "details", "all"]  Allowable task levels, in order.
_uniqItems  { identifier: [ task* ] } Dictionary of tasks carried out per item, used for checking uniqueness and avoiding loops (identifier also has pseudo-identifiers like _SEARCH_123abc
_uniqItems  { identifier: [ task* ] } Dictionary of tasks carried out per file, used for checking uniqueness and avoiding loops
errors      [{task, error}]             Array of errors encountered to report on at the end.
completed   int                         Count of tasks completed (for reporting)
pushedCount int                         Count of tasks pushed onto the queue, usd for checking against limitTotalTasks
_taskQ      async queue                 Queue of tasks to run (from async package)
defaults {
    details_search                      Default search to perform as part of "details" or "full" (usually sufficient to paint tiles)
    details_related                     Default crawl on related items when doing "details" or "full" (usually sufficient to paint tiles)
    }
skipCache   bool||false                 If true will ignore the cache, this is useful to make sure hits server to ensure it precaches/pushes to IPFS etc
skipFetchFile bool||false               If true will just comment on file, not actually fetch it (including thumbnails)
maxFileSize int||undefined              If set, constrains maximum size of any one file
concurrency int||1                      Sets the number of tasks that can be processed at a time
limitTotalTasks:int||undefined          If set, limits the total number of tasks that can be handled in a crawl, this is approx the number of items plus number of files
cm                                      Points to single instance created (this may change)
```
#### new CrawlManager({skipFetchFile=false, skipCache=false, maxFileSize=undefined, concurrency=1, limitTotalTasks}={})

See attributes for meaning of arguments.

Create and initialize a CrawlManager instance (only call once currently).

#### push(task)

Add a task to _taskQ provided performing some checks first (esp limitTotalTasks)

#### setopts(opts={}) {

Set any of the attributes, normally skipCache, skipFetchFile, maxFileSize, concurrency, limitTotalTasks

#### static startCrawl(initialItemTaskList, {skipFetchFile=false, skipCache=false, maxFileSize=undefined, concurrency=1, limitTotalTasks=undefined}={}) {
```
initialItemTaskList config  // Configuration to push to the task list - see config
see arguments for other parameters
```

#### drained()

Called when final task processed, to report on results.

### class Crawlable
Synonymous with "task", parent class for different kinds of tasks.

#### Attributes
```
debugname:  Name used when reporting on this task, usually an Archive identifier or pseudo-identifier, or a filename.
parent [ debugname* ]   Array of parents of this task, allow reporting where a request for a task came from
```

#### new Crawlable(debugname, parent)

Create a new task, usually only ever called as super()

#### asParent()
returns array from concatenting debugname to parent array.

### class CrawlFile extends Crawlable
#### Attributes
inherited from Crawlable: debugname, parent
```
file    ArchiveFile
```
#### process(cb)
```
cb(err) Called when item processed - errors should be reported when encountered and then at the end of the crawl.
```
Process a ArchiveFile, retrieve it if not already cached, depends on state of skipFetchFile & maxFileSize

#### isUniq() {
True if havent already tried this file on this crawl.

### class CrawlItem extends Crawlable
#### Attributes
```
identifier  Archive Identifier
identifier, level, query, search, related:  see config
member      Pointer to ArchiveMember if known
```
#### static fromSearchMember(member, taskparms, parent)

Create a new CrawlItem and queue it, handles different kinds of members, including saved searches

#### isUniq()
True if the item has not been crawled this time at a greater or equal depth.

#### process(cb)

Process a task to crawl an item, complexity depends on its `.level` but can include fetch_metadata, fetch_query, saveThumbnail, crawling some or all of .files and relatedItems.



## MirrorFS
TODO-DOCS document API

# Applications

## collectionpreseed.js
TODO-DOCS special case of crawl

Usage: `$> cd /path/to/install/dweb-mirror && ./collectionpreseed.js`

This application uses the parallelStreams package to create a pipelined crawler
to walk a configurable tree which is currently two levels deep from `image`, `movies`, `texts`, `audio` 
and also the most popular collections. 

By performing the search on each collection it ensures the thumbnails are in IPFS. 

## crawl
TODO-DOCS TODO-API

# Installation files
TODO - update status of these at v0.1.x) 

The following files are present in `dweb-mirror` but are still a work in progress and not yet defined and will probably change a lot. 

* Dockerfile - create  docker file of dweb-mirror (untested, probably doesnt work yet)
* Dockerfile_ipfs - create a docker file for an IPFS instance - to go with the above Dockerfile (untested, probably doesnt work yet)
* install.sh  - run during `npm install` or after `npm update` by `npm run update` - makes some links based on which other repos are installed. 
* install_rachel.sh - variant of install.sh being built for Rachel platform (only partially complete)

# Other files

The following files are present in `dweb-mirror` but are still a work in progress and not yet defined and will probably change a lot. 

* index.html - skeleton for UI, will most likely be entirely rewritten and doesn't yet work.
* LICENCE - GNU Alfredo licence 
