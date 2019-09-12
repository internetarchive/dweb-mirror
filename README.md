# Internet Archive - Universal Library project README 


The project is a local server that allows users to browse resources from the
Internet Archive stored on local drives - including USB drives.  

It includes a crawler that can regularly synchronize local collections, against
a list of Internet Archive items and collections, and those collections can be
moved between installations.

When connected to the internet, the server works as a Proxy, i.e. it will store
Internet Archive (IA) content the user views for later off-line viewing. 

There are components (not yet fully integrated) to integrate the IA server with decentralized tools
including IPFS, WebTorrent, GUN, WOLK, both for fetching content and for
serving it back to the net or locally. 

This is an ongoing project, continually adding support for new Internet Archive
content types; new platforms; and new decentralized transports.

## Contributing

We'd love to have you contribute, please email mitra@archive.org and I'll figure out how to help you get started. 
(TODO setup a better channel for this !)

## Installation
Please see the separate INSTALLATION-xxx documents, these are a work in progress, but are generally tested for each 
platform, and there is a generic INSTALLATION-work.md which should have everything and is great if you are trying to 
install on a new platform.

There is also an INSTALLATION-osx-dev.md for developers (a useful task would be for someone with a Linux machine 
to make any edits to it if required)

## Using it - starting the server.
See the Installation docs but on most platforms the server should start at reboot. 

If not, then assuming you've got it installed in your home directory ...

```
cd ~/node_modules/dweb-mirror && ./internetarchive --server &
```
Or a slightly different location for the developers.

The startup is a little slow but you'll see some debugging when its live

On platforms where it starts automatically (e.g. IIAB, Rachel), 
it can be turned on or off at a terminal window with `service internetarchive start` or  `service internetarchive stop` 

### Browsing

If you are working directly on the machine (e.g. its your Mac) then
browse to [http://localhost:4244] which will open the UI in the browser and it should see the Archive UI.

If you are remote from the machine, then browser to: `http://<IP of machine>:4244`, 
if mdns works on your platform then `http://archive:4244` should work.

On IIAB The server can be accessed at [http://box:4244](http://box:4244) or
[http://box.lan:4244](http://box.lan:4244) (try
[http://box.local:4244](http://box.local:4244) via mDNS over a local network,
if you don't have name resolution set up to reach your Internet-in-a-Box).


If you don’t get an Archive UI then look at the server log (in browser console)
to see for any “FAILING” log lines which indicate a problem. 

Expect to see errors in the Browser log for
`http://localhost:5001/api/v0/version?stream-channels=true` which is checking
for a local IPFS server which is not started here.

Expect, on slower machines or slower network connections, to see no images the
first time, refresh after a little while and most should appear. 

## Administration

Administration is carried out mostly through the same User Interface as browsing. 

Access [http://localhost:4244/local](http://localhost:4244/local) to see a
display of local content, this interface is under development and various admin
tools will be added here.  Unless your box has been configured differently this 
should also be the page you get at [http://box.lan:4244/local](http://box.lan:4244/local).

Access [http://localhost:4244/home](http://localhost:4244/home) to get the Internet
Archive main interface if connected to the net. 

While viewing an item or collection, the "Crawl" button in the top bar
indicates whether the item is being crawled or not.  Clicking it will cycle
through three levels:

* No crawling
* Details - sufficient information will be crawled to display the page, for a
  collection this also means getting the thumbnails and metadata for the top
  items. 
* Full - crawls everything on the item, this can be a LOT of data, including
  full size videos etc, so use with care if bandwidth/disk is limited.

### Disks

The server checks for caches of content in directories called `archiveorg` in
all the likely places, in particular it looks for any inserted USB drives
on most systems, and if none are found, it uses `~/archiveorg`.

The list of places it checks, in an unmodified installation can be seen at 
`https://github.com/internetarchive/dweb-mirror/blob/master/configDefaults.yaml#L7`.

You can override this in `dweb-mirror.config.yaml` in the home directory of the
user that runs the server, this is currently `/root/dweb-mirror.config.yaml`
(see 'Advanced' below)

Archive's `Items` are stored in subdirectories of the first of these
directories found, but are read from any of the locations. 

If you disk space is getting full, its perfectly safe to delete any
subdirectories, or to move them to an attached USB.  Its also safe to move
attached USB's from one device to another.

The one directory you should not move or delete is `archiveorg/.hashstore` in
any of these locations, the server will refetch anything else it needs next time you
browse to the item while connected to the internet. 

### Maintenance

If you are worried about corruption, or after for example hand-editing or
moving cached items around. 
```
# Run everything as root
sudo su
# cd into location for your installation
cd /opt/iiab/internetarchive/node_modules/@internetarchive/dweb-mirror
./internetarchive -m
```
This will usually take about 5-10 minutes depending on the amount of material
cached,  just to rebuild a table of checksums.

### Advanced

Most functionality of the tool is controlled by two YAML files, the second of
which you can edit if you have access to the shell. 

You can view the current configuration by going to
[http://box.lan:4244/info](http://box.lan:4244/info) or
[http://localhost:4244/info](http://localhost:4244/info) depending on how you
are connected.

The default, and user configurations are displayed as the `0` and `1` item in
the `/info` call. 

In the Repo is a
[default YAML file](https://github.com/internetarchive/dweb-mirror/blob/master/configDefaults.yaml)
which is commented.  It would be a bad idea to edit this, so I'm not going to
tell you where it is on your installation!  But anything from this file can be
overridden by lines in `/root/dweb-mirror.config.yaml`.  Make sure you
understand how yaml works before editing this file, if you break it, you can
copy a new default from
[dweb-mirror.config.yaml on the repo](https://github.com/internetarchive/dweb-mirror/blob/master/dweb-mirror.config.yaml)

Note that this file is also edited automatically when the Crawl button
described above is clicked. 

As the project develops, this file will be editable via a UI. 

## Update

Dweb-mirror is under rapid development, as is the JavaScript UI.  It's
recommended to update frequently. 

From a Terminal window
```
sudo sh # Run all commands as root
cd /opt/iiab/internetarchive
yarn install  # Makes sure you have at least the minimum packages
yarn upgrade  # Currently this can take up to about 20 minutes to run, we hope to reduce that time
```

## Crawling

The Crawler runs automatically at startup and when you add something to the crawl, 
but it can also be run at a command line. 

Its highly configurable either through the YAML file described above, or from
the command line.

In a shell 
```
# Run all commands as root from dweb-mirror's directory
sudo sh

# cd into location for your installation - which varies between platforms
cd /opt/iiab/internetarchive/node_modules/@internetarchive/dweb-mirror || cd /usr/local/node_modules/@internetarchive/dweb-mirror || cd ~/node_modules/@internetarchive/dweb-mirror

# To get a full list of possible arguments and some more examples
./internetarchive --help

# Perform a standard crawl
./internetarchive --crawl 

# To fetch the "foobar" item from IA. 
./internetarchive --crawl foobar 

# To crawl top 10 items in the prelinger collection sufficiently to display and put 
# them on a disk plugged into the /media/pi/xyz
# TODO check where pi actually put them. 
./internetarchive --copydirectory /media/pi/xyz/archiveorg --crawl --rows 10 --level details prelinger
```
## Troubleshooting

There are two logs of relevance, the browser and the server.

**Browser**: If using Chrome then this is at View / Developer Tools /
JavaScript Console or something similar.

**Server**: 
On IIAB or on Rachel/RPI from a Terminal window. 
```
journalctl -u internetarchive
```
TODO find log files on other platforms

## Known Issues

See
[github dweb-mirror issues](https://github.com/internetarchive/dweb-mirror/issues);
and
[github dweb-archive issues](https://github.com/internetarchive/dweb-archive/issues);

## More info

Dweb-Mirror lives on GitHub at:
* [dweb-mirror](https://github.com/internetarchive/dweb-mirror)
* [source](https://github.com/internetarchive/dweb-mirror)
* [issues](https://github.com/internetarchive/dweb-mirror/issues)
* [API.md](./API.md) API documentation for dweb-mirror

This project is part of the Internet Archive's larger Dweb project, see also:
* [dweb-universal](https://github.com/internetarchive/dweb-universal) info about others distributing the web
* [dweb-transport](https://github.com/internetarchive/dweb-transport) miscellaneous incl GUN gateway and WebTorrent
* [dweb-objects](https://github.com/internetarchive/dweb-objects) library of dweb objects and examples (not maintained)
* [dweb-archive](https://github.com/internetarchive/dweb-archive) archive UI in JavaScript
* [dweb-archivecontroller](https://github.com/internetarchive/dweb-archive) Knows about the structure of archive objects
