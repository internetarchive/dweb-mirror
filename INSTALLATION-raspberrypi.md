# Installation instructions for dweb-mirror on Raspberry Pi

This set of installation instructions are for dweb-mirror running on a Raspberry Pi without Rachel or IIAB.

If that's not what you are using then one of the following documents might be much easier to follow. 

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
* [https://github.com/internetarchive/dweb-mirror/issues/110] for meta task for anything Raspberry related.

## 1. Getting your machine ready.

This is important, as the installation instructions does not work without some preliminary upgrades,
especially for some of the smaller platforms.

If you just want dweb-mirror running on a NOOBS based RPi (and don't want Internet In A Box) try this. 

While it is unlikely that the process below is particularly fussy about a roughly normally configured RPi, 
the following notes might aid in a speedy setup on a new RPi.

### Installing NOOBS or Raspbian

#### NOOBS on RPI3
On the RPI3 we started with a standard preconfigured NOOBS MicroSD card that came with the Canakit box we got
and that gives an easy way to install Raspbian (we use the desktop version).
 
#### NOOBS on RPI4
The RPI4 from Canakit strangely was missing NOOBS, and the Raspberry Pi site is strangely missing NOOBS images,
* Download the zip of NOOBS from https://www.raspberrypi.org/downloads/noobs/ and unzip it
* On a Mac format open "Disk Utilities" and Erase the SD card with format "FAT".
* Copy the NOOBS files to the SD card.
* Plug the card into the RPI4, along with a power supply 
  * (beware, its very picky about USB-C supplies, if the supply works the LED will turn on)
* It should boot 
* Select the OS to use - we tested with the full Raspbian, but have previously used Raspbian desktop successfully.

#### Alternatively Raspbian image diretly
* Downloaded Raspbian [Raspbian](https://www.raspberrypi.org/downloads/raspbian/) to your laptop (~1GB)
    * Any of the distributions should work - I test on the Desktop version, 
* On a Mac:
  * downloaded [Etcher](https://www.balena.io/etcher/) (100Mb)
  * Run Etcher (its supposed to be able to use the zip, though for this test we used the .img from expanding hte zip), selecting a fresh 16GB SD card as the destination
* On Windows or Linux, I'm not sure the appropriate steps instead of Etcher. 
* Inserted into Raspberry Pi, and power up with Kbd and HDMI and Mouse inserted. 
* If at all possible insert Ethernet, otherwise it will work over WiFi with some extra steps.

#### Configure Raspbian
* It prompted me for some getting started things, 
* Follow the menus to Select country, language, WiFi etc,
* in particular make sure to change the password as RPIs with default passwords are frequently hacked.
* Menu / Preferences
  * Config
    * Interfaces:SSH:Enabled
    * Set Localization if not done during install
* Screen Configuration / Configure / Screens / HDMI-1
    * Set display to highest resolution that works for your display
* Reboots (as part of saving these changes)
  
In a terminal window, or via `ssh raspberrypi` 

### 2. Run the installer to install dweb-mirror

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

In a browser open: http://archive.local:4244 or http://archive:4244

#### Troubleshooting
If you don’t get a Archive UI then look at the server log 
```
service internetarchive status
```
Will get the status and most recent lines
```
journalctl -u internetarchive
```
Will get the most recent lines (add `-f` to follow it)

Logs are in /var/log/daemon.log if you want to analyse more deeply.

Look for any “FAILING” log lines which indicate a problem

Expect to see errors in the Browser log for 
* http://localhost:5001/api/v0/version?stream-channels=true  - which is checking for a local IPFS server

Expect, on slower machines/networks, to see no images the first time, 
refresh after a little while and most should appear. 

#### Disk storage
The box should be able to see a disk plugged into the USB port that contains `archiveorg` at its top level. 

## 7. Auto-starting

The server will autostart at reboot, or if it crashes.

Restart your machine and check that http://archive.local:4244 still works.
```
sudo shutdown -r
```
When it comes back up
```
service internetarchive status
```

## 8. Updating

The software is frequently revised so its recommended to update, especially if you see any bugs or problems.

The quickest way is 
```
cd ~   # or wherever you started the process in 3a above.
yarn install
yarn upgrade    # Upgrade all packages
```

But you can also rerun the install procedure in Step 2, which will skip steps that have 
