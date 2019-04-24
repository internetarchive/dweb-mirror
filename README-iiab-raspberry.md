# dweb-mirror on IIAB on Raspberry Pi 3

This is a work in progress - rewritten after first clean run on a new OS.

If they dont work please email mitra@archive.org

## See also
* [https://github.com/internetarchive/dweb-mirror/issues/111] for meta task for anything IIAB.
* [./README-raspberrypi.md] for a non IIAB install of dweb-mirror

## Initial setup - getting Raspbian

If your Raspberry Pi comes with Raspbian you are in luck, skip this, 
otherwise if it comes with NOOBS (as most do now) you'll need to replace it with Raspbian.

Internet in a Box's site is short on the initial details, especially if your RPi comes with NOOBS as mine did. 
So this is what I did. (Edits welcome, if your experience differed)

* Downloaded Raspbian [Raspbian](https://www.raspberrypi.org/downloads/raspbian/) 1GB
* On a Mac, downloaded [Etcher](https://www.balena.io/etcher/) (100Mb)
* Ran Etcher (its supposed to be able to use the zip, thoguh for this test we used the .img from expanding hte zip), selecting a fresh 16GB SD card as the destination
* Inserted into Raspbian 3, and powered up with Kbd and HDMI and Mouse inserted. 
* If at all possible insert Ethernet, otherwise it will work over WiFi with some extra steps.
* Powered up
* It prompted me for some getting started things, 
* Accepted "Next to get started" though I suspect IIAB's comprehensive install gets some of them as well.
* Selected your country, language, keyboard - it shouldnt matter which.
* Changed password since RPis get hacked on default password
* Connected to WiFi (not neccessary if you have Ethernet connected)
* It automatically Updated OS - this is big - take a break :-)
    * Note that this process failed for me with failures of size and sha, but a restart, after the prompts for password etc, 
    got me to a partially completed download so didn't have to start from scratch
* You might want to ... Menu/Preferences/Config / Set display to highest resolution

## Install Internet In A Box

I'm following (but editing) steps in [http://d.iiab.io/install.txt] with attention to [http://wiki.laptop.org/go/IIAB/FAQ]

Note its strongly recommended to connect your RPi to the Ethernet, rather than WiFi due to both to speed, and some bugs in the IIAB installer

#### Until Internet Archive is in the default IIAB distribution do this ...
    
    * `sudo bash` # All of this needs to run as root
    * `curl -o /usr/sbin/iiab https://raw.githubusercontent.com/iiab/iiab-factory/master/iiab`
    * `nano /usr/sbin/iiab`
    * At about line 179 change `git clone https://github.com/iiab/iiab --depth 1` 
    * to `git clone https://github.com/mitra42/iiab -b distweb --depth 1`
    * which will get IIAB from my temporary distro.

#### Once Internet Archives is in the default repo, you'll be able to do
    
    * `sudo curl d.iiab.io/install.txt | sudo bash`

#### Either way ... 

    * Selected 1 for choice of min/medium/max install, others should work as well
    * Did not edit the .yml file
    * Update of OS was quick as it probably duplicated the step in the auto-setup above
    * expect it to fail, and keep running `sudo iiab` to get it to complete.    
    * It will prompt to reset password from default `iiab-admin/g0admin`
    * In theory it enables SSH, but sometimes after the OS upgrade to enable it I've had to:
      * login from an attached keyboard, 
      * Preferences > Services > SSH > enable

#### Check it worked 

In a browser open: `http://box.lan/admin`   id=`iiab-admin` pw=`whatever you set password to during install`

* Note that I've found that `box.lan` doesn't work as documented, and that `box.local` is required instead. 
  See [IIAB Issue#1583](https://github.com/iiab/iiab/issues/1583)
  
Now check dweb-mirror was installed by opening `http://box.local:4244`
  
Also see [http://wiki.laptop.org/go/IIAB/FAQ] if it failed

And if you want to run as a local WiFi hotspot (recommended) then from the ssh prompt..
```
iiab-hotspot-on
```

#### Configuration

You may want to look at step 4 (Edit configuration) on [./README.md] though the default configuration should be correct unless you want to do something odd.

