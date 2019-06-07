# dweb-mirror on Rachel 3+ (from WorldPossible)

This is a work in progress - and hasn't been tried on a clean box, since many of the earlier attempts failed and I have no 
way to give it a full factory reset.

## See also
* [https://github.com/internetarchive/dweb-mirror/issues/93] for meta task for anything Rachel related.

## Physical connection.

There are docs that come with the Rachel box and are worth reading, however they are inadequate for this task set.

If you have permission to do this then you'll know the passwords so we are not putting it in this public repo! 

* There are two ways to physically connect the Rachel3+ to the internet either directly via the Internet or via your laptop's Wifi.

#### Either connect Direct to Ethernet
* Connect the Rachel box to the Ethernet - it may care which socket its plugged into. 
* Press and hold power button till blue light comes on then wait for WiFi to start flashing (can take a few minutes)
* On your laptop, connect via WiFi to "Rachel"
    
#### OR via Laptop's WiFi.
* Connect the Rachel box via Ethernet to your laptop - it may care which socket its plugged into. 
* first connect from another device to WiFi Rachel, 
* open `192.168.88.1` in your browser,
* look in the top right corner for the LAN address (for me its often `192.168.2.3` so you could try that as a shortcut)
* On your Laptop, `ssh 192.168.2.3` or whatever address you found above 
  * and login with user: `cap` and the password supplied (not the same password as for the browser)
* OR in browser open `http://192.168.2.3` and click on Admin, 
  * then login with 'admin' and the password you should know
* The docs below assume you are connecting to 192.168.88.1, substitute the address you found above instead

## Configure via browser window 
* [http://192.168.88.1/admin/modules.php] - for general administration, but we won't do this here. (next page is Hardware / Advanced)
* [http://192.168.88.1:8080/]
  * Login, user is `admin` and not `Admin` as stated in the docs shipped with the box
  * you should have the password. 
* General Settings
  * Set to "Full Internet Access" and "wide area network"
  * Disable Captive Portal - at least for now. 
  * Save and Apply 

## Preliminaries to install
```
# Please send the result of this to me, I forgot to do this, so I'm not sure how much disk I'm using below. 
sudo df -k 
# Update the list of packages apt knows about. 
sudo apt-get update  
```

## Installing other tools (via SSH)

* Or: `ssh 192.168.88.1` and 
  * login with user: `cap` and the password supplied (not the same password as for the browser)
* DONT DO THIS I BROKE MY BOX, requiring a full reinstall `sudo apt-get upgrade`

#### compilation tools gcc etc
* I did: `sudo apt-get install gcc g++ make` but I'm not sure which of these were actually required.
  * TODO on fresh machine try without these tools and edit this comment.
  * g++ is certainly required for nvm below 
  * If something below complains of the other's absence then go ahead and install, the only downside is significant disk usage especially for gcc & g++

#### yarn
Now get yarn - as probably going to end up using both npm and yarn
```
curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update && sudo apt-get install yarn
```

#### Updating Node (buggy)

Many tools now require Node v10 to work, but Node no longer supports 32 bit by default. 
Note there is an issue open on the community about this ...
[http://community.rachelfriends.org/t/installing-usable-version-of-node/1082/4]
and Refael Ackermann from the node-js team is helping. 

This next list only gets to v9 at present, its worth looking at `/etc/apt/sources.list.d/nodesource.list` if debugging this.
```
sudo node --version # Typically shows an antique version of node around version 4.x
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt-cache policy nodejs # Should show v10 but for some Rachel problem it only goes to v9 which is ok but sub-optimal
sudo apt-get install -y nodejs
sudo npm i -g npm # Update npm
```
So alternatively via NVM
```
touch ~/.bash_profile # Nvm needs it to at least exist
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
source ~/.bash_profile
nvm install node # Should compile 10.13.0 or later from source using the g++ installed earlier !!SLOW!!
node -v # Check its 10.x 
```
TODO-RACHEL figure out the issues around `path` etc for services accessing node and use whatever Rafael produces.

## Now continue from the general INSTALLATION.md starting at step 2.

## Step 7 - Auto running
* TODO-RACHEL - hook into supervisorctl etc [http://community.rachelfriends.org/t/starting-at-boot-supervisorctl/1202]
  * THEN TODO-RACHEL - auto start mirrorHttp
* TODO-RACHEL - run crawl under cron
* TODO-RACHEL - maybe setup easy auto-update process
* TODO-RACHEL - integrate into menus [http://community.rachelfriends.org/t/integrating-into-the-main-user-facing-menu/1203]
