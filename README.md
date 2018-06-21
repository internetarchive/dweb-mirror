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
TODO - write this

        


