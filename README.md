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

Dweb-mirror is intended to make the Internet Archive experience and UI available offline. 

It consists of three parts
* A crawler that can fetch a configurable list of content from the Internet Archive to local storage which can be sneaker-net to any location.
* An http server that (once completed) can server this content completely offline
* A proxy that can browse the Internet Archive saving content for future offline use.
* A javascript based UI to the Internet Archive that can work offline (this is the related [dweb-archive](https://github.org/internetarchive/dweb-archive) repo

It currently runs and is supported on four platforms though smarter integration is ongoing.
* MacOSX - for development
* Rachel 3+/World-Possible box (internal storage, battery, WiFi router)
* Raspberry Pi 3+ starting with the NOOBS that usually comes in the box.
* Raspberry Pi 3+ running IIAB. 

We don't expect problems porting to other Linux based environments, the biggest challenge is usually getting an up-to-date version of Node to run.

In addition the system can seed into IPFS and will be adding seeding to GUN, WEBTORRENT and WOLK soon.

This is an ongoing project, continually adding support for new Internet Archive content types; new platforms; and new decentralized transports.

## Installation
 
At the moment this is one set for developing, or use, later I'll split it when its more stable.

Please check for a platform specific README (for Rachel or RaspberryPi with NOOBS or Internet In A Box) as these instructions dont work for some of the smaller platforms.

### 1. Prelim - getting your machine ready.
* You'll need git, node, npm, which should be on most Linux machines.

#### Mac OSX
* TODO Mac specific instructions to add these (need a clean machine to test on)

#### Rachel 3+ (32 bit intel box from World Possible)
This is complex, the OS with the box is seriously out of date, see README-rachel.md

#### Raspberry Pi 3 with or without Internet In A Box (IIAB)
This is complex, see [README-raspberrypi.md] then come back here to finish

#### Anything else
* This is only tested on current versions, so I recommend updating before installing.
  * Node: open `https://nodejs.org` in the browser.  It should auto-detect your machine, and get the "recommended" version.
  * Npm: # sudo npm install npm@latest -g
  * Git: Try `git --version` and if its not installed or lower than v2.0.0 then See [Atlassian Tutorial](https://www.atlassian.com/git/tutorials/install-git)

### 3. Install dweb-mirror

There are two alternatives, depending on whether you will develop on this machine or not. 

#### 3a. EITHER dweb-mirror as a server / appliance (tested on Rachel 3+ and RPi3)

We will install it as a standard node_module

Create a top level cache directory,

```
sudo mkdir -p "/.data/archiveorg" && sudo chown ${USER} /.data/archiveorg
```
Its in configDefaults.yaml to check at this address. You can put this somewhere else, but if so you'll need to change it during the "Edit Configuration" step

# Now create a package.json that points at dweb-mirror
```
cd /usr/local  # Various other places didn't work on Rachel, but in theory it should work anywhere.
sudo curl -opackage.json https://raw.githubusercontent.com/internetarchive/dweb-mirror/master/package-appliance.json
```

The following yarn install might or might not have been needed TODO-RACHEL-CLEAN try without this on clean machine
```
sudo yarn add node-pre-gyp cmake
```
Now install dweb-mirror, otherwise:
```
sudo yarn install
# If it fails, then running it again is safe.
```
The example above would install dweb-mirror as `/usr/local/node_modules/@internetarchive/dweb-mirror`
which is refered to as `<wherever>/dweb-mirror` in the rest of this README

Now skip to step 4

#### 3b. OR dweb-mirror for development (tested on Mac OSX)


##### 3b1 Install any other dweb repos you plan on developing on

Before installing dweb-mirror for development install any other repos you'll be developing on,
so that the install process can find them instead of using versions from npm.

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

##### 3b2 Install dweb-mirror from GIT

From a command line:

* cd <directory where you want to put dweb-mirror> #  Wherever you want to put dweb-mirror, its not fussy, I tend to use ~/git and you might see that assumption in some examples.
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


### 4. Edit configuration

```
cd <wherever you installed dweb-mirror>/dweb-mirror
# By default this is /usr/local/node_modules/@internetarchive/dweb-mirror or /usr/local/git/dweb-mirror
# depending on whether you did 3a or 3b above.
cp ./dweb-mirror.config.yaml ${HOME} # Copy sample to your home directory and edit, 
```
and edit `$HOME/dweb-mirror.config.yaml` for now see `configDefaults.yaml` for inline documentation.

  * `directories` if you plan on using places other than any of those in dweb-mirror.config.yaml (/.data/archiveorg, and any USBs on Rachel3+, NOOBS or IIAB
  * `archiveui/directories` you probably dont need to change this as it will usually guess right, but it points to the “dist” subdirectory of wherever dweb-archive is either cloned or installed by npm install.
  * `apps.crawl` includes a structure that lists what collections are to be installed, I suggest testing and then editing

   
Note that directories specified in the config file can be written using with shell / unix conventions such as "~/" or "../".

### 5. Test browsing

* From a command line:
* `cd <wherever>/dweb-mirror && ./mirrorHttp.js &` # starts the HTTP server
  * the startup is a little slow but you'll see some debugging when its live.
* If you are working directly on the machine (e.g. its your Mac) then
  * `open http://localhost:4244` will open the UI in the browser and it should see the Archive UI.
* If you are ssh-ed into the machine then in your browser go to: `http://<IP of machine>:4244`
* open [http://localhost:4244/arc/archive.org/details/prelinger?transport=HTTP&mirror=localhost:4244] to see the test crawl if you did not change 
If you don’t get a Archive UI then look at the server log (in console) to see for any “FAILING” log lines which indicate a problem

Expect to see errors in the Browser log for 
* http://localhost:5001/api/v0/version?stream-channels=true  - which is checking for a local IPFS server

Expect, on slower machines, to see no images the first time, refresh after a little while and most should appear. 

### 6. Test crawling

* cd <wherever>/dweb-mirror
* ./crawl.js

Without arguments, crawl will read a set of files into into the first (already existing) directory configured in `~/dweb-mirror.config.yaml` or if there are 
none there, in `<wherever>/dweb-mirror/configDefaults.yaml`. 

Look in that directory, and there should be sub-directories appearing for each item, with metadata and/or thumbnails.

You can safely delete any of the crawled material and it will be re-fetched if needed.

### 7. IPFS (optional)
Install IPFS, there are several strategies in install_ipfs.sh that cover machines tested already,
but it might need editing for other odd combinations.
```
cd <wherever>/dweb-mirror
./install_ipfs.sh
```
If running on Rachel3+ then its admin tool uses the default GATEWAY_PORT so
edit /usr/local/bin/start_ipfs and change GATEWAY_PORT to 8081

Now start the daemon, first time it initializes and configures a repo
```
start_ipfs daemon  & 
```
If it complains that 8080 is in use, then you missed editing start_ipfs and can fix this with 
```
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8081
start_ipfs daemon &
```
Allow ipfs to start, once it says Daemon is ready, Ctrl-C out of it

##### Updating IPFS
```
cd <wherever>/dweb-mirror && ./install_ipfs.sh
```
should update it.

## Updating dweb-mirror 
The update process depends on whether you took choice "a" (appliance) or "b" (developer) above.

### a) Appliance
```
cd /usr/local   # or wherever you started the process in 3a above.
yarn upgrade    # Upgrade all packages
```

### b) Developer
* cd <wherever>/dweb-mirror
* git pull      # Unfortunately this step can muck with your config file, so make sure to save, or look if you get merge errors.
* npm update
* npm run update # Note there is an intentional feature/bug, in npm in that it that doesnt automatically run an "update" script. 

## Classes
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

## Key Notes
#### Crawling via Dweb
The crawler is transport agnostic, it will as happily crawl the collection via IPFS as via HTTP, and does this transparently 
via the dweb-archive > dweb-objects > dweb-transport libraries. 
Ideally - though not initially - this could work in a scenario where access to IA is blocked. 

#### Local storage
All the data is stored locally, once (except metadata etc), 
this means it will use IPFS, Webtorrent etc via shims that allow them to serve files without replicating them which would use too much disk

## Related links etc
### Builds upon
* [dweb-transport](https://github.com/internetarchive/dweb-transport) - Transport independent library
* [dweb-objects](https://github.com/internetarchive/dweb-objects) - Object library, not heavily used (yet)
* [dweb-archivecontroller](https://github.com/internetarchive/dweb-archivecontroller) - knows about Archive structures (like Files & Items)
* [dweb-archive](https://github.com/internetarchive/dweb-archive) - javascript based UI

### See also
* [Dweb document index](https://github.com/internetarchive/dweb-transports/blob/master/DOCUMENTINDEX.md) for a list of the repos that make up the Internet Archive's Dweb project, and an index of other documents. Many of which are out of date! 
* [API.md](./API.md) API documentation for dweb-mirror
 