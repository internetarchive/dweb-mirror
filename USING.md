# Managing content on  the Internet Archive’s Universal Library. 

## Summary

*Note: This aspect of the system is currently (May 2019) in rapid evolution, 
updating your system is likely to improve it: see [./INSTALLATION.md]*

This file is intended to compliment the [README](./README.md) and [INSTALLATION](INSTALLATION.md) documents. 

There are several aspects to managing content on the Internet Archive’s Universal Library which are covered below, 
these include crawling content to your own system , or to an external drive suitable for moving to another system, 
and managing a collection of material on the archive that others can download automatically. 


* Accessing the box
* Using the page
* Details page - viewing a single item
* Collection and Search pages - multiple items
* Accessing Internet Archive resources
* Downloading content for a different box
* Managing collections on Internet Archive

## Accessing the box

The address to access will depend on your configuration.
* On Internet In a Box
  * if connected to WiFi “Internet in a Box", try [http://box.lan:4244]
  * if connected via a router then [http://box.local:4244] may work
* On Rachel …TODO
* If running on your own machine (a laptop for example) then [http://localhost:4244] should work
* Otherwise ask your system admin for the address of the machine its running on, usually it will be on `:4244`

## Using the page

Whichever of these works it should bring you to your personal start page.

[issue#133](https://github.com/internetarchive/dweb-mirror/issues/133) At the moment it goes to Archive main page, will setup forwarding from http://box.net:4244 etc to /local

If you have used the Internet Archive then the interface will be familiar, 
but there are a few differences to support offline use. 

Each tile on this page represents an item that your server will check for when it “crawls”.  
First time you access the server this will depend on what the installer setup and there may be none. 

In addition there will be  (TODO) a way to get to the main Archive page, 
and  (TODO) ways to access settings 
[issue#132](https://github.com/internetarchive/dweb-mirror/issues/132) add a way to start/stop/control the crawler. 

Notice that most of the tiles should have a White, Green or Blue dot in the top right to indicate that you are crawling them. 
* A White dot means the item has been downloaded and enough of it has been downloaded to be viewed offline. 
* The Green dot indicates that we are checking this item each time we crawl and getting enough to display offline. 
* A Blue dot indicates we are crawling all the content of the item, this could be a lot of data, 
for example a full resolution version of the video. Its rare that you’ll use this. 
* TODO add size (MB) indicator 

Tiles come in two types, most shows items that can be displayed - books, videos, audio etc, 
clicking on these will display the item. 

Some of the tiles will show a collection which is a group of items that someone has collected together, 
most likely there will be at least one collection relevant to your project put on the page during installation.  
It should show you how many items are in the collection and TODO how many have been downloaded 
(e.g. 10/123 means 10 of the 123 items in the collection are downloaded for offline use).

TODO - There is a Settings button on the page that .... 

TODO - There are buttons for controlling crawling .... 

## Details page - viewing a single item

If you click on an item that is already downloaded (Blue, Green or White dot) then it will be displayed offline, 
the behavior depends on the kind of item.
* Images are displayed and saved for offline use
* Books display in a flip book format, pages you look at will be saved for offline use. 
* Video and Audio will play immediately and you can skip around in them as normal

The crawl button will indicate whether the object is being crawled as for a tile. 
TODO make White version if downloaded but not crawled 
TODO display size of download

Click on the Crawl button till it turns Green and it will download a full copy of the book, 
video or audio next time it crawls,  (TODO make that immediate). 
These items will also appear on your Local page.  
See the note above, usually you won’t want to leave it at blue.

TODO need a way to get back to the “Local” page

[issue#129](https://github.com/internetarchive/dweb-mirror/issues/129). Show date crawled and add a refresh button 
## Collection and Search pages - multiple items

If you click on a Collection, then we’ll display a grid of tiles for all the items that have been placed in the collection. 
White, Green and Blue indicators mean the same as on the Local page. 
If you click on the crawl button till its Green then it will check this collection each time it crawls, 
download the tiles for the first page or so, and can be configured to get some of the items as well 
(TODO allow UI to configure). 

## Accessing Internet Archive resources

The Internet Archive logo tile on the local page will take you to the Archive front page collection, 
content here is probably not already downloaded or crawled, 
but can be selected for crawling as for any other item.

## Managing crawling

At the moment crawling has to be controlled from the command line. 

The items selected for crawling (Green or Blue dots) are stored in a file `dweb-mirror.config.yaml` 
in the one directory of the server, e.g. on IIAB its in /root/dweb-mirror.config.yaml 
and on your laptop its probably in ~/dweb-mirror.config.yaml.
You can edit this file with care ! 

From the command line, cd into the directory holding the service to run the crawler e.g. on iIAB
```
cd /opt/iiab/internetarchive
./internetarchive --crawl
```
There are lots of options possible, try `./internetarchive —help` to get guidance.

TODO This will be controllable via the UI fairly soon.

## Downloading content for a different box

You can copy one or more items that are downloaded to a new storage device (e.g. a USB drive), 
take that device to another Universal Library server, and plug it in.  
All the content will appear as if it was downloaded there. 

To put content onto a device, at the moment (TODO) requires accessing the command line on the server.

``` 
# CD into your device e.g. on an IIAB it would be 
cd /media/pi/foo

# Create a directory to use for the content, it must be called "archiveorg"
mkdir archiveorg 

# CD wherever you have your installation
cd /opt/iiab/internetarchive 

# Copy the current crawl to the directory
./internetarchive --crawl --copydirectory /media/foo/archiveorg
```
When its finished, you can unplug the USB drive and plug into any other device 

Alternatively if you want to crawl a specific collection e.g. `frenchhistory` to the drive, you would use:
```
./internetarchive --crawl --copydirectory /media/foo/archiveorg frenchhistory
```
If you already have this content on your own device, then the crawl is quick, 
and just checks the content is up to date. 

## Managing collections on Internet Archive

You can create and manage your own collections on the Internet Archive site itself, 
other people can then crawl those collections. 

First get in touch with Mitra Ardron at mitra@archive.org , as processes may have changed since this is written.

You'll need to create an account for yourself at [archive.org](https://archive.org)

We'll setup a collection for you of type "texts" - dont worry, you can put any kind of media in it. 

Once you have a collection, lets say `kenyanhistory`
you can upload materials to the Archive by hitting the Upload button and following the instructions.

You can also add any existing material on the Internet Archive to this collection.  

* Find the material you are looking for
* You should see a URL like `https://archive.org/details/foobar`
* Copy the identifier which in this case would be 'foobar'
* Go to `https://archive.org/services/simple-lists-admin/?identifier=kenyanhistory&list_name=items` 
replacing `kenyanhistory` with the name of your collection.
* Enter the name of the item `foobar` into the box and click "Add". 
* It might take a few minutes to show up, you can add other items while you wait. 
* The details page for the collection should then show your new item `https://archive.org/details/kenyanhistory`

On the device, you can go to `kenyanhistory` and should see `foobar`.
Hit Refresh and `foobar` should show up. 
If `kenyanhistory` is marked for crawling it should update automatically

[issue#128](https://github.com/internetarchive/dweb-mirror/issues/128) make it show up in collections.