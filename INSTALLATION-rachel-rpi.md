# Installation instructions for Rachel + Dweb-mirror on Raspberry Pi

This set of installation instructions are for dweb-mirror running on a RPI with Rachel.

If that's not what you are using then one of the following documents might be much easier to follow. 

 * Mac OSX [INSTALLATION-osx.md](./INSTALLATION-osx.md)
 * Internet In A Box (IIAB) on Rasberry Pi [INSTALLATION-iiab-raspberrypi.md](./INSTALLATION-iiab-raspberrypi.md)
 * Raspberry Pi without IIAB [INSTALLATION-raspberrypi.md](./INSTALLATION-raspberrypi.md)
 * Orange Pi without IIAB [INSTALLATION-orangepizero.md](./INSTALLATION-orangepizero.md)
 * Rachel on the 3+ [INSTALLATION-rachel.md](./INSTALLATION-rachel.md) 
 * Rachel on the RPI [INSTALLATION-rachel-rpi.md](./INSTALLATION-rachel-rpi.md) 
 * Mac OSX Developer [INSTALLATION-osx-dev.md](./INSTALLATION-osx-dev.md)
 * Everything in one doc [INSTALLATION-work.md](./INSTALLATION-work.md)
 * TODO developer instructions on other platforms.

If anything here doesn't work please email mitra@archive.org 
or it would be even more helpful to post a PR on https://github.com/internetarchive/dweb-mirror 

## See also
* [README.md](./README.md) for more general information

### Step 1: Operating System + Rachel Image

#### Download image
Download the temporary image from 
[Raspbian Buster + Rachel](http://rachelfriends.org/downloads/public_ftp/rachelpi_64EN/rachelpi_2019/rachel-pi_kolibi_buster_unofficial.7z)
(the will be moving soon to a different location)

#### Blow this to a SD

* On a Mac for anything except NOOBS
  * downloaded [Etcher](https://www.balena.io/etcher/) (100Mb)
  * Run Etcher (its supposed to be able to use the zip, though for this test we used the .img from expanding hte zip), selecting a fresh 16GB SD card as the destination

* For NOOBS
  * Unzip it
  * On a Mac format open "Disk Utilities" and Erase the SD card with format "FAT".
  * Copy the NOOBS files to the SD card.

* On Windows or Linux, I'm not sure the appropriate steps instead of Etcher. 

You can now boot your machine.

* Insert the SD card and boot the RPI (RPI3 or RPI4 should work)
* If at all possible insert Ethernet, otherwise it will work over WiFi with some extra steps.
* Power up
* Connect to the RACHEL-Pi Wifi - it should give you an address like 10.10.10.xxx
* ssh to 10.10.10.10
* Login as `pi` with password `rachel`

The easiest way is to run the installation script
```
curl -o/tmp/install.sh -L https://unpkg.com/@internetarchive/dweb-mirror/rachel/install.sh
chmod +x /tmp/install.sh
sudo /tmp/install.sh
```

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

In a browser open: http://rachel.local:4244 
or via the main interface at http://rachel.local and click Internet Archive

#### Troubleshooting
If you don’t get a Archive UI then look at the server log 
```
service internetarchive status
```
Will get the status and most recent lines

On Rachel/RPI journalctl is missing, in which case ...
```
tail -f /var/log/daemon.log
```

Look for any “FAILING” log lines which indicate a problem

Expect to see errors in the Browser log for 
* http://localhost:5001/api/v0/version?stream-channels=true  - which is checking for a local IPFS server

Expect, on slower machines/networks, to see no images the first time, 
refresh after a little while and most should appear. 

#### Disk storage
Any of these platforms should be able to see a disk plugged into the USB port that 
contains `archiveorg` at its top level. 
This is tested on IIAB-on-RPI, Rachel-on-RPI and Mac OSX.
On other RPI or Armbian it may need a variation of the techniques in install_rachel.sh

## 7. Auto-starting

The server will autostart at reboot, or if it crashes.

Restart your machine and check that http://rachel.local:4244 still works.
```
sudo shutdown -r
```
When it comes back up
```
service internetarchive status
```

## 8. Updating

The software is frequently revised so its recommended to update, especially if you see any bugs or problems.
```
cd ~/node_modules/@internetarchive   # or wherever you started the process in 3a above.
yarn install
yarn upgrade    # Upgrade all packages
```
### Troubleshooting

Logs are in /var/log/daemon.log. 

