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

At this point, 
you should be able to access the server at http://rachel.local:4244;
or via the main Rachel interface at http://rachel.local and click on Internet Archive.
 
### Disk mounting
USB drives (both real drives and USB sticks) dont mount in this version. 
To get ExFat (Most USB) and NTFS (Windows) to mount ... 

Add some code needed
```
apt-get install -y usbmount ntfs-3g exfat-fuse` which didn't help.
```
Check the gid of pi. 
```
id -g pi # Get GID
id -u pi # Get UID
```

Then edit /etc/usbmount/usbmount.conf to add ntfs and fuseblk so the line looks like:
```
FILESYSTEMS="vfat ext2 ext3 ext4 hfsplus ntfs exfat fuseblk"
```
And if both gid and uid `1000` then change the gid and uid in the FS_MOUNTOPTIONS as below.
```
FS_MOUNTOPTIONS="-fstype=ntfs-3g,nls=utf8,umask=007,gid=1000
-fstype=fuseblk,nls=utf8,umask=007,gid=1000 -fstype=vfat,gid=1000,uid=1000,umask=007"
```

Trying to work out how to figure out the filetype of typical USB drives and 
what added code is needed to make them work. TODO

Here is help with:
[NTFS](https://raspberrypi.stackexchange.com/questions/41959/automount-various-usb-stick-file-systems-on-jessie-lite)


### Troubleshooting

Logs are in /var/log/daemon.log. 
`grep` unfortunately doesnt seem to work on the logs which it thinks are binary, 
so how to extract the useful information is currently unclear to me. TODO

