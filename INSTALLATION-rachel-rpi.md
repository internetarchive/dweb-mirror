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


---

curl https://drive.google.com/open?id=1wz8Z7Y_xLilTdgK47flXcWg4oEAKCkeV
unzip file downladed
cd into zip 
./install.sh 