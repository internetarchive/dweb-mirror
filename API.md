#API for dweb-mirror v0.1.0

This document covers the API for v0.1.0 of dweb-mirror which will be the first semi-stable one. 

#### Outline of APIs

* Config file: Control the behavior of each of the apps in this package
* dweb-archivecontroller - base level classes which are extended by this package:
  ArchiveItem; ArchiveMember; ArchiveFile.
* A set of classes that provide higher level support esp:
  CrawlManager; HashStore; MirrorFS;
* A set of applications that use the APIs above, but which are themselves forkable:
  internetarchive; collectionpreseed.js

#### Expected API changes

The API may change fairly frequently up until v1.0.0. Likely changes should be documented here. 

# Config file

There are two config files, one at dweb-mirror/configDefaults.yaml 
and ~/dweb-mirror.config.yaml for which there is an example you can copy.

Both files follow the same format, and the settings in your home directory override that in dweb-mirror.

#### Expected changes
Note these files are definitely going to change as new features added, 
we will attempt to keep backward compatibility, i.e. to add parameters but not rearrange or delete, but no promises!

If in doubt, check the file itself which should be self-documenting
```
directories: [ path* ] # List of places to look for the Cache directory - expands ~/xx and ./xx and * etc
archiveui: # Anything relating to display of the Archive UI
  directory: [ ... ] # Where to look for the files for the Archive UI - uses first - expands ~/xx and ./xx and * etc
  apps: # Each application can have its own configuration
    http: # Relating to serving
    crawl: # Relating to crawling 
  upstream: "dweb.me" # Where to find an upstream server, typically "dweb.me"
```


# Files on disk

Files are stored in a 2 level directory structure, each Archive Item is a directory, and each Archive File is a file. 
Metadata is stored in specially named files. 

### Cache outline for each Item.

|file|from|
|----|----|
|<IDENTIFIER>.meta.json|ArchiveItem.metadata|
|<IDENTIFIER>.reviews.json|ArchiveItem.reviews|On disk is format returned by API
|<IDENTIFIER>.files.json|ArchiveItem.files|
|<IDENTIFIER>.extra.json|ArchiveItem.{collection_titles, collection_sort_order, files_count, is_dark, dir, server}|
|<IDENTIFIER>.member.json|ArchiveMember|As retrieved in a search
|<IDENTIFIER>.members.json|List of members - this file is a normal ArchiveFile in fav-* collections|
|<IDENTIFIER>.members_cached.json|ArchiveMember.*|All the search results for this item retrieved so far
|__ia_thumb.jpg|Image file ~10kbytes|

TODO-SORT In future the different sorts will have their own caches

TODO-THUMBNAILS The archive pattern for thumbnails is about to change (Jan2019) and will be reflected here.

# Local classes
#### Common features and parameters
```
copyDirectory   points at top level of a cache where want a copy
relFilePath     path to file or item inside a cache <IDENTIFIER>/<FILENAME>
skipCache       ignore anything in the cache - forces refetching and may cause upstream server to cache it
skipFetchFile   as an argument causes file fetching to be supressed
wantStream      Return results as a stream, just like received from the upstream.
cb(err, res)    Unless otherwise documented callbacks return an error, (subclass of Error) or null, 
                and optional return data.  
                Some functions also support an absent cb as returning a Promise, otherwise cb is required 
                feel free to add Promise support to any function lacking it, search for "Promise pattern v2" for examples of how to do this consistently.
```

# ArchiveController and Extensions

See [dweb-archivecontroller/API.md](https://github.com/internetarchive/dweb-archivecontroller/blob/master/API.md) for docs before dweb-mirror extensions, 
only changes made in dweb-mirror appear here.

## ArchiveFile

##### cacheAndOrStream({skipFetchFile, skipNet, wantStream, start, end}, cb)

Return a stream for an ArchiveFile, checking the cache first, and caching the file if not already cached.

See MirrorFS.cacheAndOrStream for arguments.

##### isDownloaded(cb) 

Returns true (via cb) if File has been downloaded

## ArchiveItem

##### save(opts={}, cb)

Save metadata for this file as JSON in multiple files (see File Outline)
```
cb(err, this)   Errors if cant fetch metadata, or save failed
```

If not already done so, will `fetch_metadata` (but not query, as that may want to be precisely controlled)

##### saveBookReader(opts={}, cb)

Save `.bookreader` to `IDENTIFIER.bookreader.json`. 

If `.bookreader` is undefined it will attempt to retrieve first.


##### read({}, cb)

Read metadata, playlist, reviews, files and extra from corresponding files - see `Files on disk`
```
cb(err, {files, files_count, metadata, reviews, collection_titles, collection_sort_order, is_dark, dir, server})  data structure suitable for "item" field of ArchiveItem
```

##### read_bookreader(opts={}, cb)

Read bookreader data from file and place in bookreader field on item.

File has: `{ data, brOptions, lendingInfo, possibly metadata }`

Item has `bookreader: { data, brOptions, lendingInfo }`

API returns `{ data: { data, brOptions, lendingInfo, possibly metadata } }`

`cb(err, {data { data, metadata, brOptions, lendingInfo, metadata}}` (the bookreader API format)


##### fetch_bookreader = function(opts={}, cb) {
Fetch the bookreader data for this item if it hasn't already been. 
A more flexible version than dweb-archive.ArchiveItem.
Monkey patched into dweb-archive.ArchiveItem so that it runs anywhere that dweb-archive attempts to fetch_bookreader

```
Alternatives:
    skipCache:          load from net
    cached:             return from cache
    !cached:            Load from net, save to cache
    
    cb(err, this) or if undefined, returns a promise resolving to 'this'
    Errors              TransportError (404)
```
Result is `ai.bookreader` set to `{ brOptions, data, lendingInfo}`


#### fetch_page ({wantStream, reqUrl, zip, file, scale rotate, page}, cb)

Fetch a page from the item, caching it
```
reqUrl  Can override automatically generated URL, this is typically for cover pages etc
OR
page    (int) page number within file

zip     path to file from which to extract page, as returned by bookreader API - 4th segment is the filename
file    The name of the file within the zip
scale   float sppecifying scale wanted  (high numbers are smaller) 
rotate  rotation wanted (int)
cb(err, data || stream) returns either data, or if wantStream then a stream
```

For file location is see `MirrorFS.checkWhereValidFileRotatedScaled`

##### fetch_metadata({noCache, noStore, skipNet ....}, cb)

Fetch the metadata for this item if it hasn't already been.

A more flexible version than dweb-archive.ArchiveItem.fetch_metadata,
which is monkey patched into dweb-archive.ArchiveItem so that it runs anywhere that dweb-archive attempts to fetch_metadata
```
Alternatives:
    DEPRECATED skipCache:          dont load from cache (only net)
    noCache:            skip cache on reading, but write to it
    noStore:            skip cache on writing, but read from it
    skipNet             dont load from net (only cache)
    if cached:          return from cache
    if !cached:         Load from net, save to cache

Other opts are passed to dweb-archivecontroller.ArchiveItem.fetch_metadata
cb(err, this)       (optional - returns promise if undefined)
Errors              TransportError (404)
```

###### fetch_query (opts={}, cb)

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

##### saveThumbnail({skipFetchFile=false, wantStream=false} = {}, cb)

Save a thumbnail to the cache,
```
cb(err, this)||cb(err, stream)  Callback on completion with self (mirroring), or on starting with stream (browser)
```

##### fetch_playlist({wantStream}, cb) 

Save the related items to the cache
cb(err, stream || [{...}*])

##### relatedItems({wantStream, wantMembers}, cb)
Extend ArchiveItem.relatedItems, saves related items to the cache and returns either members or a stream
```
cb(err, obj)  Callback on completion with related items object or stream
```

##### addCrawlInfo({config}, cb)

Extract crawl information from config, and apply to item.

```
config  MirrorConfig object

Result: item.crawl is set to result of MirrorConfig.crawlInfo
```

##### isDownloaded({level}, cb)

Result is true if the Item is downloaded to the level specified, 
for now only level=detail is supported.

## ArchiveMember


##### static read({identifier = undefined}, cb)
Read member info for an item
```
identifier: Where to look - can be a real identifier or pseudo-one for a saved search
cb(err, data structure from file)
```
##### read({}, cb)
Read member info for an item from the cache.
```
cb(err, data structure from file)
```


##### addCrawlInfo({config}, cb)
```
config  MirrorConfig object
this.crawl = result of config.crawlInfo
```

##### static addCrawlInfo([ArchiveMember*], {config}, cb) 

Apply addCrawlInfo to each member

##### static addCrawlInfoRelated([rels], {config}, cb) 

Set .crawl field of each object in array returned by RelatedInfo API

```
rels    { hits: { hits: [ _source: { same fields as ArchiveMember } ] } }
cb(err)
```

##### save(opts = {}, cb)

Save a member (fields from the `savedkeys` list) as a `<IDENTIFIER>_member.json` file
```
cb(err, this)
```

##### saveThumbnail({skipFetchFile=false, wantStream=false} = {}, cb)
Save a thumbnail to the cache, note must be called after fetch_metadata
```
wantStream      true if want stream instead of ArchiveItem returned
skipFetchFile   true if should skip net retrieval - used for debugging
resolve or cb(err, res)  this on completion or stream on opening
```

# Other classes

## HashStore
A generic hashstore, table/key/value triples.

Note this is similar to that in dweb-gateway but its usage does a different mapping for data stored.

There is one of thee at the top directory of each cache directory. 

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

##### new Hashstore(config)
Save configuration (see `properties`)

##### put(table, key, val, cb(err, unused))
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

##### keys(table, cb)
Returns an array of keys via promise or cb(err, [key*])

## classes MirrorConfig and ConfigController

A generic, reusable config controller, and one specific to dweb-mirror.

##### properties
```
```

##### parameters of all methods
```
```

### Class ConfigController

##### new ConfigController(...config)
Create a new config structure from one or more config objects. 

The fields in later arguments (at the root, or nested levels) over-write the previous ones.

See config file for structure of config

##### static initializeUserConfigFile(userConfigFile, defaultUserConfig, cb)

```
userConfigFile  Path (can be relative) to user config file, that may not exist
defaultUserConfig   Initial configuration to set the file to if it does not exist
cb(err, { config } )
```

##### new(filenames, cb)

```
filenames   optional ordered array of paths to possible config files (they may be missing), ~/ ./ * etc are expanded (I'm not sure about ../)
cb(err, config) Called with an instance of MirrorConfig
```
Create a new config by reading YAML from filenames in order, (later overriding earlier) 

Requires MirrorConfig to implement initializeUserConfig the results of which override that in the filenames

##### resolve(filename) 

Return a resolved filename, expanding ./ ~/ and possibly ../

##### resolves([filename])

Return an array of resolved filenames, this can also expand `*` etc

##### firstExisting([filename])

Returns the first resolved filename from the array that exists (used to search for valid directories)

##### setopts(...config)
Set some fields of configuration from passed object,
it expands paths such as ~/foo and ./foo where appropriate.

Note this currently overwrites anything at the path, but may be modified to use ObjectDeeperassign in future. 

##### static readYamlSync(filename)

Read an return YAML from filename

Throws errors on failure to read, or failure to parse.

##### static readYaml(filename, cb)

Read YAML from filename and return via cb(err, res), 
or return error if unable to read or parse.

##### userConfig() 
Return the last configuration file

##### writeUserFile(filename, cb)

Write user configuration to filename

##### setAndWriteUserFile(filename, obj, cb)

Set local configuration in ConfigManager and write to user file

##### writeYaml(filename, obj, cb)

Write yaml version of an object to a file

### Class MirrorConfig 

Subclass of ConfigController that knows about dweb-mirror

##### defaultUserConfig

Default configuration for user file

##### initializeUserConfig(cb)

Return user configuration, initializing if required.

##### new(filenames, cb) 

```
filenames   Optional list of filenames for configation otherwies uses defaultConfigFiles
```

##### setAndWriteUser(obj, cb)
 
Set the configuration in the ConfigManager, and write to user file

##### writeUser(cb)

Write user configuration to file

##### deleteUserTask(identifier, level, cb)
Remove task for identifier (handles multi-identifier tasks correctly)

##### writeUserTaskLevel(identifier, level, cb)

Update, or create a new task for an identifier (handles multi-identifier tasks correctly)

##### findTask(identifier)

Find and return task form config

##### crawlInfo(identifier, mediatype=undefined);
 
Check if member being crawled and return info suitable for adding into ArchiveMember and usable by the UI


## CrawlManager, CrawlFile

A set of related classes for managing crawling

### configuration
The crawl is initialized from a data-structure, or indirectly from JSON syntax is:
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
  { identifier: "prelinger", level: "details", search: [      // Fetch details for prelinger
        { sort: "-downloads", rows: 100, level: "details" }   // Query first 100 items and get their details
        { sort: "-downloads", rows: 200, level: "tile" } ] }  // and next 200 items and get their thumbnails only
  ]
```

### class CrawlManager
Currently (may change) one instance only - that has parameterisation for crawls.

##### Attributes
```
CrawlManager.crawls Array of CrawlManagers for each crawl run so far since startup (TODO will start culling), each of which has following attributes:

_levels         ["tile", "metadata", "details", "all"]  Allowable task levels, in order.
_uniqItems      { identifier: [ task* ] } Dictionary of tasks carried out per item, used for checking uniqueness and avoiding loops (identifier also has pseudo-identifiers like _SEARCH_123abc
_uniqItems      { identifier: [ task* ] } Dictionary of tasks carried out per file, used for checking uniqueness and avoiding loops
errors          [{task, error}] Array of errors encountered to report on at the end.
completed       Count of tasks completed (for reporting)
pushedCount     Count of tasks pushed onto the queue, usd for checking against limitTotalTasks
_taskQ          (async queue) of tasks to run (from async package)
defaultDetailsSearch    Default search to perform as part of "details" or "full" (usually sufficient to paint tiles)
defaultDetailsRelated   Default crawl on related items when doing "details" or "full" (usually sufficient to paint tiles)
copyDirectory   If set, the crawl will make a full copy here, for example on a USB drive
debugidentifier Will be set to a global variable to help conditional debugging
skipCache       If true will ignore the cache, this is useful to make sure hits server to ensure it precaches/pushes to IPFS etc
skipFetchFile   If true will just comment on file, not actually fetch it (including thumbnails)
maxFileSize     (int) If set, constrains maximum size of any one file
concurrency     (int) Sets the number of tasks that can be processed at a time
limitTotalTasks (int) If set, limits the total number of tasks that can be handled in a crawl, this is approx the number of items plus number of files
```
#### new CrawlManager({copyDirectory, debugidentifier, skipFetchFile, skipCache, maxFileSize, concurrency=1, limitTotalTasks, defaultDetailsSearch, defaultDetailsRelated} = {})

See attributes for meaning of arguments.

Create and initialize a CrawlManager instance.

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
returns array from concatenating debugname to parent array.

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
True if have not already tried this file on this crawl.

### class CrawlItem extends Crawlable
#### Attributes
```
identifier  Archive Identifier
identifier, level, query, search, related:  see config
member      Pointer to ArchiveMember if known
```
#### static fromSearchMember(member, taskparms, parent, crawlmanager)

Create a new CrawlItem and queue it, handles different kinds of members, including saved searches

#### isUniq()
True if the item has not been crawled this time at a greater or equal depth.

#### process(cb)

Process a task to crawl an item, complexity depends on its `.level` but can include fetch_metadata, fetch_query, saveThumbnail, crawling some or all of .files and relatedItems.



## MirrorFS

All the methods of MirrorFS are static, and it exists to encapsulate knowledge about the cache in one place. 

#### common parameters
```
algorithm:  Hash algorithm to be used, defaults to 'sha1' and only tested on that
cacheDirectory: Same as directory
debugname:  Name to use in debug statements to help see which file/item it refers to.
digest      Digest (hash) of file to find 
directory:  Absolute path to directory where cache stored, may include symlinks, but not Mac Aliases
directories: Array of directories to check for caches
expectsize: If defined, the result must match this size or will be rejected (it comes from metadata)
file:       Name of file
filepath:   Absolute path to file, normally must be in "directory"
format:     Format of result or submitted digest, defaults to 'hex', alternative is 'multihash58'
httpServer: Server to use for http (for seeding)
noCache:    If true will skip reading cache, but will write back to it and not trash it if unable to read file
preferredStreamTransports:  Array of transport names to use in order of preference for streaming
relFileDir  Path to directory, typically IDENTIFIER
relFilePath A path relative to any of the directories, typically IDENTIFIER/FILENAME
scale       Factor to scale down an image
sha1:           If defined, the result must match this sha1 or will be rejected (it comes from metadata)
rotate      Factor to rotate an image
skipFetchFile:  If true, then dont actually fetch the file (used for debugging)
skipCache:  if set then do not check cache for results
skipNet:    if set then do not try and fetch from the net
url:        Single url (or in most cases array of urls) to retrieve
wantBuff:   True if want a buffer of data (not stream)
wantStream  The caller wants a stream as the result (the alternative is an object with the results)
start       The first byte or result to return (default to start of file/result)
end         The last byte or result to return (default to end of file/result)
```

Also see [https://nodejs.org/api/fs.html] for documentation of underlying fs.xyz where referred to below

##### static init(directories, httpServer, preferredStreamTransports)

Initialize MirrorFS, should be called before using any other function to tell MirrorFS where to find things
and how to get things.

##### setCopyDirectory(dir)

Override copy directory for MirrorFS.
Once set, operations will cause a copy from cache or net to this directory.

##### _mkdir(path, cb) 

Recursively create a directory, it is not an error if it exists already.
```
path    File path to directory
cb(err) Callback with error if applicable. 
```
##### rmdir(path, cb)

Recursively remove a directory (using `rm -r` at the OS level)

#### static writeFile(relFilePath, data, cb)
Like fs.writeFile but will mkdir the directory in copyDirectory or first configured before writing the file
```
data    Anything that fs.writeFile accepts
cb(err)
```

#### static quickhash(str, options={})
Synchronous calculation of hash
```
str     string to get the hash of
options { algorithm, format }
```

##### static readFile(relFilePath, cb) 

Look for a path in one of the directories, and return (via fs.readFile)

##### writeFile(relFilePath, data, cb)

Look for a path in one of the directories, create parent directory if required, 
and write it (via fs.writeFile)

##### checkWhereValidFileRotatedScaled({relFileDir, file, scale, rotate}, cb)

Look for appropriate cached file such as RELFILEDIR/scale2/rotate4/FILE and return its path if found.

#### static checkWhereValidFile(relFilePath, {digest=undefined, format=undefined, algorithm=undefined}, cb)
Checks if file or digest exists in one of the cache Directories.
```
Note - either relFilePath or digest/format/algorithm can be omitted, 
If relFilePath && !digest it just checks the cache directories
If digest && !relFilePath it will try and locate file in hashstores
if relPath && digest the hash will be recalculated and checked.

cb(err, filepath)
```
    
##### static cacheAndOrStream({relFilePath, existingFilePath, debugname, urls, expectsize, sha1, ipfs, skipFetchFile, wantStream, wantBuff, noCache, start, end}, cb)

Complicated function to encapsulate in one place the logic around the cache.
```
cb(err, s|undefined) if wantStream will call with a stream (see below)
```
TypicalUsages:
* in mirroring    wantStream, start,end undefined
* in browsing     wantStream=true, start & end may be set or be set to 0,undefined.

cb behavior needs explanation !
* If wantStream, then cb will call back as soon as a stream is ready from the net
* If !wantStream, then cb will only call back (with undefined) when the file has been written to disk and the file renamed.
* In particular this means that wantStream will not see a callback if one of the errors occurs after the stream is opened.


##### static maintenance({cacheDirectories = undefined, algorithm = 'sha1', ipfs = true}, cb)
Perform maintenance on the system. 
Clear out old hashes and load all the hashes in cacheDirectories or config.directories into hashstores table='<algorithm>.filepath'.
Make sure all applicable files are in IPFS. 
Delete any .part files (typically these come from a server crash while something is partially streamed in)

##### seed({directory, relFilePath, ipfs}, cb)

Passes args to `DwebTransports.seed` which - depending on transports, 
* WEBTORRENT: seed an entire directory to WebTorrent, 
* IPFS seed just the file, check the ipfs hash if supplied.

#### isSpecialFile(relFilePath) 

True if its one of the files used by ArchiveItem, ArchiveFile, ArchiveMember that shouldnt be seeded. 

# Applications

## collectionpreseed.js
A special case of crawl that causes the upstream server to pre-cache Tile images for most popular or top two levels of collections below `image`, `movies`, `texts`, `audio` 

Usage: `$> cd /path/to/install/dweb-mirror && ./collectionpreseed.js`

## crawl
General purpose crawler for the Archive. 
`crawl -h` for up to date arguments. 
```
usage: crawl [-hv] [-l level] [-r rows] [ -d depth ] [--directory path] [--search json] [--related json]
    [--debugidentifier identifier] [--maxFileSize bytes] [--concurrency threads] [--limittotaltasks tasks] [--transport TRANSPORT]*
    [--skipfetchfile] [--skipcache] [--dummy] [identifier]*

    h : help print this text
    v : verbose tell us which config being run (default is currently pretty verbose)
    q : quiet (TODO implement this)
    l level : Crawl the identifiers to a certain level, valid values are:
                "tile"    for just enough to print a collection page, including the thumbnail image
                "metadata" and the full metadata, which will be useful once local search is implemented
                "details"  and enough to paint a page, including for example a lower bandwidth video
                "full"     and all the files in the item - beware, this can get very big.
    r rows           : overrides any (simple) search string to crawl this number of items
    d depth          : crawl collections found in this collection to a depth,
                       (0 is none, dont even crawl this collection, 1 is normal, 2 is collections in this collection
    --directory path : override the directory set in the configuration for the root of the cache
    --search json    : override default search string, strict json syntax only
    --related json   : override default settign for crawling related items, strict json syntax only
    --debugidentifier identifier : identifier to do extra debugging on, only really valuable when using an IDE
    --maxfilesize bytes : any file bigger than this will be ignored
    --concurrency threads : how many files or searches to be happening concurrently - use 1 for debugging, otherwise 10 is about right
    --limittotaltasks tasks : a maximum number of tasks to run, will be (approximately) the number of searches, plus the number of items crawled.
    --transport TRANSPORT : The names of transport to use, by default its HTTP, but can currenrly add IPFS, WEBTORRENT GUN, (TODO must currently be upper case - allow both)
    --skipfetchfile : Dont actually transfer the files (good for debugging)
    --skipcache     : Ignore current contents of cache and always refetch
    --dummy         : Just print the result of the options in the JSON format used for configuration

   identifier       : Zero or more identifiers to crawl (if none, then it will use the default query from the configuration)
   
   Examples:
    
   internetarchive --crawl prelinger # Gets the default crawl for the prelinger collection, (details on prelinger, then tiles for top 40 items in the collection and 6 related items)
   internetarchive --crawl --level details --rows 100 prelinger   # Would pull the top 100 items in prelinger (just the tiles)
   internetarchive --crawl  --level all commute  # Fetches all the files in the commute item 
   
   Specifying level, or rows more than once will apply that result to the searches, so for example: 
   
   internetarchive --crawl  --level details --rows 10 --level details prelinger # Gets the movies for the first 10 movies in prelinger
   internetarchive --crawl  --level details --rows 100 --level tiles --rows 100 --level tiles movies # Gets the top 100 items in movies, and then crawls any of those items that are collections 
   internetarchive --crawl  --rows 100 --depth 2 movies # Is a shortcut to do the same thing
   
    Running internetarchive --crawl  with no options will run the default crawls in the configuration file with no modifications, which is good for example if running under cron.
```
A useful hint is to experiment with arguments, but add the `--dummy` argument to output a JSON description of the search task(s) to be carried out.

# Installation files

The following files are present in `dweb-mirror` but, as of v0.1.0 are still a work in progress and not yet defined and will probably change a lot. 

* Dockerfile - create  docker file of dweb-mirror (untested, probably doesnt work yet)
* Dockerfile_ipfs - create a docker file for an IPFS instance - to go with the above Dockerfile (untested, probably doesnt work yet)
* install.sh  - run during `npm install` or after `npm update` by `npm run update` - makes some links based on which other repos are installed. 
* install_rachel.sh - variant of install.sh being built for Rachel platform (only partially complete)
* run_dockers.sh - ???

# Other files

The following files are present in `dweb-mirror` but are still a work in progress and not yet defined and will probably change a lot. 

* [LICENCE] - GNU Alfredo licence
* [INSTALLATION.md]
* [README.md] - main documentation
* [RELEASENOTES.md] - history of releases
* test.js - used to run test code against specific problems, not specified.
* [URL_MAPPING.md] - how universal urls flow through the different mappings in mirrorHttp and elsewhere.


