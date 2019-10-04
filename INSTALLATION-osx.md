# Installation instructions for dweb-mirror on Mac OSX

See [README.md] for more info

These instructions are for dweb-mirror on Mac OSX

If that's not what you are using then one of the following documents might be much easier to follow. 

 * Mac OSX [INSTALLATION-osx.md](./INSTALLATION-osx.md)
 * Internet In A Box (IIAB) on Rasberry Pi [INSTALLATION-iiab-raspberrypi.md](./INSTALLATION-iiab-raspberrypi.md)
 * Raspberry Pi without IIAB [INSTALLATION-raspberrypi.md](./INSTALLATION-raspberrypi.md)
 * Orange Pi without IIAB [INSTALLATION-orangepizero.md](./INSTALLATION-orangepizero.md)
 * Rachel on the 3+ [INSTALLATION-rachel.md](./INSTALLATION-rachel.md) 
 * Rachel on the RPI [INSTALLATION-rachel-rpi.md](./INSTALLATION-rachel-rpi.md) 
 * Mac OSX Developer [INSTALLATION-osx-dev.md](./INSTALLATION-osx-dev.md)
 * Yunohost [INSTALLATION-yunohost.md](./INSTALLATION-yunohost.md)
 * Everything in one doc [INSTALLATION-work.md](./INSTALLATION-work.md)
 * TODO developer instructions on other platforms.

If anything here doesn't work please email mitra@archive.org 
or it would be even more helpful to post a PR on https://github.com/internetarchive/dweb-mirror 

### 1. Getting your machine ready.

On a Mac OSX all the preliminary steps are handled by the installer.

### 2. Run the installer to install dweb-mirror

There are two alternatives, 
* run as an appliance (recommended)
* work on the code on this machine or not. 

If you want to install on OSX as an appliance (recommended) read on, 
if you want to develop check ./INSTALLATION-osx-dev.md instead.

#### dweb-mirror as a server / appliance.

We will install it as a standard node_module under your home directory.

The easiest way is to run the installation script
```
curl -o- -L https://unpkg.com/@internetarchive/dweb-mirror/install.sh | bash
```
If it fails, its safe to repeat this.

### 3. Edit configuration

If you are doing anything non-standard, then you'll need to create and edit 
a local configuration file.  Otherwise the application will create it the first time its needed.
```
cd ~/node_modules/@internetarchive/dweb-mirror

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

#### Crawling
Crawling will happen automatically, but you can also test it manually.

From a command line:

```
cd ~/node_modules/@internetarchive/dweb-mirror && ./internetarchive -sc &
```
* starts the HTTP server
* It might take 10-15 seconds to start, be patient
* It should start crawling, and get just a minimal set of icons for the home page.
* the startup is a little slow but you'll see some debugging when its live.
* If you see a message like `Requeued fetch of https://dweb.me/info failed` then it means it cannot see 
  the archive's servers (on `dweb.me`) so it won't be able to crawl or cache initial material until you 
  connect to the WiFi or Ethernet. 

Without any other arguments, `crawl` will read a set of files into into the first (already existing) directory
configured in `~/dweb-mirror.config.yaml` 
or if there are none there, it will look in its installation directory for `configDefaults.yaml`.

Look in that directory, and there should be sub-directories appearing for each item, with metadata and/or thumbnails.

You can safely delete any of the crawled material and it will be re-fetched if needed.

#### Browsing

In a browser open: http://localhost:4244

#### Troubleshooting
If you don’t get a Archive UI then look at:
* the server log (in the same window you started the server from).
* the browser's console log.

Expect to see errors in the Browser log for 
* http://localhost:5001/api/v0/version?stream-channels=true  - which is checking for a local IPFS server

Expect, on slower machines/networks, to see no images the first time, 
refresh after a little while and most should appear. 

#### Disk storage
The box should be able to see a disk plugged into the USB port that contains `archiveorg` at its top level. 

### 6. IPFS (optional)
Install IPFS, there are several strategies in install_ipfs.sh that should at least cover your Mac,
but it might need editing if you have an odd combinations.
```
cd ~/node_modules/@internetarchive/dweb-mirror
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
cd ~/node_modules/@internetarchive/dweb-mirror && ./install_ipfs.sh
```
should update it.

### 7. Auto-starting

TODO - this doesnt appear to work, needs investigation

If you want the server to start automatically when the mac boots. 
Run the following commands in a terminal window

If you put the installation somewhere else, you'll need to edit `org.archive.mirror.plist` and 
change the line `${HOME}/node_modules/@internetarchive/dweb-mirror/internetarchive` to wherever you have dweb-mirror
to be the path to "internetarchive"
```
sudo cp ~/node_modules/@internetarchive/dweb-mirror/org.archive.mirror.plist /Library/LaunchAgents/org.archive.mirror.plist
sudo launchctl load /Library/LaunchAgents/org.archive.mirror.plist
```

Restart your machine and check that http://localhost:4244 still works.

Note that I've currently had problems with getting it to start automatically. 

## 8. Updating

The quickest way is 
```
cd ~
yarn install
yarn upgrade    # Upgrade all packages
```

But you can also rerun the install procedure in Step 2, 
which will skip steps that have already completed.

