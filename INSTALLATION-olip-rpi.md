# Installation instructions for dweb-mirror on OLIP on Raspberry Pi 3 or 4

If you not installing dweb-archive+IIAB on a Raspberry Pi then one of these documents 
will be much easier to follow. 

 * Mac OSX [INSTALLATION-osx.md](./INSTALLATION-osx.md)
 * Internet In A Box (IIAB) on Rasberry Pi [INSTALLATION-iiab-rpi.md](./INSTALLATION-iiab-rpi.md)
 * Offline Internet Platform (OLIP) on Rasberry Pi [INSTALLATION-olip.md](INSTALLATION-olip-rpi.md)
 * Raspberry Pi without IIAB or OLIP [INSTALLATION-rpi.md](./INSTALLATION-rpi.md)
 * Rachel on the 3+ [INSTALLATION-rachel.md](./INSTALLATION-rachel.md) 
 * Rachel on the RPI [INSTALLATION-rachel-rpi.md](./INSTALLATION-rachel-rpi.md) 
 * Mac OSX Developer [INSTALLATION-osx-dev.md](INSTALLATION-dev.md)
 * Everything in one doc [INSTALLATION-work.md](./INSTALLATION-work.md)
 * TODO developer instructions on other platforms.

If anything here doesn't work please email mitra@archive.org
or it would be even more helpful to post a PR on https://github.com/internetarchive/dweb-mirror 

NOTE (2020-02-04) OLIP is itself very experimental, as is our use of it, expect this to fail

## See also
* [README.md](./README.md) for more general information
* [issue #263](https://github.com/internetarchive/dweb-mirror/issues/263) for meta task for anything related to OLIP.

## Step 1 Initial setup - getting Raspbian

If your Raspberry Pi comes with Raspbian you are in luck, skip to Step 1B, 
otherwise if it comes with NOOBS (as most do now) you'll need to replace it with Raspbian.

This is what I do. (Edits welcome, if your experiences differ)

* Downloaded Raspbian [Raspbian](https://www.raspberrypi.org/downloads/raspbian/) to your laptop (~1GB)
  * Any of the distributions should work - I test on the Desktop version
* On a Mac:
  * downloaded [Etcher](https://www.balena.io/etcher/) (100Mb)
  * Run Etcher (its supposed to be able to use the zip, though for this test we used the .img from expanding hte zip), selecting a fresh 16GB SD card as the destination
* On Windows or Linux, 
  * I'm not sure the appropriate steps instead of Etcher. 
* Inserted into Raspbian 3 or 4, and powered up with Kbd and HDMI and Mouse inserted. 
* If at all possible insert Ethernet, otherwise it will work over WiFi with some extra steps.
* Power it up
* It prompted me for some getting started things, 
* Accepted "Next to get started".
* Selected your country, language, keyboard - it shouldnt matter which.
* Changed password since RPis get hacked on default password
* Connected to WiFi (not necessary if you have Ethernet connected)
* It automatically Updated OS - this can take a long time - take a break :-)
    * Note that this process failed for me with failures of size and sha, or with timeouts, 
      but a restart, after the prompts for password etc, 
      got me to a partially completed download so I did not have to start from scratch
* You might want to ... Menu/Preferences/Config / Set display to highest resolution
* You probably want `Menu/Raspberry Pi Configuration/Interfaces/SSH enable` so that you can SSH 
  into the box rather than use attached keyboard and screen.

## Step 1B Workaround for Raspbian bug
Raspbian has a bug that requires a patch until they push it to a new release. 
It looks from https://github.com/raspberrypi/linux/issues/3271 like you need to do 
```
sudo rpi-update
```
This should only be applicable until the Raspbian available at 
https://www.raspberrypi.org/downloads/raspbian/
is dated newer than September 2019

## Step 2 Install Offline Internet Platform (OLIP)

Note its strongly recommended to connect your RPI to the Ethernet, 
rather than WiFi because OLIP (currently) has a number of bugs that appear if you do not connect to its own hotspot

Internet Archive is accessible from the OLIP catalog after this step.

These instructions come from:
http://bibliosansfrontieres.gitlab.io/olip/olip-documentation/olip/installation/ 

They might get updated there as OLIP evolves.

Open a terminal window. 

Note - use `olip.local` so that it is shared with MDNS where networks expect to see things. 
`olip.lan` as in the docs is likely to fail.

```
curl -sfL https://gitlab.com/bibliosansfrontieres/olip/olip-deploy/raw/master/go.sh |\
sudo bash -s -- --name olip --url olip.local --descriptor http://drop.bsf-intranet.org/olip/conf-arm32v7
```
to install it.

When its finished - the WiFi does not (currently) appear, so reboot to bring the WiFi hotspot up.
(see https://gitlab.com/bibliosansfrontieres/olip/olip-deploy/issues/7)

Connect to the WiFi typically called "OLIP".

Note: several bugs in OLIPs redirects mean that connecting via the Ethernet (to e.g. `olip.local`) are likely to fail.
See https://gitlab.com/bibliosansfrontieres/olip/olip-deploy/issues/6

- Go to http://olip.local/home
- Login with username: admin password: admin

It will frequently give you a sql error. 
https://gitlab.com/bibliosansfrontieres/olip/olip-dashboard/issues/31
Reloading the page might work, it that doesn't then a reboot of teh box did not work. 

- `Catalog > Internet Archive > Download`, it should change to `Downloading` and then `Downloaded`
  note, its getting a Docker image, so its going to be a lot slower, than installation on other platforms, but not outrageous.
- `Applications > Downloaded > dweb-mirror > Install`, this is surprisingly quick 
- `Home > Internet Archive`, should bring up the app

### 3. Edit configuration

If you are doing anything non-standard, then you'll need to create and edit 
a local configuration file.  Otherwise the application will create it the first time its needed.

```
ssh pi@olip.local
cd /data/dweb-mirror.app
sudo cp dweb-mirror.config.yaml dweb-mirror.initial.yaml # Make a backup - there is a good chance you will need it
```
and edit `dweb-mirror.config.yaml` for now see `configDefaults.yaml` for inline documentation.

  * `directories` wont currently work on OLIP as other volumes are not visible in the docker.
    see https://gitlab.com/bibliosansfrontieres/olip/olip-api/issues/20
  * `apps.crawl` includes a structure that lists what collections are to be installed, 
  I suggest testing and then editing
   
Note that directories specified in the config file can be written using shell or unix conventions such as "~/" or "../".

### 4. Test crawling

#### Crawling
Running crawling separately is not currently possible in OLIP.
 
Running some `balena-engine` command to get into the app and then running `internetarchive -c` might work,
but I haven't figured it out yet. 

### 5 Debugging

See http://bibliosansfrontieres.gitlab.io/olip/olip-documentation/olip/knowledge-base/debug-an-app/
for basics on viewing logs etc. 


## 8. Updating

The software is frequently revised so its recommended to update, especially if you see any bugs or problems.

TODO - write instructions
