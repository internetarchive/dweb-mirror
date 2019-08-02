# Installation instructions for dweb-mirror on ....

This is a working copy used to create or update the more platform specific installation documents, 
and covers a lot of platforms.

If you are using any of the following scenarios then the following stripped down documents 
will be much easier to follow. 

 * Mac OSX [INSTALLATION-osx.md](./INSTALLATION-osx.md)
 * Internet In A Box (IIAB) on Rasberry Pi [INSTALLATION-iiab-raspberrypi.md](./INSTALLATION-iiab-raspberrypi.md)
 * Raspberry Pi without IIAB [INSTALLATION-raspberrypi.md](./INSTALLATION-raspberrypi.md)
 * Rachel on the 3+ [INSTALLATION-rachel.md](./INSTALLATION-rachel.md) 
 * Rachel on the RPI [INSTALLATION-rachel-rpi.md](./INSTALLATION-rachel-rpi.md) 
 * Mac OSX Developer [INSTALLATION-osx-dev.md](./INSTALLATION-osx-dev.md)
 * Everything in one doc [INSTALLATION-work.md](./INSTALLATION-work.md)
 * TODO developer instructions on other platforms.

If anything here doesn't work please email mitra@archive.org 
or it would be even more helpful to post a PR on https://github.com/internetarchive/dweb-mirror 

## See also
* [README.md](./README.md) for more general information

### IIAB
* [issue #111](https://github.com/internetarchive/dweb-mirror/issues/111) for meta task for anything IIAB.

### RACHEL
* TODO need pointer to task on rachel and on dweb-mirror

### Raspberry Pi without IIAB or Rachel
* [https://github.com/internetarchive/dweb-mirror/issues/110] for meta task for anything Raspberry related.

## 1. Getting your machine ready.

This is important, as the installation instructions does not work without some preliminary upgrades,
especially for some of the smaller platforms.

### 1A: IIAB only: Initial setup - getting Raspbian

If your Raspberry Pi comes with Raspbian you are in luck, skip this, 
otherwise if it comes with NOOBS (as most do now) you'll need to replace it with Raspbian.

Internet in a Box's site is short on the initial details, especially if your RPi comes with NOOBS as mine did. 
So this is what I did. (Edits welcome, if your experience differed)

* Downloaded Raspbian [Raspbian](https://www.raspberrypi.org/downloads/raspbian/) to your laptop 1GB
  * Any of the distributions should work - I test on the Desktop version
  * We've seen on Rachel, problems with `Buster Lite` that required `apt update && apt get -y libsecret-1-dev`
* On a Mac:
  * downloaded [Etcher](https://www.balena.io/etcher/) (100Mb)
  * Run Etcher (its supposed to be able to use the zip, though for this test we used the .img from expanding hte zip), selecting a fresh 16GB SD card as the destination
* On Windows or Linux, I'm not sure the appropriate steps instead of Etcher. 
* Inserted into Raspbian 3, and powered up with Kbd and HDMI and Mouse inserted. 
* If at all possible insert Ethernet, otherwise it will work over WiFi with some extra steps.
* Powered up
* It prompted me for some getting started things, 
* Accepted "Next to get started" though I suspect IIAB's comprehensive install gets some of them as well.
* Selected your country, language, keyboard - it shouldnt matter which.
* Changed password since RPis get hacked on default password
* Connected to WiFi (not necessary if you have Ethernet connected)
* It automatically Updated OS - this is big - take a break :-)
    * Note that this process failed for me with failures of size and sha, but a restart, after the prompts for password etc, 
    got me to a partially completed download so I did not have to start from scratch
* You might want to ... Menu/Preferences/Config / Set display to highest resolution

### 1C: World-Possible/Rachel on Rachel 3+
See [./INSTALLATION-rachel.md](./INSTALLATION-rachel.md]), installation instructions are not complete
so they haven't been incorporated here yet.

### 1D: World-Possible/Rachel on Raspberry Pi
See [./INSTALLATION-rachel-rpi.md](./INSTALLATION-rachel-rpi.md]), installation instructions are not complete
so they haven't been incorporated here yet.

### 1E: Raspbian without IIAB or Rachel

If you just want dweb-mirror running on a NOOBS based RPi (and don't want Internet In A Box) try this. 

While it is unlikely that the process below is particularly fussy about a roughly normally configured RPi, 
the following notes might aid in a speedy setup on a new RPi.

### Installing NOOBS

On the RPI3 we started with a standard preconfigured NOOBS MicroSD card that came with the Canakit box we got
and that gives an easy way to install Raspbian (we use the desktop version).
 
The RPI4 from Canakit strangely was missing NOOBS, and the Raspberry Pi site is strangely missing NOOBS images,
* Download the zip of NOOBS from https://www.raspberrypi.org/downloads/noobs/ and unzip it
* On a Mac format open "Disk Utilities" and Erase the SD card with format "FAT".
* Copy the NOOBS files to the SD card.
* Plug the card into the RPI4, along with a power supply 
  * (beware, its very picky about USB-C supplies, if the supply works the LED will turn on)
* It should boot - we tested with the full Raspbian, but have previously used Raspbian desktop successfully.
* Follow the menus to Select country, language, WiFi etc,
  * in particular make sure to change the password as RPIs with default passwords are frequently hacked.

* Menu / Preferences
  * Config
    * Interfaces:SSH:Enabled
    * Set Localization if not done during install
* Screen Configuration / Configure / Screens / HDMI-1
    * Set display to highest resolution that works for your display
* Reboots (as part of saving these changes)
  
In a terminal window, or via SSH to it. 
```
sudo apt-get update && sudo apt full-upgrade -y 
```
* We've seen on some platforms (Rachel), problems with `Buster Lite` that required, `libsecret-1-dev`
its a good idea to check its there and install if necessary.
```
sudo apt update && sudo apt-get install -y libsecret-1-dev
```

### 1F: Other machines including OSX but (not Raspberry Pi (IIAB, Rachel or raw) or Rachel3+)

We haven't tested yet on other machines, but some hints on how to port ... 

If you are working on another configuration that uses Ansible, 
then the [IIAB Ansible Role](https://github.com/iiab/iiab/tree/master/roles/internetarchive) is a good place to start.
And also there are [yarn](https://github.com/iiab/iiab/tree/master/roles/yarn) 
and [node](https://github.com/iiab/iiab/tree/master/roles/nodejs)internetarchive.service.j2 roles in the same repo. 

#### Updating tools
You'll need git, node, npm, yarn, which should be on most Linux machines, 
but many platforms ship with seriously out-of-date versions and we only test on current versions, 
so I recommend updating before installing.

#### GIT
Type `git --version` in a Terminal window, you want git v2.0.0 or better, 

##### ON MAC OSX 
if Git isnt installed then it should prompt you to install Xtools command line tools, accept ...

##### ON OTHER LINUX MACHINES
If is not installed or lower than v2.0.0 then See [Atlassian Tutorial](https://www.atlassian.com/git/tutorials/install-git)

#### NODE
Try `node --version`, it should report v10 or better, but it was v4.8.2 on Rachel3+ 
and v8 on Noobs and Raspbian in some cases, or missing in others.
 
  * otherwise https://nodejs.org should auto-detect your machine, and prompt you to install, 
  * select the "recommended" version

In terminal window or on SSH

If that doesn't work, and in particular if it still only installs v8 then force an upgrade.
```
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
# This warned that you might need `sudo apt-get install gcc g++ make` which I haven't done
sudo apt-cache policy nodejs # Should show v10 (on Rachel, only showed v9)
sudo apt-get install -y nodejs
node -v # Confirm it upgraded to 10.x
```

#### NPM 
Node will always come with some version of NPM, 
but its often old (including on current (July2019) Raspbian.
to upgrade to the latest `sudo npm install npm@latest -g`

#### YARN

Note that on many platforms, a plain `apt-get install yarn` will fail, and get the cmdtest instead, 
if you did this by mistake then `sudo apt-get remove cmdtest` before trying again

* yarn: `yarn --version` should report `v1.x.x` 
  * Otherwise: https://yarnpkg.com/en/docs/install should auto-detect and make suggestions. 
  * But, the easiest way is often, at a terminal window: 

Either (tested on OSX & RPI/NOOBS)
```
      curl -o- -L https://yarnpkg.com/install.sh | bash
```
or (Works on RPI/NOOBS)
```
   curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
   echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
   sudo apt-get update && sudo apt-get install yarn
```

#### node-pre-gyp and cmake
The following yarn install might or might not be needed but seems to speed 
up compiles and updates.

Note that sometimes `sudo yarn` will work and sometimes `yarn`, depending on oddness about the installation process.
```
yarn add node-pre-gyp cmake
```
##### ON MAC OSX
If you get an error `wget: No such file or directory` 
then the easiest fix is to install `brew` which is a generally useful package manager.
Follow the one line instructions at https://brew.sh,  which needs you to have Admin access. 

Then run `brew install wget` 

If that fails (as it did for me on an older Mac running OSX10.11 (the last version on Mac Minis)
you can try the instructions at http://osxdaily.com/2012/05/22/install-wget-mac-os-x/
but it works fine to continue without `node-pre-gyp` and `cmake`

### 2. Install dweb-mirror

There are two alternatives, either as an "Appliance" which we recommend for most users,

Or if you want to develop the code then skip to 2B 

#### dweb-mirror as a server / appliance (tested on Rachel 3+ and RPi3)

We will install it as a standard node_module under your home directory.

Create a top level cache directory.

This has to be called `archiveorg` but can be in your home directory (if you plan
on running the server there) or can be in `/.data`, `/library` or at the top
level of any disk e.g.

```
mkdir -p "~/archiveorg" && chown ${USER} ~/archiveorg
```
If its anywhere other than in `~`, `/.data`, or `/library` or at the top level of one of your disks, 
then edit `~/dweb-mirror.config.yaml` after you've finished installing to add the lines such as:
```
directories:
  - /foo/bar/archiveorg # wherever you put 'archiveorg'
  - /Volumes/*/archiveorg # Check any plugged in drives
```

Now add the packages we need for dweb-mirror.

Choose where you want to put them, if in doubt then the home directory is probably good, 
on some platforms, notably Rachel, we had to use `/usr/local` or some things broke.
```
cd ~  # CD into wherever you'll put this, the rest of the instructions assume "~"
yarn add @internetarchive/dweb-mirror @internetarchive/dweb-archive
```
Expect to see lots of warning, most of these are from packages we don't control 
that depend on packages that have moved, been deprecated or have a security warning. 

If it fails, then
```
sudo yarn install
```
which can be safely rerun. 

The example above would install dweb-mirror as `~/git/node_modules/@internetarchive/dweb-mirror`

Now skip to step 3

### 2B: Developers Only 

### 2B.1: Install any other dweb repos you plan on developing on

Before installing dweb-mirror for development install any other repos you'll be developing on,
so that the install process can find them instead of using versions from npm.

If you don't plan on developing on dweb-archive, dweb-archivecontroller, dweb-objects, or dweb-transports you can skip this step.

For example to develop on dweb-archive if you install GIT packages in `~/git` which is what I do ...

From a command line:

```
cd ~/git        # Wherever you want to put dweb-mirror, its not fussy, 
                # I tend to use ~/git and you might see that assumption in some examples.
git clone “https://github.com/internetarchive/dweb-archive”
cd dweb-archive
yarn install    # Expect this to take a while and generate error messages. 
cd ..           # Back to ~/git
```
Repeat for any of dweb-archive, dweb-archivecontroller, dweb-objects, or dweb-transports if you plan on developing on them.

Please check current versions of INSTALLATION.md in those packages, as they may have changed.

You can come back and do this again later, 
but will need to rerun `cd ~/git/dweb-mirror; yarn install` so that it recognizes the dev versions.

##### 2B.2 Install dweb-mirror from GIT

From a command line:

```
cd ~/git` #  Wherever you want to put dweb-mirror, its not fussy, I tend to use ~/git and you might see that assumption in some examples.
git clone "https://github.com/internetarchive/dweb-mirror"
cd dweb-mirror
yarn install # Expect this to take a while and generate error messages. 
yarn install # Second time will help understand if error messages are significant
cd ..  # Back to ~/git
```
(Note: `yarn install` will run the script install.sh which can be safely run multiple times.)

It will add links to Javascript webpack-ed bundles into the dist directory, 
from the git cloned repos such as dweb-archive etc if you chose to install them above, 
otherwise to those automatically brought in by `yarn install`

## 2C IIAB ONLY: Install Internet In A Box

### Internet Archive is in the IIAB distribution.

Note its strongly recommended to connect your RPi to the Ethernet, rather than WiFi due to both to speed, 
and some bugs in the IIAB installer

Run `sudo curl d.iiab.io/install.txt | sudo bash` to install it.
 
To enable it either
a) select the `BIG` distribution, in which case Internet Archive is included 

OR 

b) select `MIN` or `MEDIUM` 
When prompted to edit `/etc/iiab/local_vars.yml` respond `yes` and set the crucial two lines to:
```
internetarchive_install: True
internetarchive_enabled: True
```
and then run `sudo iiab` to continue the installation.

* Update of OS was quick as it probably duplicated the step in the auto-setup above
* expect it to fail, and keep running `sudo iiab` to get it to complete.    
* It will prompt to reset password from default `iiab-admin/g0admin`
* In theory it enables SSH, but sometimes after the OS upgrade to enable it I've had to:
  * login from an attached keyboard, 
  * Preferences > Raspberry Config > Services > SSH > enable

### IIAB: Check it worked 

In a browser open: `http://box.lan/admin`   id=`iiab-admin` pw=`whatever you set password to during install`

* Note that I've found that `box.lan` does not work as documented, and that on many setups `box.local` is required instead. 
  See [IIAB Issue#1583](https://github.com/iiab/iiab/issues/1583)
  
Now check dweb-mirror was installed by opening `http://box.local:4244`
  
Also see [http://wiki.laptop.org/go/IIAB/FAQ] if it failed

And if you want to run as a local WiFi hotspot (recommended) then from the ssh prompt..
```
iiab-hotspot-on
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
  * `archiveui/directories` you probably dont need to change this as it will usually guess right, 
  but it points to the “dist” subdirectory of wherever dweb-archive is either cloned or installed by npm install.
  * `apps.crawl` includes a structure that lists what collections are to be installed, 
  I suggest testing and then editing
   
Note that directories specified in the config file can be written using shell or unix conventions such as "~/" or "../".

### 4. Test crawling and browsing

First start the server.
* For Developers: From a command line:
```
cd ~/git/dweb-mirror && ./internetarchive --server &
```
* For Anyone else: From a command line:
```
cd ~/node_modules/@internetarchive/dweb-mirror && ./internetarchive -sc &
```
* starts the HTTP server
* It should start crawling, and get just a minimal set of icons for the home page.
* the startup is a little slow but you'll see some debugging when its live.
* If it reports `ERROR: Directory for the cache is not defined or doesnt exist`
  * then it means you didn't create a directory for it to use as a cache
  * the server wants you to do this, so that it doesn't fill a disk somewhere you don't want it to happen
* If you see a message like `Requeued fetch of https://dweb.me/info failed` then it means it cannot see 
  the archive's servers (on `dweb.me`) so it won't be able to crawl or cache initial material until you 
  connect to the WiFi or Ethernet. 

Without any other arguments, `crawl` will read a set of files into into the first (already existing) directory
configured in `~/dweb-mirror.config.yaml` 
or if there are none there, it will look in its installation directory for `configDefaults.yaml`.

Look in that directory, and there should be sub-directories appearing for each item, with metadata and/or thumbnails.

You can safely delete any of the crawled material and it will be re-fetched if needed.

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


### 6. IPFS (optional)
Install IPFS, there are several strategies in install_ipfs.sh that should at least cover your Mac,
but it might need editing if you have an odd combinations.

cd into the installation directory.
For developers `cd ~/git/dweb-mirror`
For everyone else `cd ~/node_modules/@internetarchive/dweb-mirror`

```
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

In the future to update IPFS just run the same installation process above should update it.

## 7. Auto-starting

### MAC OSX 
TODO these instructions dont work - help to correct them would be appreciated! 

If you want the server to start automatically when the mac boots. 
Run the following commands in a terminal window

If you put the installation somewhere else, you'll need to edit `org.archive.mirror.plist` and 
change the line `${HOME}/node_modules/@internetarchive/dweb-mirror/internetarchive` to wherever you have dweb-mirror
to be the path to "internetarchive"
```
sudo cp ~/node_modules/@internetarchive/dweb-mirror/org.archive.mirror.plist /Library/LaunchAgents/org.archive.mirror.plist
sudo launchctl load /Library/LaunchAgents/org.archive.mirror.plist
```
Note that I've currently had problems with getting a Mac to start automatically. 

### Other platforms
Autostarting varies from platform to platform. 
See the note in [./INSTALLATION-rachel.md](./INSTALLATION-rachel.md) for Rachel specific notes.

On many platforms you'll need to setup a service, 
there is a template to work from at [~/node_modules/@internetarchive/dweb-mirror/internetarchive.service]. 
It needs the location of your installation.
Edit the WorkingDirectory and User lines to say
```
User=pi
WorkingDirectory=/home/pi/node_modules/@internetarchive/dweb-mirror
```
And copy to somewhere it will get used
```
sudo su
cp /home/pi/node_modules/@internetarchive/dweb-mirror/internetarchive.service /lib/systemd/system
cd /etc/systemd/system
ln -s  /lib/systemd/system/internetarchive.service .
systemctl daemon-reload
```
Check its running
```
service internetarchive status
journalctl -u internetarchive
```
Note that it might complain about wrtc not being present, which is to be expected on a RPI

### All platforms
Restart your machine and check that http://localhost:4244 still works.
```
sudo shutdown -r
```
When it comes back up
```
service internetarchive status
```

## 8. Updating

TODO Docs on Updating dweb-mirror for Developers and integrate ansible updating for IIAB

### For anyone except developers or IIAB
The software is frequently revised so its recommended to update, especially if you see any bugs or problems.
```
cd ~/node_modules/@internetarchive   # or wherever you started the process in 3a above.
yarn upgrade    # Upgrade all packages
```
### For Developers
```
cd ~/git/dweb-mirror
git pull
yarn upgrade
# Note there is an intentional feature/bug, in npm and possibly in yarn in that it that doesnt 
# automatically run an "update" script. 
yarn run update 
```
