# Internet Archive - Mirror project

This project is part of our larger Dweb project, see also: 
[dweb-transport](https://github.com/internetarchive/dweb-transport);
[dweb-objects](https://github.com/internetarchive/dweb-objects);
[dweb-archive](https://github.com/internetarchive/dweb-archive);


Its goal is to allow people to mirror one or more collections (or individual items) 
to their own disks, and then to serve them up via dweb tools such as IPFS or WebTorrent.

## Installation
```
git clone https://git@github.com/internetarchive/dweb-mirror.git
cd dweb-transport

# install the dependencies including dweb-transports and dweb-objects
npm install  
```

## Testing
For now (this may change) run `node ./mirroring.js`

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
        * MirrorCollectionSearchStream  MirrorCollection > Arrays of Search Results
    * _MirrorXxxStream - a set of StreamTools to allow array like functions on a stream    
* s - StreamTools task that creates _MirrorXxxStream classes

### Key Notes
#### Crawling via Dweb
The crawler is transport agnostic, it will as happily crawl the collection via IPFS as via HTTP, and does this transparantly 
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

        


