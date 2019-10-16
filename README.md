# Offline Internet Archive

## Introduction to the Offline Internet Archive project

The internet now seems like a utility, available everywhere from our homes and offices to trains and planes.
But utility-level access is not yet a reality for more than half of the world’s population who lack consistent, 
or indeed any access, to the Internet.

## Why?

* Cost: Internet access is unaffordable to people with low or no income.
* Connectivity: In many developing countries and rural areas the infrastructure that enables 
  internet access is unreliable, slow, or simply unavailable. Natural disasters, uprisings, and war 
  compound the challenge.
* Censorship: Some countries limit internet access for political reasons. Several countries block the 
  Internet Archive. In some countries, Facebook has become synonymous with the internet – but it is hardly 
  a substitute for free and open World Wide Web.

The Internet Archive offers perhaps the world’s largest online store of open content. 
The wisdom of the ages, just a few clicks away. As Wikipedia has become the world’s encyclopedia, 
the Internet Archive has become its library. 
Central to our mission is establishing “Universal Access to All Knowledge”. 
Access to our library of millions of books, journals, audio and video recordings and beyond is free to anyone
— with one caveat — the need for a reliable internet connection.

Lack of access to today’s internet is a significant factor in poorer educational outcomes, 
inter-generational poverty and disempowerment as identified by the UN in their 
Sustainable Development Goal #9. The Offline Archive project works towards making online collections 
available — regardless of internet availability.     

Part of the challenge is that those of us who live where the Internet works well, are adding graphics, 
video and other demands on bandwidth faster than access is being improved in many parts of the world.

An evolving ecosystem is emerging to enable access over poorer internet. Typically the approaches build 
around low cost, low power, devices that can be installed, in communities and schools for example, and 
deliver content either offline or through better usage of a narrow pipe to the net.

We have built an offline server that:

* Crawls Internet Archive collections to a local server.
* Serves that content locally,
* Caches content while browsing.
* Moves content between servers by sneakernet — on disks, USB sticks, and SD cards.
* Delivers (mostly) the Internet Archive UI offline in javascript in the browser,
* Is open source
* And is being made available in other languages.

The server is integrated into the Internet-In-A-Box (IIAB) platform, 
and can be installed on top of the Rachel platform, 
or hopefully any linux based platform. 
Our approach should improve access for anything from a US$20 Raspberry Pi 
up to a server holding terabytes of data for an institution. 
We are also collaborating with other parts of the ecosystem, integrating the Archive’s APIs with those 
of other partners, to make it easier for them to incorporate Archive content. 

## Contributing

We'd love to have you contribute, please email mitra@archive.org, or interact with the rest of this repo,
and I'll figure out how to help you get started. 
(TODO setup a better channel for this !)

## Installation

If you would like to run the offline archive server then see [INSTALLATION.md](./INSTALLATION.md), 
and the documents it points to. 

If you want to fix bugs, develop code or contribute in other ways then see [INSTALLATION-dev.md](./INSTALLATION-dev.md).
(Note this document was written for Mac OSX users, a useful task would be for someone with a Linux machine
to make any edits to it if required, or just confirms it is correct.)

Also see these documents to update an existing installation,
Or to troubleshoot an existing installation.

## Using it - starting the server.
See the Installation docs, but on most platforms (except, currently, on Mac OSX) 
the server should start at reboot. 

If not, then assuming you've got it installed in your home directory ...

```
cd ~/node_modules/dweb-mirror && ./internetarchive --server &
```
Or a slightly different location for the developers.

The startup is a little slow but you'll see some debugging when its live

On platforms where it starts automatically (e.g. IIAB, Rachel), 
it can be turned on or off at a terminal window with `service internetarchive start` or  `service internetarchive stop` 

### Browsing

Open the web page - the address depends on the platform. 

* http://archive.local:4244 or http://archive:4244 should work on any platform, 
  but this depends on the configuration of your LAN.
* If you know the IP address then http:<IP Address>:4244 will work
* On MacOSX (or if using a browser on the RaspberryPi/OrangePi): http://localhost:4244
* On Rachel try http://rachel.local:4244 or http://rachel:4244
  or via the main interface at http://rachel.local and click Internet Archive
* On IIAB The server can be accessed at [http://box:4244](http://box:4244) or
  [http://box.lan:4244](http://box.lan:4244) (try
  [http://box.local:4244](http://box.local:4244) via mDNS over a local network,
  if you don't have name resolution set up to reach your Internet-in-a-Box).

Try walking through [./USING.md](./USING.md) to get a tour of the system,
and you can click `Home` or the Internet Archive logo, if you just want to explore the Internet Archive's 
resources.

## Administration

Administration is carried out mostly through the same User Interface as browsing. 

Select `local` from any of the pages to access a display of local content. 
Administration tools are under `Settings`.

Click on the Archive logo, in the center-top, to get the Internet
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

### Disk storage

The server checks for caches of content in directories called `archiveorg` in
all the likely places, in particular it looks for any inserted USB drives
on most systems, and if none are found, it uses `~/archiveorg`.

The list of places it checks, in an unmodified installation can be seen at 
`https://github.com/internetarchive/dweb-mirror/blob/master/configDefaults.yaml#L7`.

You can override this in `dweb-mirror.config.yaml` in the home directory of the
user that runs the server. (Note on IIAB this is currently in `/root/dweb-mirror.config.yaml`)
(see 'Advanced' below)

Archive's `Items` are stored in subdirectories of the first of these
directories found, but are read from any of the locations. 

If you disk space is getting full, its perfectly safe to delete any
subdirectories (except `archiveorg/.hashstore`), and the server will refetch anything else it needs 
next time youbrowse to the item while connected to the internet. 
Its also safe to move directories to an attached USB 
(underneath a `archiveorg` directory at the top level of the disk) 
It is also safe to move attached USB's from one device to another.

Some of this functionality for handling disks is still under active development, 
but most of it works now.

### Maintenance

If you are worried about corruption, or after for example hand-editing or
moving cached items around. 
```
# Run everything as root
sudo su
# cd into location for your installation
cd ~/node_modules/@internetarchive/dweb-mirror
./internetarchive -m
```
This will usually take about 5-10 minutes depending on the amount of material
cached,  just to rebuild a table of checksums.

### Advanced

Most functionality of the tool is controlled by two YAML files, the second of
which you can edit if you have access to the shell. 

You can view the current configuration by going to `/info` on your server.
The default, and user configurations are displayed as the `0` and `1` item in
the `/info` call. 

In the Repo is a
[default YAML file](https://github.com/internetarchive/dweb-mirror/blob/master/configDefaults.yaml)
which is commented.  It would be a bad idea to edit this, so I'm not going to
tell you where it is on your installation!  But anything from this file can be
overridden by lines in `~/dweb-mirror.config.yaml`.  Make sure you
understand how yaml works before editing this file, if you break it, you can
copy a new default from
[dweb-mirror.config.yaml on the repo](https://github.com/internetarchive/dweb-mirror/blob/master/dweb-mirror.config.yaml)

Note that this file is also edited automatically when the Crawl button
described above is clicked. 

As the project develops, this file will be more and more editable via a UI. 

## Crawling

The Crawler runs automatically at startup and when you add something to the crawl, 
but it can also be configurable through the YAML file described above
or run at a command line for access to more functionality.

In a shell
```
sudo sh
```
cd into the location for your installation, on most platforms it is:
```
cd ~/node_modules/@internetarchive/dweb-mirror 
```
Or on IIAB it would be
```
cd /opt/iiab/internetarchive/node_modules/@internetarchive/dweb-mirror
```
Perform a standard crawl
```
./internetarchive --crawl 
```
To fetch the "foobar" item from IA. 
```
./internetarchive --crawl foobar 
```
To crawl top 10 items in the prelinger collection sufficiently to display and put 
them on a disk plugged into the /media/pi/xyz.
```
./internetarchive --copydirectory /media/pi/xyz/archiveorg --crawl --rows 10 --level details prelinger
```
To get a full list of possible arguments and some more examples
```
./internetarchive --help
```

## More info

I recommend following through the tour in [USING.md](./USING.md)

Dweb-Mirror lives on GitHub at:
* dweb-mirror (the server) [source](https://github.com/internetarchive/dweb-mirror),
  and [issues tracker](https://github.com/internetarchive/dweb-mirror/issues)
* dweb-archive (the UI) [source](https://github.com/internetarchive/dweb-archive),
  and [issues tracker](https://github.com/internetarchive/dweb-archive/issues)

This project is part of the Internet Archive's larger Dweb project, see also:
* [dweb-universal](https://github.com/mitra42/dweb-universal) info about others working to bring access offline.
* [dweb-transports](https://github.com/internetarchive/dweb-transports) for our transport library to IPFS, WEBTORRENT, WOLK, GUN etc
* [dweb-archivecontroller](https://github.com/internetarchive/dweb-archivecontroller) for an object oriented wrapper around our APIs
