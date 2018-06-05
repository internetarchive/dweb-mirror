# Internet Archive - Mirror project

This project is part of our larger Dweb project, see also < TODO >

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

* A set of classes (Errors, HashStore) etc that implement the mirror
* Will be classes for serving; UI; configuration; mirroring; 
* will be hooks to allow serviing via WebTorrent or external app; (which must see the DHT)
* test.js - to test each module (could be moved to a set of unit tests)

### Classes

class|status|notes
-----|-----|---
Errors|Incrementally editing|Definitions of Error classes
HashStore|Working|Generic store on top of "level", could equally well be on top of Redis.
MirrorCollection|Stub|Wraps the remote collection in an API
MirrorFS|Stub|Wraps the local disk in an API
MirrorUIconfig|Stub|User Interface to configuration and actions
MirrorUIviewer|needs stub|User Interface to view collections - based on, or using, archive.html in dweb-archive
Mirror|Stub|One class to rule them all


## API

## TODO
These will move to GIT once this moves to its own repository. 
* Move to own repo... then add these points as issues

* Incremental development ...
    * First target - mirror collection to disk
        * MIFS now passing back a stream of fetched ArchiveItem objects
        * MC pushback when new MIFS stream is full HighWater of 200 is masking it, set it to 3 to make it fail
        * MC stream of AI items -> ItemResolverStream
        * MM - kick off MC
        * MM - pass metadata want to keep to HashStore
        * MM - apply filters at item level
        * MM - apply filters at file level
        * MM - retrieve files
        * MM - pass to FC
        * MF - read stream of files 
        * MF - store to Filesystem


* Collection manager (MC)
    * Manages external collections
* File System manager (MF)
    * Manages <config>/<item>/<file>
    * Manages metadata in level db or json files
* Mirror manager MM
    * Schedules crawls based on configuration
    * For a collection Knows how to retrieve metadata; crawl items; 
* Serve:
    * WebTorrent
        * Integrated or via Aux app
        * Make sure can see DHT
    * IFPS
        * Will probably need unixfs
        * Will probably need add/pin
* WebUI:
    * Configuration
        * Reads and writes a configuration table (In hashstore)
        * Presents a simple UI via a browser
        * Allows editing of collections being mirrored and any parameters
    * Viewing
        * Builds on archive.html - may in fact be integrated there
        
        


