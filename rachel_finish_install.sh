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

echo "Installer: Installing Git"
apt-get install -y git

echo "Installer: Installing libsecret-1-dev
apt-get install -y libsecret-1-dev

echo "Installer: Switching directories"
cd /usr/local

echo "Installer: yarn install internet archive"
yarn add @internetarchive/dweb-mirror @internetarchive/dweb-archive

echo "Installer: yarn install to be sure"
yarn install







