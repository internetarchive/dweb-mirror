# Offline Internet Archive - Installation

See [README.md] for more info

## Introduction

These are instructions to install the Internet Archive's offline server
also called 'dweb-mirror, on any of the tested platforms which are currently:

* Raspberry Pi 3B+ or 4 running Raspbian or NOOBS.
* Orange Pi Zero running Armbian
* Raspberry Pi 3B+ or 4 running Rachel on top of Rasbian.
* Mac OSX 10.14 or later. 

It should work on most similar platforms, and we would welcome reports of success or failure.

There are separate instructions for:
* [INSTALLATION-dev.md](./INSTALLATION-dev.md) 
  for developers who want to work on this code or on dweb-archive (our offline Javascript UI).
  These are tested on Mac OSX, but should work with only minor changes on Linux (feedback welcome).
* [INSTALLATION-iiab-raspberrypi.md](./INSTALLATION-iiab-raspberrypi.md) 
  to install Internet In A Box on a Rasperry Pi
* [INSTALLATION-rachel.md](./INSTALLATION-rachel.md) 
  for Rachel on their own Rachel 3+ (incomplete)

If anything here doesn't work please email mitra@archive.org 
or it would be even more helpful to post a question or fix
on https://github.com/internetarchive/dweb-mirror/issues
 
There are some platform specific topics including:
* OrangePi: [dweb-mirror issue#224](https://github.com/internetarchive/dweb-mirror/issues/224) 
* RaspberryPi: [dweb-mirror issue#110](https://github.com/internetarchive/dweb-mirror/issues/110).
* Rachel: [dweb-mirror issue#93](https://github.com/internetarchive/dweb-mirror/issues/93).
* Docker & OLIP: [dweb-mirror issue#263](https://github.com/internetarchive/dweb-mirror/issues/263)
* Yunohost: [dweb-mirror issue#259](https://github.com/internetarchive/dweb-mirror/issues/259)
* Set top boxes: [dweb-mirror issue#223](https://github.com/internetarchive/dweb-mirror/issues/223)
* or feel free to start a [new Issue](https://github.com/internetarchive/dweb-mirror/issues/new)

If you are on a Mac or have already got the right operating system already,
you can skip to step 4 (Install) otherwise ... 

## Step 1: Download the Operating System to a desktop/laptop.

You'll need to download the correct version of the operating system, and then get it onto a SD in one of
several ways.

Skip ahead to 1A for OrangePi/Armbian; 1B for NOOBS on RPI3; 1C for NOOBS on RPI4;
1D for Rachel on RPI; 1E for Raspbian (without Rachel or IIAB);  1F for Intel Nuc

#### Step 1A: Orange Pi with Armbian
Download from https://www.armbian.com/download/

These instructions were tested on the Orange Pi Zero, with the Debian variety which is currently "Buster".
but the process probably works with other variants of the Orange-Pi, and versions of Armbian. 

Skip ahead to Step 2: Blow to a SD.

#### Step 1B: NOOBS on RPI3
On the RPI3 we started with a standard preconfigured NOOBS MicroSD card that came with the Canakit box.

Skip ahead to Step 3: Boot

#### Step 1C: NOOBS on RPI4
The RPI4 from Canakit strangely was missing NOOBS, and the Raspberry Pi site is strangely missing NOOBS images, 
so this requires a slightly different approach than that detailed in 1B below. 
* Download the zip of NOOBS from https://www.raspberrypi.org/downloads/noobs/ and unzip it
* On a Mac format open "Disk Utilities" and Erase the SD card with format "FAT".
* Copy the NOOBS files to the SD card. 

Skip ahead to Step 3: Boot

#### Step 1D: Rachel on Raspberry Pi
Download [Raspbian Buster + Rachel](http://rachelfriends.org/downloads/public_ftp/rachelpi_64EN/rachelpi_2019/rachel-pi_kolibi_buster_unofficial.7z).
Note this image may be moving soon to a different location soon.

Skip ahead to Step 2: Blow to SD.

#### Step 1E: Raspbian image without Rachel or IIAB
Downloaded Raspbian [Raspbian](https://www.raspberrypi.org/downloads/raspbian/) to your laptop (~1GB).
Any of the distributions should work - I test on the Desktop version, 

Skip ahead to Step 2: Blow to SD.

#### Step 1F: Intel Nuc
By the time you get it, it probably has an operating system on it

TODO - Ask Davide for instructions.

Skip ahead to Step 3D.

## Step 2: Blow this to a SD

* Select an SD card as the destination (the larger the card, the more content it can hold)
* Program the SD card with this image

On a Mac: Downloaded [Etcher](https://www.balena.io/etcher/) (100Mb), install and run it. 
It will prompt you to select: the image you downloaded above, (and will accept .img or .zip files), 
and the SD card, and it should Flash and verify.

On Windows or Linux, I'm not sure the best program to use and would appreciate suggestions.

Skip ahead to Step 3 Boot: (3A for NOOBs; 3B for Raspbian; 3C for OrangePi/Armbian) 

## Step 3: Boot and configure the Operating System
You can now boot your machine - select the right platform below: 
NOOBS; OrangePi; Rachel; or Raspberry Pi; 
(skip to Step 4 if you are on Mac OSX)

#### Step 3A: NOOBS on Raspberry Pi 3 or 4.

NOOBS provides an easy way to select a specific operating system, 

Plug the SD card into the RPI, along with a power supply, HDMI display, keyboard and mouse.
If at all possible insert Ethernet, otherwise it will work over WiFi with some extra steps.

After it boots, it should offer you a choice of Operating Systems we test on Rasbian Desktop 
- the current version we've tested against is called "Buster", but this should work for other choices.

It should boot up into that operating system, and you can continue in step 3B

#### Step 3B: Raspbian (without Rachel or IIAB)

Plug the SD card into the RPI, along with a power supply, HDMI display, keyboard and mouse.
If at all possible insert Ethernet, otherwise it will work over WiFi with some extra steps. 

It should boot up (after as much as a minute or two) with a rainbow screen 
and prompt you for some getting started things.
* Follow the menus to Select country, language, WiFi etc,
* in particular make sure to change the password as RPIs with default passwords are frequently hacked.
* Select Menu (Raspberry at top Left); `Preferences` then `Raspberry Pi Configuration` 
  then `Interfaces` and make sure `SSH` is enabled (by default it is Disabled). 
* It should reboot at least once (as part of saving these changes)

You can now open a Terminal window, or from your laptop `ssh raspberrypi`, 
login as `pi` with the password you set above.

**Workaround for Raspbian bug**: 
Raspbian has a bug that requires a patch until they push it to a new release. 
It looks from https://github.com/raspberrypi/linux/issues/3271 like you need to do 
```
sudo rpi-update
```
This should only be applicable until the Raspbian available at 
https://www.raspberrypi.org/downloads/raspbian/
is dated newer than September 2019

After applying that patch ...

Skip to Step 4

#### Step 3C Orange Pi (Zero) with Armbian
Booting an Orange Pi Zero or similar is tricky as there is no display/keyboard and you need the IP address to connect.
Insert the SD card then Ethernet and power. 
I found https://lucsmall.com/2017/01/19/beginners-guide-to-the-orange-pi-zero/ to be a useful guide if you have problems.
The best way appears to be to log into your router and look for "orangepi" or similar in the DHCP table. 
Lets assume its 192.168.0.55

`ssh root@1292.168.0.55`  and respond to password with the default `1234`

Change your password immediately - it should prompt you and create a new user, we recommend calling this "pi"

Set your timezone with:
```
  sudo dpkg-reconfigure tzdata
```

Typically you'll either want to a) connect to your WiFi access point and be a server on it,
OR b) have the Armbian act as a WiFi point itself.

If so, you can do this now, or come back and do this later. 

a) To setup for your wifi to access your Wifi access point.
```
sudo nano /etc/network/interfaces
```
And add these lines to the end, using your SSID (aka wifi name) and password
```
 auto wlan0
 iface wlan0 inet dhcp
 wpa-ssid <Your Access Point Name aka SSID>
 wpa-psk <Your WPA Password>
```
Then start it with
```
 sudo ifup wlan0
```
or b) to setup as a WiFi hotspot
`sudo armbian-config` choose `network` then `hotspot`
(Sorry for the incomplete notes, edits appreciated ... )
* At some point it asks to "select interface" I think this is the point to pick wlan0 though its unclear whether
  this is the WiFi interface to use, or for backhaul?
* TODO document process to change SSID
* Note that once setup, it can take a minute or two for the WiFi access point to be visible.
* Also note that it seems to pick unusual IP addresses, 172.24.1.1 was the gateway when I connected to it.

* If anyone knows how to set this up from the command line a PR would be appreciated.
* This doc might be helpful
  https://docs.armbian.com/User-Guide_Advanced-Features/#how-to-set-wireless-access-point
  
Skip to Step 4

#### Step 3C: Rachel  
  
* Insert the SD card and boot the RPI (RPI3 or RPI4 should work)
* If at all possible insert Ethernet, otherwise it will work over WiFi with some extra steps.
* Power up
* Connect your laptop to the RACHEL-Pi Wifi - it should give you an address like 10.10.10.xxx
* ssh to 10.10.10.xxx
* Login as `pi` with password `rachel`

Skip to Step 4

#### Step 3D: Intel Nuc

THe standard install is missing a few packages.
```
sudo apt update && sudo apt-get install curl net-tools ssh
```
Try `node --version` if it reports 8.x.x then you maybe running Ubuntu
which still seems stuck on old versions, version 10 or 12 are fine. 
```
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-cache policy nodejs # Should show v12.x.x,  v10.x.x is fine, anything less is going to be a problem.
sudo apt-get install -y nodejs
```
Skip to step 4
  
## Step 4 Run the installer to install dweb-mirror

By this point, the operating systems should be similar enough for our installation
script to work out any differences, so the easiest way to finish the install
is to run the installation script.

In a terminal window, or via `ssh raspberrypi` 

We normally install it as a standard node_module under your home directory, 

If you prefer to install it somewhere else, 
`cd` to that directory before and the rest of the instructions below should work,
 but will need `~` substituting with the directory you started in.


#### On most platforms (OrangePi+Armbian; Rasperry without Rachel; Mac OSX)
```
curl -o- -L https://unpkg.com/@internetarchive/dweb-mirror/install.sh | bash
```
If it fails, its safe to repeat this.

#### On Rachel on Raspberry Pi
There is a current problem running the script automatically, but this works...
```
curl -o/tmp/install.sh -L https://unpkg.com/@internetarchive/dweb-mirror/install.sh
chmod +x /tmp/install.sh
sudo /tmp/install.sh
```
If it fails, its safe to rerun `/tmp/install.sh`

## Step 5. (Optionally) Edit configuration

If you are doing anything non-standard, then you'll need to create and edit 
a local configuration file.  Otherwise the application will create it the first time its needed.
```
cd ~/node_modules/@internetarchive/dweb-mirror

cp ./dweb-mirror.config.yaml ${HOME} # Copy sample to your home directory and edit, 
```
and edit `$HOME/dweb-mirror.config.yaml` for now see `configDefaults.yaml` for inline documentation.

  * `directories` if you plan on using places other than any of those in dweb-mirror.config.yaml 
  (/.data/archiveorg, and any USBs on Rachel3+, NOOBS or IIAB)
  * `apps.crawl` includes a structure that lists what collections are to be installed, 
  I suggest testing and then editing
   
Note that directories specified in the config file can be written using familiar shell or unix conventions such as "~/" or "../".

### Step 6. Test crawling and browsing

### Step 6A Crawling
Crawling will happen automatically, but you can also test it manually.

From a command line:

```
cd ~/node_modules/@internetarchive/dweb-mirror && ./internetarchive -sc &
```
* starts the HTTP server
* It might take 10-15 seconds to start, be patient
* It should start crawling, and get just a minimal set of icons for the home page.
* the startup is a little slow but you'll see some debugging when its live.
* If you see a message like `Requeued fetch of https://dweb.archive.org/info failed` then it means it cannot see 
  the archive's servers (on `dweb.archive.org`) so it won't be able to crawl or cache initial material until you 
  connect to the WiFi or Ethernet. 

Without any other arguments, the crawl will read a set of files into into the first (already existing) directory
configured in `~/dweb-mirror.config.yaml` 
or if there are none there, it will look in its installation directory for `configDefaults.yaml`. 
If you haven't changed anything this will be `~/archiveorg`

Look in that directory, and there should be sub-directories appearing for each item, 
with metadata and/or thumbnails.

You can safely delete any of the crawled material and it will be re-fetched if needed.

See [README.md](./README.md) for advanced crawling - its quite a powerful tool.

### Step 6B Browsing

Open the web page - the address depends on the platform. 

* http://archive.local:4244 or http://archive:4244 should work on any platform, 
  but this depends on the configuration of your LAN.
* If you know the IP address then http:<IP Address>:4244 will work
* On MacOSX (or if using a browser on the RaspberryPi/OrangePi): http://localhost:4244
* On Rachel try http://rachel.local:4244 or http://rachel:4244
  or via the main interface at http://rachel.local and click Internet Archive

### Step 6C Troubleshooting

To troubleshoot you'll often need to check both the browser and server logs.

Browser logs on Firefox are in `Tools` > `Web Developer` > `Web Console` 
On Chrome its `View` > `Developer` > `Javascript Console`
In both these platforms problems are usually displayed in pink, and you can
ignore any "INSUFFICIENT RESOURCES" errors.

Server logs depend on the platform. 
* On Mac/OSX: (its in the same window you started the server from).
* On most platforms. 
```
service internetarchive status
```
Will get the status and most recent lines
```
journalctl -u internetarchive
```
Will get the most recent lines and 
```
journalctl -u internetarchive -f
```
Will track the log `ctrl-C` to exit.

On most platforms the logs are in `/var/log/daemon.log` if you want to analyse more deeply.

Look for any “FAILING” or "ERROR" log lines which may indicate a problem

## Step 7. Auto-starting

#### Step 7A: On anything except Mac OSX
The server will autostart at reboot, or if it crashes.
Restart your machine.

```
sudo shutdown -r
```
You'll need to log back into the box when it comes back up. 
Check the browser address (Step 6B) to see that its working, 
and
```
service internetarchive status
```
Should show it started and is pinging `/info`

#### Step 7B: On Mac OSX
TODO - Note that I've currently had problems with getting Mac OSX to start automatically
see [dweb-mirror issue#196](https://github.com/internetarchive/dweb-mirror/issues/196)

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

## Step 8. Updating

The software is frequently revised so its recommended to update, especially if you see any bugs or problems.

The quickest way is 
```
cd ~   # or wherever you started the process in 3a above.
yarn install
yarn upgrade    # Upgrade all packages
```

But you can also rerun the install procedure in Step 4, 
which will skip steps that have already completed 
and just update things that have changed.

## Finally

I recommend reading [README.md](./README.md) for more functionality, and [USING.md](./USING.md) for a tour.
