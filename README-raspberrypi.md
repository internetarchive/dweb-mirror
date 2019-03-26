# dweb-mirror on Raspberry Pi 3

This is a work in progress - rewritten after first clean run on a new OS.

## See also
TODO-RPI find meta-task and document below
* [https://github.com/internetarchive/dweb-mirror/issues/xx] for meta task for anything Raspberry related.

## Initial setup

There are several alternatives
* Raspbian -> Internet In A Box -> dweb-mirror
* NOOBS -> dweb-mirror (see [./README-raspberrypi-noobs.md]

### A. Raspbian -> Internet In A Box -> dweb-mirror

TODO-IIAB TODO-RPI incorporate installer for node then dweb-mirror into IIAB installer

If your intention is to run on Internet In A Box then follow these two steps, 

#### Getting Raspbian working
Internet in a Box's site is short on the initial details, especially if your RPi comes with NOOBS as mine did. 
So this is what I did. (Edits welcome, if your experience differed)

* Downloaded Raspbian [Raspbian](https://www.raspberrypi.org/downloads/raspbian/) 1GB
* On a Mac, downloaded [Etcher](https://www.balena.io/etcher/) (100Mb)
* Ran Etcher (its supposed to be able to use the zip, thoguh for this test we used the .img from expanding hte zip), selecting a fresh 16GB SD card as the destination
* Inserted into Raspbian 3, and powered up with Kbd and HDMI and Mouse inserted. 
* I would have inserted Ethernet, but dont have anything faster than WiFi
* Powered up
* It prompted me for soem getting started things, 
* Accepted "Next to get started" though I suspect IIAB's comprehensive install gets some of them as well.
* Selected Australia / Australian English (there was no choice of language :-( ) and US kbd
* Changed password since RPis get hacked on default password
* Connected to WiFi
* It automatically Updated OS - this is big - take a break :-)
    * Note that this process failed for me with failures of size and sha, but a restart, after the prompts for password etc, 
    got me to a partially completed download so didn't have to start from scratch
* You might want to ... Menu/Preferences/Config / Set display to highest resolution

#### Internet In A Box
* Follow steps in [http://d.iiab.io/install.txt] with attention to [http://wiki.laptop.org/go/IIAB/FAQ]
    * Note its strongly recommended to connect your RPi to the Ethernet, rather than WiFi due to both to speed, and some bugs in the installer
* On a terminal window `curl d.iiab.io/install.txt | sudo bash`
    * Selected 1 for choice of min/medium/max install, others should work as well
    * Did not edit the .yml file
    * Update of OS was quick as it probably duplicated the step in the auto-setup above
    * expect it to fail, and keep running `sudo iiab` to get it to complete.    
    * It will prompt to reset password from default `iiab-admin/g0admin`
    * It enables SSH; 


Try login to `http://box.lan/admin`   id=`iiab-admin` pw=`whatever you set password to during install`

Also see [http://wiki.laptop.org/go/IIAB/FAQ]

And if you want to run as a local WiFi hotspot (recommended) then..
```
iiab-hotspot-on
```


### B. NOOBS -> dweb-mirror (i.e. without Internet In A Box)

Otherwise if you just want dweb-mirror running on a NOOBS based RPi try this. 

While it is unlikely that the process below is particularly fussy about a roughly normally configured RPi, 
the following notes might aid in a speedy setup on a new RPi.

We started with a standard preconfigured NOOBS MicroSD card that came with the box we got. 

After the reboot during the process:
* Change WiFi to connect
* Default userid = `pi`, password = `raspberry`, change these since SSH will be exposed below.
* Menu/Preferences/Config
  * Interfaces:SSH:Enabled
  * Set display to highest resolution that works for your display
  * Set Localization if not done during install
  * Reboots (as part of saving these changes)

In a terminal window, or via SSH to it. 
```
sudo apt-get update
# This next step now seems to happen during normal install, otherwise can be slow
sudo apt full-upgrade -y 
```

### Both platforms ... install dweb-mirror

--- not not checked on clean install of IIAB, but checked for NOOBS yet below here --- 


## Preliminaries to install

Both platforms (Raspbian/IIAB and NOOBS) need a current version of node, 
and we are in transition from npm to yarn so install both. 

--- not checked below here on either clean install of IIAB, or of  NOOBS  --- 

### Node
In terminal window or on SSH
```
node -v # was v4.8.2 on Rachel3+ which is ancient and v8 on Noobs and Raspbian in some cases, or missing in others.
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
# This warned that you might need `sudo apt-get install gcc g++ make` which I haven't done
sudo apt-cache policy nodejs # Should show v10 (on Rachel, only showed v9)
sudo apt-get install -y nodejs
```
### NPM
```
sudo npm i -g npm # Update npm
```

### Yarn
Note a plain `apt-get install yarn` will fail, and get the cmdtest instead, if you did this by mistake then `sudo apt-get remove cmdtest` before trying again
```
curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update && sudo apt-get install yarn
```

## Install dweb-mirror

Now follow the instructions in [README.md], come back here to finish things off

### RPi with NOOBS
No final steps required at the moment

### Raspberry + Internet In A Box
#### Open port 
TODO-IIAB integrate this fix into IIAB's release

If access to `http://<box ip address>:4244` fails, then ...
```
cd /usr/bin
sudo nano /opt/iiab/iiab/roles/network/templates/gateway/iiab-gen-iptables
```
* Around line 101 you'll find lines like
`$IPTABLES -A INPUT -p tcp --dport $kiwix_port -m state --state NEW -i $wan -j ACCEPT`
* Edit this to replace `$kwix_port` with `4244`
* Save 
```
cd /opt/iiab/iiab && sudo ./runrole network # Runs iiab-gen-iptables towards end
```
You may have to do this any time you update IIAB until dweb-mirror is built into it.

Also there is currently a bug in IIAB that requires a reboot after these installs or DNS lookup doesn't work.

