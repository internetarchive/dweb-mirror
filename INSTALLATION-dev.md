# Installation instructions for dweb-mirror development environment

See [README.md] for more info

These documents are for people who want to work on code either for dweb-mirror or dweb-archive.
For non developers see [./INSTALLATION.md](./INSTALLATION.md).

Note these are currently tested on Mac OSX only, I would love someone to test on Linux and submit changes 
on the repo (or just send me a corrected version of this file)


## Automatic Installation

The easiest way to install is to use [./install_dev.sh](./install_dev.sh), the installation script.
If it fails on your platform, it should exit at the failing step, and you can edit it and run it again,
and contribute your improvements.

```
curl -o- -L https://unpkg.com/@internetarchive/dweb-mirror/install_dev.sh | bash
```

## Manual Installation

This will depend on your platform but some hints.

You will need:
* Node version 10 or later
* Yarn version 1.0.0 or later
* Git
* Npm (the one installed by Node should be fine)

(The installer gets all these if missing)

It seems to help package updating etc if you install `node-pre-gyp` and `cmake`
```
sudo yarn add node-pre-gyp cmake
```

You'll need to clone the repositories from Git, 
use `lerna` and `yarn` to install them and then crosslink them.

This is non-trivial to get right which is why we built the installer ! 

1. Clone the repositories
```
mkdir -p ~/git
cd ~/git
git clone https://github.com/internetarchive/dweb-transports
git clone https://github.com/internetarchive/dweb-archivecontroller
git clone https://github.com/futurepress/epubjs-reader
git clone https://github.com/internetarchive/bookreader
git clone https://github.com/internetarchive/dweb-archive
git clone https://github.com/internetarchive/dweb-mirror
git clone --branch mitra--release https://github.com/internetarchive/iaux
```

2. run yarn install
```
yarn --cwd dweb-transports install
yarn --cwd dweb-archivecontroller install
yarn --cwd epubjs-reader install
yarn --cwd bookreader install
yarn --cwd dweb-archive install
yarn --cwd dweb-mirror install
yarn --cwd iaux install
```

3. iaux is a multi-repo and needs lerna run
```
yarn --cwd iaux run lerna bootstrap
yarn --cwd iaux run lerna link
```

4. add each package repository to yarn's links, to make development changes accessible.
   If you already have these packages linked, change the steps appropriately.
```
yarn --cwd dweb-transports link
yarn --cwd dweb-archivecontroller link
yarn --cwd epubjs-reader link
yarn --cwd bookreader link
yarn --cwd iaux/packages/ia-components link
```

5. tell yarn to use the linked development versions
```
yarn --cwd dweb-archive link @internetarchive/dweb-transports
yarn --cwd dweb-archive link epubjs-reader
yarn --cwd dweb-archive link @internetarchive/bookreader
yarn --cwd dweb-archive link @internetarchive/dweb-archivecontroller
yarn --cwd dweb-archive link @internetarchive/ia-components
yarn --cwd dweb-mirror link @internetarchive/dweb-transports
yarn --cwd dweb-mirror link epubjs-reader
yarn --cwd dweb-mirror link @internetarchive/bookreader
yarn --cwd dweb-mirror link @internetarchive/dweb-archivecontroller
```

6. webpack repos to development versions
```
yarn --cwd dweb-transports run webpack --mode development
yarn --cwd dweb-archive run webpack --mode development
yarn --cwd epubjs-reader run grunt
```

7. install http-server
```
yarn global add http-server
```

### 3. Edit configuration

If you are doing anything non-standard, then you'll need to create and edit 
a local configuration file.  Otherwise the application will create it the first time its needed.
```
cd ~/git/dweb-mirror

cp ./dweb-mirror.config.yaml ${HOME} # Copy sample to your home directory and edit, 
```
and edit `$HOME/dweb-mirror.config.yaml` for now see `configDefaults.yaml` for inline documentation.

  * `directories` if you plan on using places other than any of those in dweb-mirror.config.yaml 
  (/.data/archiveorg, and any USBs on Rachel3+, NOOBS or IIAB)
  * `archiveui/directories` you probably do not need to change this as it will usually guess right, 
  but it points to the “dist” subdirectory of wherever dweb-archive is either cloned or installed by npm install.
  * `apps.crawl` includes a structure that lists what collections are to be installed, 
  I suggest testing and then editing
   
Note that directories specified in the config file can be written using shell or unix conventions such as "~/" or "../".

### 4. Test browsing

* From a command line:
```
cd ~/git/dweb-mirror && ./internetarchive --server &
```
* starts the HTTP server
* the startup is a little slow but you'll see some debugging when its live.
* Try going to `http://localhost:4244` 
* Or from another machine: `http://archive.local:4244` or `http://<IP of your machine>:4244`
* open http://localhost:4244/details/prelinger?transport=HTTP&mirror=localhost:4244
to see the test crawl.
If you don’t get a Archive UI then look at the server log (in console) 
to see for any “FAILING” log lines which indicate a problem

Expect to see errors in the Browser log for 
* http://localhost:5001/api/v0/version?stream-channels=true  - which is checking for a local IPFS server

Expect, on slower machines/networks, to see no images the first time, 
refresh after a little while and most should appear.

### 5. Test crawling

```
cd ~/git/dweb-mirror
./internetarchive --crawl
```
Without arguments, crawl will read a set of files into into the first (already existing) directory
configured in `~/dweb-mirror.config.yaml` or if there are none there, in `~/git/dweb-mirror/configDefaults.yaml`. 

Look in that directory, and there should be sub-directories appearing for each item, with metadata and/or thumbnails.

You can safely delete any of the crawled material and it will be re-fetched if needed.

### 6. IPFS (optional)
(Note IPFS is not currently being tested for dweb-mirror and this may not work)

Install IPFS, there are several strategies in install_ipfs.sh that should at least cover your Mac,
but it might need editing if you have an odd combinations.
```
cd ~/git/dweb-mirror
./install_ipfs.sh
```

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

In the future to update IPFS you can ...
```
cd ~/git/dweb-mirror && ./install_ipfs.sh
```
should update it.

### 7. Auto-starting

#### On Mac OSX
TODO - this doesnt appear to work on OSX, and needs investigation

If you want the server to start automatically when the mac boots. 
Run the following commands in a terminal window

Edit `org.archive.mirror.plist` and 
change the line `${HOME}/node_modules/@internetarchive/dweb-mirror/internetarchive`
to `${HOME}/git/dweb-mirror/internetarchive` or wherever you have installed dweb-mirror
to be the path to "internetarchive"
```
sudo cp ~/git/dweb-mirror/org.archive.mirror.plist /Library/LaunchAgents/org.archive.mirror.plist
sudo launchctl load /Library/LaunchAgents/org.archive.mirror.plist
```

Restart your machine and check that http://localhost:4244 still works.

#### On Linux
Some variation of the code in [./install.sh](./install.sh) will be needed, 
this hasn't been tested as for development we always run the server manually in the debugger,

### 8. Making changes
You can make changes in the UI in dweb-archive, iaux/packages/ia-components, bookreader 
or dweb-archive-controller then:
```
cd dweb-archive ; webpack --mode development -w &
```
This will watch for changes so that any edits you make are immediately reflected on either of the servers and testable with a browser page reload

If you make change to dweb-transports:
```
cd dweb-transports ; webpack --mode development -w &
```
If you make changes to dweb-mirror, then ctrl-C out of the server and restart it.
```
cd dweb-mirror ; ./internetarchive -sc &
```


### 9. Running without dweb-mirror  e.g. to develop in dweb-transports

To run without dweb-mirror, 
```
cd ~/git/dweb-archive/dist
http-server
```
This will run a local server that can be accessed at 
```
http://localhost:8080/archive.html 
```
The code will be run from your local server, but will access content at dweb.archive.org

## FUTURE: Updating dweb-mirror for a developer

```
cd ~
git/dweb-mirror/install_dev.sh
```
Should update all the packages from the GIT repo's and re-install, 
and is fairly quick if nothing much has changed.


