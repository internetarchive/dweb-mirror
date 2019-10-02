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
 * Armbian on OrangePi or similar [INSTALLATION-armbian.md](./INSTALLATION-armbian.md)
 * Mac OSX Developer [INSTALLATION-osx-dev.md](./INSTALLATION-osx-dev.md)
 * Yunohost [INSTALLATION-yunohost.md](./INSTALLATION-yunohost.md)
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

### Armbian on Orange Pi
* https://github.com/internetarchive/dweb-mirror/issues/224

## 1. Getting your machine ready.

This is important, as the installation instructions does not work without some preliminary upgrades,
especially for some of the smaller platforms.

### Preparing Operating System

If you are working a Raspberry Pi or similar machine booted from an SD card, 
you'll need to download the operating system, and burn an SD

#### Downloading Operating System on another machine

* For IIAB on a PI. 
  Any from [Raspbian](https://www.raspberrypi.org/downloads/raspbian/). 
  We test on the desktop version.
* For Rachel on a PI. 
  The temporary [Raspbian Buster + Rachel](http://rachelfriends.org/downloads/public_ftp/rachelpi_64EN/rachelpi_2019/rachel-pi_kolibi_buster_unofficial.7z) image
* RPI3 without IIAB or Rachel usually comes with NOOBS
* RPI4 without IIAB or Rachel.
  The current Canakit shipment doesn't have NOOBS so:
  [NOOBS](https://www.raspberrypi.org/downloads/noobs/)
* Armbian on OrangePi
  From [Armbian](https://www.armbian.com/download/)
  Pick the exact model and choose the Debian (Buster) over the Ubuntu
* Yunohost on RPI (probably on others do)
  From [Yunohost](https://yunohost.org/#/images) pick the current image (this is tested on 3.4.2)
  Note as of Sept 2019, the image the image is dated Feb 2019 and wouldnt boot on my RPI4.

#### Blow this to a SD

* On a Mac for anything except NOOBS
  * downloaded [Etcher](https://www.balena.io/etcher/) (100Mb)
  * Run Etcher (it can use a .img or a .zip but for any image in .7z you'll need to expand it first), 
  * Select a fresh 16GB or bigger SD card as the destination - bigger cards means more content

* For NOOBS
  * Unzip it
  * On a Mac format open "Disk Utilities" and Erase the SD card with format "FAT".
  * Copy the NOOBS files to the SD card.

* On Windows or Linux, I'm not sure the appropriate steps instead of Etcher. 

You can now boot your machine.

### 1A: IIAB only: Initial setup - getting Raspbian

* Inserted SD into Raspbian 3, and powered up with Kbd and HDMI and Mouse inserted. 
* If at all possible insert Ethernet, otherwise it will work over WiFi with some extra steps.
* Powered up
* It prompted me for some getting started things, 
* Accepted "Next to get started" though I suspect IIAB's comprehensive install gets some of them as well.
* Selected your country, language, keyboard - it shouldnt matter which.
* Changed password since RPis get hacked on default password
* Connected to WiFi (not necessary if you have Ethernet connected)
* It automatically Updated OS - this can take a long time - take a break :-)
    * Note that this process failed for me with failures of size and sha, or with timeouts, 
      but a restart, after the prompts for password etc, 
      got me to a partially completed download so I did not have to start from scratch
* You might want to ... Menu/Preferences/Config / Set display to highest resolution

* if you chose the 'Buster Lite' I'd recommend opening a terminal window and trying `apt update && apt get -y libsecret-1-dev`, 
as we saw problems related to Raspbian Lite on Rachel

### 1C: World-Possible/Rachel on Rachel 3+
See [./INSTALLATION-rachel.md](./INSTALLATION-rachel.md]), installation instructions are not complete
so they haven't been incorporated here yet.

### 1D: World-Possible/Rachel on Raspberry Pi
* Insert the SD card and boot the RPI (RPI3 or RPI4 should work)
* If at all possible insert Ethernet, otherwise it will work over WiFi with some extra steps.
* Power up
* Connect to the RACHEL-Pi Wifi - it should give you an address like 10.10.10.xxx
* ssh to 10.10.10.10
* Login as `pi` with password `rachel`

### 1E: Raspbian without IIAB or Rachel

On RPI3's insert the NOOBS SD that usually comes with the PI, 
and follow on-screen instructions to install Raspbian (we use the desktop version).

On RPI4's the ones we've seen don't have a SD card and we used the NOOBS image prepared above.
 
* Plug the card into the RPI4, along with a power supply 
  * (beware, the RPI4 is very picky about USB-C supplies, if the supply works the LED will turn on)
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

### 1F: Armbian e.g. on OrangePi
I found https://lucsmall.com/2017/01/19/beginners-guide-to-the-orange-pi-zero/ to be a useful guide if you have problems.

Booting an Orange Pi Zero or similar is tricky as there is no display/keyboard and you need the IP address to connect.
Insert the SD card then Ethernet and power. 
Note Arbinan doesn't work with the common trick of `ping 192.0168.0.255` followed by `arp -a` to find new machines on your net.
The best way appears to be to log into your router and look for "orangepi" or similar in the DHCP table. 
Lets assume its 192.168.0.55

`ssh root@1292.168.0.55`  and respond to password with the default `1234`

Change your password immediately - it should prompt you.

Update and configure :
```
sudo apt-get update
sudo apt-get -y upgrade
sudo dpkg-reconfigure tzdata
```

#### 1F-wifi: WiFi on Armbian
Typically you'll either want to connect to your WiFi access point and be a server on it,
OR have the Armbian act as a WiFi point itself.

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

### 1H: Yunohost (tested on Raspberry Pi 3 only)
If this fails, or if you want something slightly different from my example then
check Yunohost's instructions but beware the project is in its early days and 
 at the time of writing they were seriously inaccurate )
* Insert the SD card and boot
* Finding the box can be tricky, there are a bunch of ways suggested at https://yunohost.org/#/ssh
  but the easiest (for me) method was missing. 
  The default name of the box is `raspberrypi` so in a lot of cases, 
  until you do the `postinstall` step,  
  `ssh root@raspberrypi` will work. 

Next steps are simplified from https://yunohost.org/#/postinstall
You can do the next step in the browser but there is no feedback when it fails - as it did for me, 
  so I'd recommend using the command line. 
  
If you dont have a domain pick a name YOURDOMAIN is the example I'm using, and a good password.
```
ssh root@raspberrypi
password: yunohost
raspberrypi# yunohost tools postinstall
Main domain: YOURDOMAIN.nohost.me
New administration password: YOURPASSWORD
Confirm administration password: YOURPASSWORD
```
It should then complete the process reasonably quickly.

If you are runnng behind a router you have to setup port forwarding, this is tricky. 
Yunohost's instructions are at https://yunohost.org/#/isp_box_config , I haven't tested them.

Theoretically you should be able to access it at https://YOURDOMAIN.nohost.me/yunohost/admin 
but this didn't work for me not even when port forwarding was added. 

### 1H: Other machines including OSX but (not Raspberry Pi (IIAB, Rachel or raw) or Rachel3+)

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
Type `git --version` in a Terminal window, you want git v2.0.0 or better.

##### ON MAC OSX 
if Git isnt installed then it should prompt you to install Xtools command line tools, accept ...

##### ON OTHER LINUX MACHINES
If is not installed or lower than v2.0.0 then See [Atlassian Tutorial](https://www.atlassian.com/git/tutorials/install-git)

#### NODE
Try `node --version`, it should report v10 or better, but it was v4.8.2 on Rachel3+ 
and v8 on Noobs and Raspbian in some cases, or missing in others.
 
  * try `sudo apt-get -y nodejs` which works on many platforms
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
Node will almost always come with some version of NPM, 
if not (e.g. when installed with apt-get on Armbian), then `sudo apt-get -y npm` should get it. 
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
yarn global add node-pre-gyp cmake
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

* 2A: dweb-mirror as a server on Rachel 3+ or RPI3 or RPI4
* 2B: For developers only on OSX or Linux
* 2C: Internet in a Box
* 2D: Orange Pi / Armbian
* 2E: Rachel on RPI

#### 2A. dweb-mirror as a server (tested on Rachel 3+ and RPi3)

We will install it as a standard node_module under your home directory.

Create a top level cache directory.

This has to be called `archiveorg` but can be in your home directory (if you plan
on running the server there) or can be in `/.data`, `/library` or at the top
level of any disk e.g.

```
mkdir -p "${HOME}/archiveorg" && chown ${USER} ~/archiveorg
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

The easiest one line way is to run the installation script 
```
curl -o- -L https://unpkg.com/@internetarchive/dweb-mirror/install_dev.sh | bash
```
by defaults it will install in the git subdirectory of wherever you are running this
you could alternatively download that script and edit the location where you want to install. 

Either way, it will install all the repos that are part of the dweb-mirror system and link them together. 

## 2C IIAB ONLY: Install Internet In A Box

### Internet Archive is in the IIAB distribution.

Note its strongly recommended to connect your RPi to the Ethernet, rather than WiFi due to both to speed, 
and some bugs in the IIAB installer

Open a terminal window. 

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
* expect the isntall to fail, and keep running `sudo iiab` to get it to complete.       
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

#### 2D Orange Pi
The easiest way is to run the installation script
```
 curl -o- -L https://unpkg.com/@internetarchive/dweb-mirror/install_armbian.sh | bash
```

#### 2E Rachel on Pi
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

#### Crawling
Crawling will happen automatically, but you can also test it manually.

From a command line:

On IIAB 
```
cd /opt/iiab/internetarchive/node_modules/@internetarchive/dweb-mirror && sudo ./internetarchive -sc
```
On any other platform
```
cd ~/node_modules/@internetarchive/dweb-mirror && ./internetarchive -sc &
```
* starts the HTTP server
* It might take 10-15 seconds to start, be patient
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

#### Browsing

The address to go to is platform dependent.

* On IIAB try: http://box.local:4244 or http://box.lan:4244 or via the main interface at http://box.local and click on Internet Archive
* On Rachel: http://rachel.local:4244 or http://rachel:4244 or via the main interface at http://rachel.local and click Internet Archive
* When on a browser on the same machine: http://localhost:4244
* On any LAN that supports MDNS (Bonjour) http://archive.local:4244

#### Troubleshooting
If you don’t get a Archive UI then look at the server log 
```
service internetarchive status
```
Will get the status and most recent lines
```
journalctl -u internetarchive -f
```
will watch the log, `Ctrl-C` will end this.

One some machines (e.g. Rachel on RPI) journalctl is missing, in which case ...
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

### 6. IPFS (optional and not recommended on small machines)
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

### Rachel/RPI
Its built into the installer, so should be automatic

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

### On IIAB 
Updating is a three step process due to some (current) weaknesses in each step 
```
sudo su
cd /opt/iiab
git pull
./runrole internetarchive
cd /opt/iiab/internetarchive
sudo yarn update
```
### For anyone except developers or IIAB
The software is frequently revised so its recommended to update, especially if you see any bugs or problems.

The quickest way is 
```
cd ~   # or wherever you started the process in 3a above.
yarn install
yarn upgrade    # Upgrade all packages
```

But you can also rerun the install procedure in Step 2, which will skip steps that have 

### For Developers
```
cd ~/git/dweb-mirror
git pull
yarn install
yarn upgrade
# Note there is an intentional feature/bug, in npm and possibly in yarn in that it that doesnt 
# automatically run an "update" script. 
yarn run update 
```
