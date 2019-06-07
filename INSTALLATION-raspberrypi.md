# dweb-mirror on Raspberry Pi 3

This is a work in progress - rewritten after first clean run on a new OS.

If they dont work please email mitra@archive.org

## See also
* [https://github.com/internetarchive/dweb-mirror/issues/110] for meta task for anything Raspberry related.

There are several alternatives
* Raspbian -> Internet In A Box -> dweb-mirror (see [./INSTALLATION-iiab-raspberry.md])
* NOOBS -> dweb-mirror (see this document)


## NOOBS -> dweb-mirror

If you just want dweb-mirror running on a NOOBS based RPi (and don't want Internet In A Box) try this. 

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

## Preliminaries to install

We need a current version of node, 
and we are in transition from npm to yarn so install both. 


### Node
In terminal window or on SSH
```
node -v # was v4.8.2 on Rachel3+ which is ancient and v8 on Noobs and Raspbian in some cases, or missing in others.
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
# This warned that you might need `sudo apt-get install gcc g++ make` which I haven't done
sudo apt-cache policy nodejs # Should show v10 (on Rachel, only showed v9)
sudo apt-get install -y nodejs
node -v # Confirm it upgraded to 10.x
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

Now follow the instructions in [INSTALLATION.md] starting at step 2.