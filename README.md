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

## What is it
### Overall design

* A process that crawls IA items & collection, and writes files & metadata to a local cache, its uses a multithreaded task queue.
* An HTTP server that runs against the local cache and can either be a proxy, or fully offline.
* A Javascript based UI (the same as https://dweb.archive.org) 
* TODO Installers to run on a variety of the platforms that are used in contexts with poor internet
* TODO: A control UI that edits a configuration file (local or virtual) - very basic
* TODO A set of tools that add mirrored material from disk, or incrementally on crawling, to transports including: IPFS, WebTorrent, GUN ...
* TODO An API to allow extension and adaptation
* TODO Some test harness to check it.

## Installation
 
At the moment this is one set for developing, or use, later I'll split it when its more stable.

#### 1. Prelim - getting your machine ready.
* You'll need git, node, npm, which should be on most Linux machines.
* TODO Mac specific instructions to add these (need a clean machine to test on)
* This is only tested on current versions, so I recommend updating before installing.
  * Node: `https://nodejs.org` It should auto-detect your machine, and get the "recommended" version.
  * Npm: # sudo npm install npm@latest -g
  * Git: Try `git --version` and if its not installed or lower than v2.0.0 then See [Atlassian Tutorial](https://www.atlassian.com/git/tutorials/install-git)


#### 2. Install any other dweb repos you plan on developing on

If you don't plan on developing on dweb-archive, dweb-archivecontroller, dweb-objects, or dweb-transports you can skip this step.

For example to develop on dweb-archive:

From a command line:

* cd /path/to/install #  # Wherever you want to put dweb-mirror, its not fussy, I tend to use ~/git and you might see that assumption in some examples.
* `git clone “https://github.com/internetarchive/dweb-archive”`
* `cd dweb-archive`
* `npm install` # Expect this to take a while and generate error messages. 
* `cd ..`       # Back to /path/to/install

Repeat for any of dweb-archive, dweb-archivecontroller, dweb-objects, or dweb-transports if you plan on developing on them.

Please check current versions of README.md in those packages, as they may have changed.

You can come back and do this again later, but will need to rerun `cd /path/to/install/dweb-mirror; npm install` so that it recognizes the dev versions.

#### 3. Install dweb-mirror

From a command line:

* cd /path/to/install #  # Wherever you want to put dweb-mirror, its not fussy, I tend to use ~/git and you might see that assumption in some examples.
* `git clone "https://github.com/internetarchive/dweb-mirror"`
* `cd dweb-mirror`
* `npm install` # Expect this to take a while and generate error messages. 
   * On MacOS Mojave you'll need to sudo mkdir ~/.npm; sudo chown <YOUR USER NAME> ~/.npm
   If you see an issue with EACCESS on ~/.npm you'll need to create that directory possible via sudo
   If npm finishes with a recommendation to update then follow them
* `npm install` # Second time will help understand if error messages are significant
* `cd ..`

(Note: `npm install` will run the script install.sh which can be safely run multiple times.)

It will add links to Javascript webpack-ed bundles into the dist directory, 
from the git cloned repos such as dweb-archive etc if you chose to install them above, 
otherwise to those automatically brought in by `npm install`


TODO Later versions will do other tasks like configuring IPFS

#### 4. Edit configuration
TODO EDIT AND TEST FROM HERE DOWN

* Copy `dweb-mirror/dweb-mirror.config.yaml` to your home directory and edit, 
for now see `configDefaults.yaml` for inline documentation.

  * `directories`  should point at places you want the cache to store and look for files - at least one of these should exist
  * `archiveui/directories` you probably dont need to change this as it will usually guess right, but it points to the “dist” subdirectory of wherever dweb-archive is either cloned or installed by npm install.
  * `apps.crawl` includes a structure that lists what collections are to be installed, I suggest testing and then editing

   
Note that directories specified in the config file can be written using with shell / unix conventions such as "~/" or "../".

#### 5. Test crawling

* cd /path/to/install/dweb-mirror
* ./crawl.js

Look in the location configured in `configDefaults.yaml` or `~/dweb-mirror.config.yaml` ... directory` and there should 
be directories appearing for each item, with metadata and/or thumbnails.

You can safely delete any of the crawled material and it will be re-fetched if needed.

#### 6. Test browsing

* From a command line:
* `cd dweb-mirror && ./mirrorHttp.js &` # starts the HTTP server
  * the startup is a little slow but you'll see some debugging when its live.
* `open http://localhost:4244` will open the UI in the browser and it should see the Archive UI.
* open [http://localhost:4244/arc/archive.org/details/prelinger?transport=HTTP&mirror=localhost:4244] to see the test crawl if you didn't change 
If you don’t get a Archive UI then look at the server log (in console) to see for any “FAILING” log lines which indicate a problem

Expect to see errors in the Browser log for 
* http://localhost:5001/api/v0/version?stream-channels=true  - which is checking for a local IPFS server

#### Updating
To update:
* cd /path/to/install/dweb-mirror
* git pull      # Unfortunately this step can muck with your config file, so make sure to save, or look if you get merge errors.
* npm update
* npm run update # Note there is an intentional feature/bug, in npm in that it that doesnt automatically run an "update" script. 

### Classes
Rough idea, might not be like this

class|status|notes
-----|-----|---
Errors|Incrementally editing|Definitions of Error classes
HashStore|Working|Generic store on top of "level", could equally well be on top of Redis.
MirrorFS|Stub|Wraps the local disk in an API
MirrorUIconfig|Stub|User Interface to configuration and actions
MirrorUIviewer|needs stub|User Interface to view collections - based on, or using, archive.html in dweb-archive
Mirror|Stub|One class to rule them all

#### Actual class hierarchy as built so far ...

* collectionpressed.js and mirrored.js: applications using this
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
this means it will use IPFS, Webtorrent etc via shims that allow them to serve files without replicating them which would use too much disk

## Builds upon
* [dweb-transport](https://github.com/internetarchive/dweb-transport) - Transport independent library
* [dweb-objects](https://github.com/internetarchive/dweb-objects) - Object library, not heavily used (yet)
* [dweb-archivecontroller](https://github.com/internetarchive/dweb-archivecontroller) - knows about Archive structures (like Files & Items)
* [dweb-archive](https://github.com/internetarchive/dweb-archive) - javascript based UI

## See also
* [Dweb document index](https://github.com/internetarchive/dweb-transports/blob/master/DOCUMENTINDEX.md) for a list of the repos that make up the Internet Archive's Dweb project, and an index of other documents. Many of which are out of date! 
* [API.md](./API.md) API documentation for dweb-mirror
 