# Getting dweb-mirror to work on a Rachel/Worldpossible box

This is a work in progress - and hasn't been tried on a clean box, since many of the earlier attempts failed and I have no 
way to give it a full factory reset.

## Other places to look for the installation process include: TODO remove private references here
* gitlab / dweb / Dockerfile (internal to IA)
* ./install.sh
* ./README.md
* Evernote Rachel docs (internal to Mitra)

## Physical connection.

There are docs that come with the Rachel box and are worth reading, however they are inadequate for this task set.

If you have permission to do this then you'll know the passwords so we aren't putting it in this public repo! 

* Connect the Rachel box to the Ethernet, and connecting to the box ... 
  * either directly or for example on your laptop by sharing your WiFi connection over Ethernet to the box. 
* Press and hold power button till blue light comes on
* Either: To connect directly to the Rachel box from another device
  * Connect via WiFi to "Rachel"
  * Either: open browser window to `http://192.168.88.1` and click on Admin, 
    * then login with 'admin' and the password you should know
  * Or: `ssh 192.168.88.1` and 
    * login with user: `cap` and the password supplied (not the same password as for the browser)
* Or: if you are using a laptop to share your wifi connection and want to use your laptop, then:
  * first connect from another device to WiFi Rachel, 
  * open `192.168.88.1` in your browser,
  * look in the top right corner for the LAN address (for me its often `192.168.2.3` so you could try that as a shortcut)
  * On your Laptop, `ssh 192.168.2.3` or whatever address you found above 
    * and login with user: `cap` and the password supplied (not the same password as for the browser)
  * OR in browser open `http://192.168.2.3` and click on Admin, 
    * then login with 'admin' and the password you should know
  * In the docs below - use the address you found above instead of 192.168.88.1

* On browser window 
* http://192.168.88.1/admin/modules.php - for general administration, but we won't do this here. (next page is Hardware / Advanced)
* http://192.168.88.1:8080/  
  * Login, user is `admin` and not `Admin` as stated in the docs shipped with the box
  * you should have the password. 
* General Settings
  * Set to "Full Internet Access" and "wide area network"
  * Disable Captive Portal - at least for now. 
  * Save and Apply 

* In SSH
  * DONT DO THIS I BROKE MY BOX, requiring a full reinstall `sudo apt-get upgrade`

## Preliminaries to install
```
# Please send the result of this to me, I forgot to do this, so I'm not sure how much disk I'm using below. 
sudo df -k 
# Update the list of packages apt knows about. 
sudo apt-get update  
```

## Updating Node (buggy)
```
sudo node --version # Typically shows an antique version of node around version 4.x
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt-cache policy nodejs # Should show v10 but for some Rachel problem it only goes to v9 which is ok but sub-optimal
sudo apt-get install -y nodejs
sudo npm i -g npm # Update npm
```
Note there is an issue open on the community about this ...
[http://community.rachelfriends.org/t/installing-usable-version-of-node/1082/4]
but I'm not sure there is anyone currently on the project with sufficient linux expertise to figure out why this linux distro won't allow current node versions.

## Installing other tools
I did: `sudo apt-get install gcc g++ make` but I'm not sure any or all of these are required.  
If something below complains of their absence then go ahead, the only downside is significant disk usage especially for gcc & g++

Now get yarn - as probably going to end up using both npm and yarn
```
curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update && sudo apt-get install yarn
```

## Install dweb-mirror, for now installing globally.
```
cd /usr/local  # Various other places didn't work
```
Struggling as `npm install wrtc` fails tried ...
```
sudo npm install -g node-gyp 

went back to node 8.x (uninstall 9.x, run setup_8.x, check policy, install)
yarn install node-pre-gyp
yarn install cmake
yarn install wrtc
```

#sudo npm install node-pre-gyp    # I did this because next line fails without it, didn't help
sudo npm install @internetarchive/dweb-mirror # install -g didn't work

cd /usr/local

echo >package.json <<EOT
{
  "author": {
    "name": "Mitra Ardron",
    "email": "mitra@mitra.biz",
    "url": "http://www.mitra.biz"
  },
  "bugs": {
    "url": "https://github.com/internetarchive/dweb-mirror/issues"
  },
  "description": "Rachel install file for dweb-mirror",
  "dependencies": {
    "@internetarchive/dweb-archive": "latest",
    "@internetarchive/dweb-mirror": "git+https://git@github.com/internetarchive/dweb-archive.git#rachel",
  },
  "devDependencies": {
  },
  "homepage": "https://github.com/internetarchive/dweb-mirror#readme",
  "keywords": [],
  "license": "AGPL-3.0",
  "name": "ia_rachel_install",
  "scripts": {
  },
  "version": "0.1.36"
}
EOT
sudo npm install # Theoretically should work but didnt
sudo npm install @internetarchive/dweb-archive
sudo npm install @internetarchive/dweb-transports
cd @internetarchive/dweb-archive/dist && ln -s ../../dweb-objects/dweb-objects-bundle.js .
cd @internetarchive/dweb-archive/dist && ln -s ../../dweb-transports/dweb-transports-bundle.js .
#cd @internetarchive/dweb-archive/dist && cp -r includes/node_modules_dist dist/includes/node_modules  # May not be required since now not .gitignored

