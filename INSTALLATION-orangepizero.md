# Installation instructions for dweb-mirror on Orange Pi Zero with Armbian Buster

This set of installation instructions are for dweb-mirror running on a Orange Pi Zero.

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

## See also
* [README.md](./README.md) for more general information
* [dweb-mirror issue#224](https://github.com/internetarchive/dweb-mirror/issues/224) 
  for any questions or problems with OrangePi

### 1. Getting your machine ready.

This is important, as the installation instructions does not work without some preliminary upgrades,
especially for some of the smaller platforms.

#### Download image

Orange Pi's run best with Armbian - from https://www.armbian.com/download/
These instructions were tested on the Orange Pi Zero, with the Debian variety which is currently "Buster".
but the process probably works with other variants of the Orange-Pi. 

* Downloaded the image to your laptop (~250Mb)

#### Blow this to a SD

* Select an SD card as the destination (the larger the card, the more content it can hold)
* Program the SD card with this image
  * On a Mac:
    * downloaded [Etcher](https://www.balena.io/etcher/) (100Mb)
    * Run Etcher (its supposed to be able to use the zip, though for this test we used the .img from expanding the zip)    
  * On Windows or Linux, I'm not sure the appropriate steps instead of Etcher to write to an SD. (TODO)

### Booting and connecting
I found https://lucsmall.com/2017/01/19/beginners-guide-to-the-orange-pi-zero/ to be a useful guide if you have problems.

Booting an Orange Pi Zero or similar is tricky as there is no display/keyboard and you need the IP address to connect.
Insert the SD card then Ethernet and power. 
Note Armbian doesn't work with the common trick of `ping 192.0168.0.255` followed by `arp -a` to find new machines on your net.
The best way appears to be to log into your router and look for "orangepi" or similar in the DHCP table. 
Lets assume its 192.168.0.55

`ssh root@1292.168.0.55`  and respond to password with the default `1234`

Change your password immediately - it should prompt you and create a new user, we recommend calling this "pi"

One final step - since we cant automate this:
```
  sudo dpkg-reconfigure tzdata
```

#### 1F-wifi: WiFi on Armbian
Typically you'll either want to connect to your WiFi access point and be a server on it,
OR have the Armbian act as a WiFi point itself.

If so, you can do this now, or later. 


a) To setup for your wifi to access your Wifi access point.
 sudo nano /etc/network/interfaces

And add these lines to the end, using your SSID (aka wifi name) and password

 auto wlan0
 iface wlan0 inet dhcp
 wpa-ssid <Your Access Point Name aka SSID>
 wpa-psk <Your WPA Password>

Then start it with

 sudo ifup wlan0

or b)

* sudo armbian-config > network > hotspot >
* At some point it asks to "select interface" I think this is the point to pick wlan0 though its unclear whether
  this is the WiFi interface to use, or for backhaul?
* TODO document process to change SSID
* Note that once setup, it can take a minute or two for the WiFi access point to be visible.
* Also note that it seems to pick unusual IP addresses, 172.24.1.1 was the gateway when I connected to it.

* If anyone knows how to set this up from the command line a PR would be appreciated.
* This doc might be helpful
  https://docs.armbian.com/User-Guide_Advanced-Features/#how-to-set-wireless-access-point

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

In a browser open: http://archive.local:4244 or http://archive:4244 or http://<IP of your machine>:4244

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

But you can also rerun the install procedure in Step 2, 
which will skip steps that have already completed.
