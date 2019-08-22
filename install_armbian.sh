#!/usr/bin/env bash
cat <<EOT
  This script is intended to automate installation on an Armbian and has been tested on an Orange Pi Zero

  This script can be run multiple times without problems.

  The easiest way to run is

  curl -o- -L https://unpkg.com/@internetarchive/dweb-mirror/install_armbian.sh | bash

EOT
set -e # Break on error
#set -x # Lets see whats happening

function step {
  STEPALL=$*
  STEPNUMBER=$1
  shift
  STEPNAME="$*"
  echo "${STEPNUMBER}" > /tmp/step
  echo "===== STEP ${STEPALL} ========"
}
step 1 "Updating Operating System"
sudo apt-get update
sudo apt-get -y upgrade
sudo dpkg-reconfigure tzdata
step 2 "Install Node"
sudo apt-get install -y nodejs
#step 3 "Install and update NPM"
#sudo apt-get install -y npm
#sudo npm install npm@latest -g
step 4 "Install yarn"
if ! yarn --version
then
  echo "==== Yarn not found, installing it ==========================="
  curl -o- -L https://yarnpkg.com/install.sh | bash
fi
source ~/.bashrc # fixes path
step 5 "Install global packages"
if [ ! -d /home/pi/.config/yarn/global/node_modules/cmake ]
then
  yarn global add cmake
fi
if [ ! -d /home/pi/.config/yarn/global/node_modules/node-pre-gyp ]
then
  yarn global add node-pre-gyp
fi
step 6 "Create directory for content"
mkdir -p "${HOME}/archiveorg" && chown ${USER} ~/archiveorg
step 7 "Adding Packages needed for dweb"
sudo apt-get install -y libsecret-1-dev
# Maybe need pkg-config
step 8 "Adding dweb-mirror and dweb-archive"
yarn config set child-concurrency 1 # Avoid memory overload
if [ -d node_modules/@internetarchive/dweb-mirror -a -d node_modules/@internetarchive/dweb-archive ]
then
  yarn install
  yarn upgrade
else
  yarn add @internetarchive/dweb-mirror @internetarchive/dweb-archive
fi
step 9 "Setup service to autostart"
cat ${HOME}/node_modules/@internetarchive/dweb-mirror/internetarchive.service \
| sed -e "s:{{ internetarchive_dir }}:${HOME}:" | sed -e "s:User=root:User=${USER}:" >/tmp/internetarchive.service
diff /tmp/internetarchive.service /lib/systemd/system || sudo cp /tmp/internetarchive.service /lib/systemd/system
[ -s  /etc/systemd/system/multi-user.target.wants/internetarchive.service ]  || sudo ln -s  /lib/systemd/system/internetarchive.service /etc/systemd/system/multi-user.target.wants
sudo systemctl daemon-reload
sudo service internetarchive start

cat <<EOT
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
* Note that once setup, it can take a minute or two for the WiFi access point to be visible.
* Also note that it seems to pick unusual IP addresses, 172.24.1.1 was the gateway when I connected to it.

* If anyone knows how to set this up from the command line a PR would be appreciated.
* This doc might be helpful
  https://docs.armbian.com/User-Guide_Advanced-Features/#how-to-set-wireless-access-point

EOT
