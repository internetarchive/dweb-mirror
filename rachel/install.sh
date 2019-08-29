#!/bin/sh
#set -x
#TODO merge with install_armbian.sh
echo "Installer: Adding yarn sources"
curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

set +e # update often fails slightly
echo "Installer: Apt update"
sudo apt-get update

echo "Installer: Upgrading all Apt packages"
sudo dpkg --configure -a # Clear out any previous locks/interrupted opts - especially kolibri install
sudo apt-get upgrade    # Make sure running latest version
sudo apt -y autoremove

set -e
echo "Installer: Installing nodejs, npm yarn git libsecret; and for usb mounting: debhelper exfat-fuse"
sudo apt-get install -y nodejs npm yarn git libsecret-1-dev debhelper exfat-fuse

echo "Installer: Updating npm"
sudo npm i -g npm

echo "Installer: Creating cache directory"
sudo mkdir -p "/.data/archiveorg"
sudo chown ${USER} /.data/archiveorg

echo "Installer: Adding yarn package node-pre-gyp"
sudo yarn global add node-pre-gyp

echo "Installer: Adding yarn package cmake"
[ -d node_modules/cmake ] || [ -d /usr/local/share/.config/yarn/global/node_modules/cmake/ ] || sudo yarn global add cmake

echo "Installer: yarn install or update internet archive"
cd ${HOME}
yarn config set child-concurrency 2
if [ -d node_modules/@internetarchive/dweb-mirror ]
then
  yarn install
  yarn upgrade
else
  yarn add @internetarchive/dweb-mirror @internetarchive/dweb-archive
  yarn install
fi

echo "Installer: Switching directories into dweb-mirror"
cd ${HOME}/node_modules/@internetarchive/dweb-mirror

echo "Installer: Installing service"
sudo mv rachel/files/internetarchive.service /etc/systemd/system

echo "Installer: Setting server to start at boot"
sudo systemctl enable internetarchive.service

echo "Installer: Starting server"
sudo systemctl start internetarchive.service

echo "Installer: Copying module"
sudo rm -rf /var/www/modules/en-internet_archive
sudo mv rachel/en-internet_archive /var/www/modules/
sudo chown -R www-data:www-data /var/www/modules/en-internet_archive

echo "Installer: Cloning or updating usbmount"
cd /var/tmp
if [ -d usbmount ]
then
	cd usbmount
	git pull
else
	git clone https://github.com/rbrito/usbmount.git
	cd usbmount
fi
echo "Installer: Building usbmount"
dpkg-buildpackage -us -uc -b
cd ..
echo "Installer: Installing usbmount"
sudo apt install -y ./usbmount_0.0.24_all.deb

echo "Installer: Editing /etc/usbmount/usbmount.conf in place"
sudo sed 's/FILESYSTEMS=.*/FILESYSTEMS="vfat ext2 ext3 ext4 ntfs-3g ntfs exfat hfsplus fuseblk"/' -i- /etc/usbmount/usbmount.conf

echo "Installer: Installation complete"
