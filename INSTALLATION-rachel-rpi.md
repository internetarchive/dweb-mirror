# dweb-mirror on Raspberry Pi 3

This is a work in progress - rewritten after first clean run on a new OS.

If they dont work please email mitra@archive.org

## Step 1: Operating System + Rachel Image

Download the temporary Raspbian Buster + Rachel image - 
Temporarily at ...

http://rachelfriends.org/downloads/public_ftp/rachelpi_64EN/rachelpi_2019/rachel-pi_kolibi_buster_unofficial.7z

BUT moving soon.

#### Put it onto a SD card
* On a Mac:
  * downloaded [Etcher](https://www.balena.io/etcher/) (100Mb)
  * In a terminal window find the download - its an odd .7z format that balenaEtcher can't handle
  * Run Etcher,
    * select the .img file expanded in the step above
    * insert a largish (e.g. 16GB or up) as the destination and tell it to Flash
* On Windows or Linux, I'm not sure the appropriate steps instead of Etcher. 
* Inserted into Raspbian 3, and powered up with Kbd and HDMI and Mouse inserted. 
* If at all possible insert Ethernet, otherwise it will work over WiFi with some extra steps.
* Power up
* Connect to the RACHEL-Pi Wifi - it should give you an address like 10.10.10.xxx
* ssh to 10.10.10.10
* Login as `pi` with password `rachel`

There is an installer, but its not in Rachel yet, or at a stable location, 
so cut and paste the following
it may be best to do this a line at a time to check each step completes.
```
sudo su
curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
apt-get update && apt-get install -y nodejs npm yarn git libsecret-1-dev && npm i -g npm
mkdir -p "/.data/archiveorg" && chown ${USER} /.data/archiveorg
cd /usr/local
yarn add node-pre-gyp cmake
yarn add @internetarchive/dweb-mirror @internetarchive/dweb-archive
yarn install
cd /usr/local/node_modules/@internetarchive/dweb-mirror
mv rachel/files/internetarchive.service /etc/systemd/system
systemctl enable internetarchive.service
sudo systemctl start internetarchive.service
mv rachel/en-internet_archive /var/www/modules/
chown -R www-data:www-data /var/www/modules/en-internet_archive
```
