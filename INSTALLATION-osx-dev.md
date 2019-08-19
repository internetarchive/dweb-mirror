# Installation instructions for dweb-mirror on IIAB on Raspberry Pi 3

See [README.md] for more info

## Installation
 
### 1. Prelim - getting your machine ready.

You will need git, node, npm, yarn, which may or may not be already installed.

* git: type "git" in a Terminal window, if git is installed you'll get the help message,
if not then it should prompt you to install Xtools command line tools, accept ...
* node and npm: try `node --version`, it should report v10 or better
  * otherwise https://nodejs.org should know its a Mac and prompt you to install, 
  * select the "recommended" version
* yarn: `yarn --version` should report `v1.x.x` 
  * Otherwise: https://yarnpkg.com/en/docs/install should auto-detect and make suggestions. 
  * But, the easiest way is often, at a terminal window: 
```
      curl -o- -L https://yarnpkg.com/install.sh | bash
```

#### node-pre-gyp and cmake
The following yarn install might or might not be needed but seems to speed 
up compiles and updates.
```
sudo yarn add node-pre-gyp cmake
```
If you get an error `wget: No such file or directory` 
then the easiest fix is to install `brew` which is a generally useful package manager.
Follow the one line instructions at https://brew.sh,  which needs you to have Admin access. 

Then run `brew install wget` 

If that fails (as it did for me on an older Mac running OSX10.11 (the last version on Mac Minis)
you can try the instructions at http://osxdaily.com/2012/05/22/install-wget-mac-os-x/
but it works fine to continue without `node-pre-gyp` and `cmake`

### 2. Install dweb-mirror

There are two alternatives, 
* 2A to run as an appliance (recommended)
* 2B to work on the code on this machine or not. 

If you want to install on OSX for development read on, otherwise check ./INSTALLATION-osx.md.

#### dweb-mirror for development

The easiest one line way is to run the installation script 
```
curl -o- -L https://unpkg.com/@internetarchive/dweb-mirror/install_dev.sh | bash
```
by defaults it will install in the git subdirectory of wherever you are running this
you could alternatively download that script and edit the location where you want to install. 

Either way, it will install all the repos that are part of the dweb-mirror system and link them together. 

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
  * `archiveui/directories` you probably dont need to change this as it will usually guess right, 
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
* open http://localhost:4244/arc/archive.org/details/prelinger?transport=HTTP&mirror=localhost:4244
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

### Making changes
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
If you make changes to dweb-objects (which is unlikely, there isn't much there any more:
```
  cd dweb-objects ; webpack --mode development -w &
```

If you make changes to dweb-mirror, then ctrl-C out of the server and restart it.
```
cd dweb-mirror ; ./internetarchive -sc &
```


### Running without dweb-mirror  e.g. to develop in dweb-transports

To run without dweb-mirror, 
```
cd ~/git/dweb-archive/dist
http-server
```
This will run a local server that can be accessed at 
```
http://localhost:8080/archive.html 
```
The code will be run from your local server, but will access content at dweb.me

## FUTURE: Updating dweb-mirror for a developer

```
cd ~
git/dweb-mirror/install_dev.sh
```
Should update all the packages from the GIT repo's and re-install, 
and is fairly quick if nothing much has changed.


