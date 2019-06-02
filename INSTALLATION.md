# Internet Archive - Universal Library project - Installation

See [README.md] for more info

## Installation
 
At the moment this is one set for developing, or use, later I'll split it when its more stable.

Please check for a platform specific INSTALLATION for some platforms. Specifically:
 * [./INSTALLATION-rachel.md] for Rachel 
 * [./INSTALLATION-iiab-raspberrypi.md] for Internet In A Box (IIAB) on a RaspberryPi
 * [./INSTALLATION-raspberrypi.md] for RaspberryPi if you don't want Internet In A Box
 
This is important, as these instructions dont work without some prelims for some of the smaller platforms
and because we've modified the IIAB installer to include dweb-mirror so the installation process is very different.

Also, if you are working on another machine that uses Ansible, 
then the [IIAB Ansible Role](https://github.com/iiab/iiab/tree/master/roles/internetarchive) is a good place to start.
And also there are [yarn](https://github.com/iiab/iiab/tree/master/roles/yarn) 
and [node](https://github.com/iiab/iiab/tree/master/roles/nodejs)internetarchive.service.j2 roles in the same repo. 

### 1. Prelim - getting your machine ready.
* ###### You'll need git, node, npm, yarn, which should be on most Linux machines.

#### Mac OSX
* git: type "git" in a Terminal window, if git is installed you'll get the help message,
if not then it should prompt you to install Xtools command line tools, accept ...
* node and npm: https://nodejs.org should know its a map and prompt you to install, select the "recommended" version
* yarn: https://yarnpkg.com/en/docs/install should auto-detect and make suggestions. 
The easiest is often, at a terminal window: 
```
      curl -o- -L https://yarnpkg.com/install.sh | bash
```

#### Rachel 3+ (32 bit intel box from World Possible)
This is complex, the OS with the box is seriously out of date, see [./INSTALLATION-rachel.md]

#### Raspberry Pi 3 without Internet In A Box (IIAB)
This is complex, see [./INSTALLATION-raspberrypi.md] then come back here to finish

#### Anything else
* This is only tested on current versions, so I recommend updating before installing.
* Node: open `https://nodejs.org` in the browser.  It should auto-detect your machine, and get the "recommended" version.
* Npm: # sudo npm install npm@latest -g
* Git: Try `git --version` and if its not installed or lower than v2.0.0 then See [Atlassian Tutorial](https://www.atlassian.com/git/tutorials/install-git)
* yarn: https://yarnpkg.com/en/docs/install should auto-detect and make suggestions. 
The easiest is often, at a terminal window: 
```
      curl -o- -L https://yarnpkg.com/install.sh | bash
```

### 3. Install dweb-mirror

There are two alternatives, depending on whether running as an appliance (recommended) or will work on the code on this machine or not. 

#### 3a. EITHER dweb-mirror as a server / appliance (tested on Rachel 3+ and RPi3)

We will install it as a standard node_module

Create a top level cache directory.

This has to be called `archiveorg` but can be in your home directory (if you plan
on running the server there) or can be in `/.data`, `/library` or at the top
level of any disk e.g.

```
sudo mkdir -p "/.data/archiveorg" && sudo chown ${USER} /.data/archiveorg
```
If its anywhere else, then edit `~/dweb-mirror.config.yaml` after you've finished installing to add the lines such as:
```
directories:
  - /foo/bar/archiveorg # wherever you put 'archiveorg'
  - /Volumes/*/archiveorg # Check any plugged in drives
```

The following yarn install might or might not be needed but seems to speed 
up compiles and updates.
```
sudo yarn add node-pre-gyp cmake
```
Now add the packages we need for dweb-mirror.
```
cd /usr/local  # Various other places didn't work on Rachel, but in theory it should work anywhere.
yarn add @internetarchive/dweb-mirror @internetarchive/dweb-archive
```

If it fails, then
```
sudo yarn install
```
which can be safely rerun. 

The example above would install dweb-mirror as `/usr/local/node_modules/@internetarchive/dweb-mirror`
which is referred to as `<wherever>/dweb-mirror` in the rest of this INSTALLATION

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
* `yarn install` # Expect this to take a while and generate error messages. 
* `cd ..`       # Back to /path/to/install

Repeat for any of dweb-archive, dweb-archivecontroller, dweb-objects, or dweb-transports if you plan on developing on them.

Please check current versions of INSTALLATION.md in those packages, as they may have changed.

You can come back and do this again later, but will need to rerun `cd /path/to/install/dweb-mirror; yarn install` so that it recognizes the dev versions.

##### 3b2 Install dweb-mirror from GIT

From a command line:

* cd <directory where you want to put dweb-mirror> #  Wherever you want to put dweb-mirror, its not fussy, I tend to use ~/git and you might see that assumption in some examples.
* `git clone "https://github.com/internetarchive/dweb-mirror"`
* `cd dweb-mirror`
* `yarn install` # Expect this to take a while and generate error messages. 
* `yarn install` # Second time will help understand if error messages are significant
* `cd ..`

(Note: `yarn install` will run the script install.sh which can be safely run multiple times.)

It will add links to Javascript webpack-ed bundles into the dist directory, 
from the git cloned repos such as dweb-archive etc if you chose to install them above, 
otherwise to those automatically brought in by `yarn install`


### 4. Edit configuration

If you are doing anything non-standard, then you'll need to create and edit 
a local configuration file.  Otherwise the application will create it the first time its needed.
```
cd <wherever you installed dweb-mirror>/dweb-mirror
# By default this is /usr/local/node_modules/@internetarchive/dweb-mirror or /usr/local/git/dweb-mirror

cp ./dweb-mirror.config.yaml ${HOME} # Copy sample to your home directory and edit, 
```
and edit `$HOME/dweb-mirror.config.yaml` for now see `configDefaults.yaml` for inline documentation.

  * `directories` if you plan on using places other than any of those in dweb-mirror.config.yaml (/.data/archiveorg, and any USBs on Rachel3+, NOOBS or IIAB
  * `archiveui/directories` you probably dont need to change this as it will usually guess right, but it points to the “dist” subdirectory of wherever dweb-archive is either cloned or installed by npm install.
  * `apps.crawl` includes a structure that lists what collections are to be installed, I suggest testing and then editing

   
Note that directories specified in the config file can be written using with shell / unix conventions such as "~/" or "../".

### 5. Test browsing

* From a command line:
* `cd <wherever>/dweb-mirror && ./internetarchive --server &` # starts the HTTP server
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
* ./internetarchive --crawl

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

### 8. Autostarting
Autostarting varies from platform to platform. 
IIAB is configured automatically. 
On many platforms you'll need to setup a service, 
there is a template to work from at [./internetarchive.service]. 
It needs the location of your installation.
TODO check where this goes on Raspberry Pi/NOOBS and Rachel
TODO alternative start process on Mac.

## Updating dweb-mirror 
The update process depends on whether you took choice "a" (appliance) or "b" (developer) above.

### a) Appliance
```
cd /usr/local   # or wherever you started the process in 3a above.
yarn upgrade    # Upgrade all packages
```

### b) Developer
* cd <wherever>/dweb-mirror
* git pull
* npm update
* npm run update # Note there is an intentional feature/bug, in npm in that it that doesnt automatically run an "update" script. 
