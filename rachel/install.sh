#!/bin/sh

echo "Installer: Apt update"
apt-get update

echo "Installer: Installing nodejs"
apt-get install -y nodejs

echo "Installer: Installing npm"
apt-get install -y npm

echo "Installer: Updating npm"
npm i -g npm

echo "Installer: Adding yarn sources"
curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

echo "Installer: Apt Update"
apt-get update

echo "Installer: Installing yarn"
apt-get install -y yarn

echo "Installer: Creating cache directory"
mkdir -p "/.data/archiveorg"

echo "Installer: Setting cache ownership"
chown ${USER} /.data/archiveorg

echo "Installer: Adding yarn packages"
yarn add node-pre-gyp cmake

echo "Installer: Switching directories"
cd /usr/local

echo "Installer: Installing Git"
apt-get install -y git

echo "Installer: Installing libsecret"
apt-get install -y libsecret-1-dev

echo "Installer: yarn install internet archive"
yarn add @internetarchive/dweb-mirror @internetarchive/dweb-archive

echo "Installer: yarn install to be sure"
yarn install

echo "Installer: Switching directories into dweb-mirror"
cd /usr/local/node_modules/@internetarchive/dweb-mirror

echo "Installer: Installing service"
mv rachel/files/internetarchive.service /etc/systemd/system

echo "Installer: Setting server to start at boot"
systemctl enable internetarchive.service

echo "Installer: Starting server"
sudo systemctl start internetarchive.service

echo "Installer: Copying module"
mv rachel/en-internet_archive /var/www/modules/

echo "Installer: Setting Ownership"
chown -R www-data:www-data /var/www/modules/en-internet_archive

echo "Installer: Installation complete"
