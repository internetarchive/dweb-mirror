# Internet Archive - Mirror project

Lives on github at:
[dweb-mirror](https://github.com/internetarchive/dweb-mirror);
[source](https://github.com/internetarchive/dweb-mirror);
[issues](https://github.com/internetarchive/dweb-mirror/issues);

This project is part of our larger Dweb project, see also: 
[dweb-universal](https://github.com/internetarchive/dweb-universal);
[dweb-transport](https://github.com/internetarchive/dweb-transport);
[dweb-objects](https://github.com/internetarchive/dweb-objects);
[dweb-archive](https://github.com/internetarchive/dweb-archive);


Its goal is to allow people to mirror one or more collections (or individual items) 
to their own disks, and then to serve them up via dweb tools such as IPFS or WebTorrent.

## Installation
 
At the moment this is one set for developing, or use, later I'll split it when its more stable.

#### Prelim - getting your machine ready.
* You'll need git, node, npm, which should be on most Linux machines.
* TODO Mac specific instructions to add these (need a clean machine to test on)
* This is only tested on current versions, so I recommend updating before installing.
  * Node: `https://nodejs.org` It should auto-detect your machine, and get the "recommended" version.
  * Npm: # sudo npm install npm@latest -g
  * Git: Try `git --version` and if its not installed then See [Atlassian Tutorial](https://www.atlassian.com/git/tutorials/install-git)

#### Install dweb-mirror
* From a command line:
* `cd /path/to/install' # Wherever you want to put dweb-mirror, its not fussy, I tend to use ~/git and you might see that assumption in some examples.
* `git clone “https://github.com/internetarchive/dweb-mirror”`
* `cd dweb-mirror`
* `npm install` # Expect this to take a while and generate error messages. 
* `npm install` # Second time will help understand if error messages are significant
* `cd ..`
* `git clone “https://github.com/internetarchive/dweb-archive”`
* `cd dweb-archive`
* `npm install`

TODO installer should check for presence of other repos


* Check you have the desired links for bundles in dweb-archive/dist
  * Either `cd dweb-archive && ln -s ./node_modules/@internetarchive/dweb-objects/dist/dweb-objects-bundle.js dist`
  * OR if you plan on developing on dweb-objects install it and `ln -s ../dweb-objects/dist/dweb-objects-bundle.js dist` 
  * Same for dweb-transports 
* Edit dweb-mirror/config.js … **this location may change**
  * `config.js/directory`  should point at where you want the cache to store files 
    * Make sure this directory exists - TODO-MIRROR make it fail informatively if it doesn’t 
  * `config.js/archiveui/directory` should point at “dist” subdirectory of wherever dweb-archive is cloned.
    * collections should be a dictionary of collections to download,  collections: `{ “fav-yourusername”: {} }` is a good simple example

## Testing
Check mirroring with `cd dweb-mirror && node ./mirroring.js` then check in the cache directory

* Run `cd dweb-mirror && node ./mirrorHttp.js &` to start the HTTP server
* open `http://localhost:4244/arc/archive.org` in the browser should see the Archive URL
If you don’t get a Archive UI then look at the server log (in console) to see for any “FAILING” log lines which indicate a problem

Expect to see errors in the Browser log for 
* http://localhost:5001/api/v0/version?stream-channels=true  - which is checking for a local IPFS server
* `Source Map URL: jquery-1.10.2.min.map` until we figure out how to build these min.maps 

**TODO-INSTALLATION** - note currently this isn't working, still figuring out if install, or general, bugs

## Overall design

* A process built on a pipeline of streams that crawls a IA collection, and writes it & its metadata to disk 
* A control UI that edits a configuration file (local or virtual) - very basic
* A set of tools that add mirrored material from disk, or incrementally on crawling, to transports including: IPFS, WebTorrent, GUN ...
* An API to allow extension and adaptation
* Some test harness to check it.

### Classes
Rough idea, might not be like this

class|status|notes
-----|-----|---
Errors|Incrementally editing|Definitions of Error classes
HashStore|Working|Generic store on top of "level", could equally well be on top of Redis.
MirrorCollection|Stub|Wraps the remote collection in an API
MirrorFS|Stub|Wraps the local disk in an API
MirrorUIconfig|Stub|User Interface to configuration and actions
MirrorUIviewer|needs stub|User Interface to view collections - based on, or using, archive.html in dweb-archive
Mirror|Stub|One class to rule them all

#### Actual class hierarchy as built so far ...

* collectionpressed.js and mirrored.js: applications using this
* MirrorSearch - encapsulates an IA Search, keeps track of how many pages read etc
    * MirrorCollection - sets up search queries for a IA Collection, 
* stream.Transform
    * ParallelStream - a transform stream that can run tasks in a configurable parallel manner
    * _MirrorXxxStream - a set of StreamTools to allow array like functions on a stream    
* s - StreamTools task that creates _MirrorXxxStream classes

### Key Notes
#### Crawling via Dweb
The crawler is transport agnostic, it will as happily crawl the collection via IPFS as via HTTP, and does this transparently 
via the dweb-archive > dweb-objects > dweb-transport libraries. 
Ideally - though not initially - this could work in a scenario where access to IA is blocked. 

#### Local storage
All the data is stored locally, once (except metadata etc), 
this means it will use IPFS, Webtorrent etc via shims that allow them to serve files without replicating them.

## Builds upon
* [dweb-transport](https://github.com/internetarchive/dweb-transport) - Transport independent library
* [dweb-objects](https://github.com/internetarchive/dweb-objects) - Object library, not heavily used (yet)
* [dweb-archive#require](https://github.com/internetarchive/dweb-archive#require) - knows about Archive structures (like Files & Items), (this branch uses require instead of import allowing use in node.)
* Transports: js-ipfs, webtorrent, Yjs, gun, others to be added

## API
TODO - write this

## See also
See [Dweb document index](https://github.com/internetarchive/dweb-transports/blob/master/DOCUMENTINDEX.md) for a list of the repos that make up the Internet Archive's Dweb project, and an index of other documents. 



