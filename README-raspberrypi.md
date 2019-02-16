# dweb-mirror on Raspberry Pi 3

This is a work in progress - and hasn't been tried on a clean box, since many of the earlier attempts failed 
and I have not had time to give it a full factory reset.

## See also
TODO-RPI find meta-task and document below
* [https://github.com/internetarchive/dweb-mirror/issues/xx] for meta task for anything Raspberry related.

## Initial setup

While it is unlikely that the process below is particularly fussy about a roughly normally configured RPi, 
the following notes might aid in a speedy setup on a new RPi.

We started with a standard preconfigured NOOBS MicroSD card that came with the box we got. 

After the reboot during the process:
* Change WiFi (not sure where) to connect
* Default userid = `pi`, password = `raspberry`, change these since SSH will be exposed below.
* Menu/Preferences/Config
  * Interfaces:SSH:Enabled
  * Set display to highest resolution
  * Set Localization
  * Reboots (as part of saving these changes)

## Preliminaries to install

In a terminal window, or via SSH to it. 
```
node -v # was v4.8.2 which is ancient
sudo apt-get update
sudo apt full-upgrade -y # Take a long break 
```
### Node
In terminal window or on SSH
```
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt-cache policy nodejs # Should show v10 (on Rachel, only showed v9)
sudo apt-get install -y nodejs
sudo npm i -g npm # Update npm
```

### Yarn
Note a plain apt-get install yarn` will fail, and get the cmdtest instead, if you do this by mistake then sudo apt-get remove cmdtest before trying again
```
curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update && sudo apt-get install yarn
