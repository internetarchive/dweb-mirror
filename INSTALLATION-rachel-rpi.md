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
* Inserted into Raspbian 3,
* If at all possible insert Ethernet, otherwise it will work over WiFi with some extra steps.
* Power up
* Connect to the RACHEL-Pi Wifi - it should give you an address like 10.10.10.xxx
* ssh to 10.10.10.10
* Login as `pi` with password `rachel`

* There is a script that automates installing internetarchive on rachel
* curl -o- -L https://unpkg.com/@internetarchive/dweb-mirror/rachel/install.sh | sudo bash

At this point, 
you should be able to access the server at http://rachel.local:4244;
or via the main Rachel interface at http://rachel.local and click on Internet Archive.
And it should be able to use any disk plugged into the USB ports 
that have `archiveorg` at their top level

### Troubleshooting

Logs are in /var/log/daemon.log. 
`grep` unfortunately doesnt seem to work on the logs which it thinks are binary, 
so how to extract the useful information is currently unclear to me. TODO

