#!/bin/bash

# This is a work in progress for getting dweb-mirror onto a Rachel/Worldpossible box
# Other places to look for the installation process include: TODO remove private references here





# * gitlab / dweb / Dockerfile (internal to IA)
# * ./install.sh
# * ./README.md
# * Evernote Rachel docs (internal to Mitra)

# Note this includes human readable as well as automatic steps

# ssh into the box, if you have permission to do this then you'll know the id/password :-)
# Press and hold power button till blue light comes on
# Connect via WiFi to "Rachel"
# ssh to 192.168.88.1
# Plugging into ethernet might also work, also plugging into ethernet will be required for the Rachel box to download things.
# TODO - figure out if can get Rachel to access internet via WiFi

# I also had to ...
# * navigate to admin / General settings, and turn off captive portal.
# *


# DONT DO THIS I BROKE MY BOX >>>sudo apt-get upgrade<<


# Should have checked capacity here
sudo apt-get update

# Node gets crappy older version 4.x
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt-cache policy nodejs # Should show v10
sudo apt-get install -y nodejs
#MAYBE NOT REQD# sudo apt-get install gcc g++ make
# Now get yarn - as probably going to end up using both npm and yarn
curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update && sudo apt-get install yarn


#/dev/mmcblk0p2  10368984   5421836   4397320  56% /
#/dev/sda1      961429204 556908172 355666572  62% /.data


# Install dweb-mirror, for now installing globally.
cd /usr/local  # Various other places didn't work
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
    "@internetarchive/dweb-mirror": "latest",
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

