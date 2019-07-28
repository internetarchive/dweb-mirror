# Managing content on  the Internet Archive’s Universal Library. 

## Summary

*Note: This aspect of the system is currently (June 2019) in rapid evolution, 
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
* Managing Crawling
* Downloading content for a different box
* Managing collections on Internet Archive

## Accessing the box

The address to access will depend on your configuration.
* On Internet In a Box
  * if connected to WiFi “Internet in a Box", try [http://box.lan:4244]
  * if connected via a router then [http://box.local:4244] may work
* On Rachel …TODO
* If your server is running with `--mdns` then [http://archive.local:4244] will work.
* If running on your own machine (a laptop for example) then [http://localhost:4244] should work
* Otherwise ask your system admin for the address of the machine its running on, usually it will be on `:4244`

## Using the page

Whichever of these works it should bring you to your `local` start page.
You can get back here at any time, via the `Local` button.

If you have used the Internet Archive then the interface will be familiar, 
but there are a few differences to support offline use. 

At the top you'll see the Internet Archive's usual interface, a few of these buttons will (for now) only work 
while online. 

[issue#182](https://github.com/internetarchive/dweb-mirror/issues/182) Buttons that dont work when offline should be greyed out

Below that is a row of information specific to the offline application.
    
First are health indicators. 
* If it shows "Mirror" in Red, it means we can't communicate with the mirror gateway, 
this will only happen if the gateway goes offline part way through a process.
* Normally you'll see an indicator for HTTP, which is Green when the gateway can talk to the Archive, and Red when you are offline.
* Next to that might be indicators for WebTorrent or IPFS if they have been enabled. 

[issue#183](https://github.com/internetarchive/dweb-mirror/issues/183) These buttons should control whether IPFS/WebTorrent are enabled

* Then comes an indicator for this page, whether it is being crawled, and if so approximately how much has been stored. 

* If the mirror is online to the Internet Archive (HTTP shows Green) then next comes a "Reload" button, 
you can click this to force it to check with the Archive for an up to date list. 

It is most useful on collections when someone else has added something, but your gateway might be remembering an old version.
* Then there is a Settings button which brings up a page that includes status of any crawls.
* Finally there is a Home button which will bring you back to this page. 

Each tile on this page represents an item that your server will check for when it “crawls”.  
The first time you access the server this will depend on what was installed on the server, and it might be empty. 

Notice that most of the tiles should have a White, Green or Blue dot in the top right to indicate that you are crawling them. 
* A White dot means the item has been downloaded and enough of it has been downloaded to be viewed offline. 
* The Green dot indicates that we are checking this item each time we crawl and getting enough to display offline. 
* A Blue dot indicates we are crawling all the content of the item, this could be a lot of data, 
for example a full resolution version of the video. Its rare that you’ll use this. 

This button also shows how much has been downloaded, for an item its the total size of downloaded files/pages,
for a collection its the total amount in all collection members. 

Tiles come in two types, most shows items that can be displayed - books, videos, audio etc, 
clicking on these will display the item. 

Some of the tiles will show a collection which is a group of items that someone has collected together, 
most likely there will be at least one collection relevant to your project put on the page during installation.  

It shows you how many items are in the collection and how many have been downloaded 
e.g. 400Mb in 10 of 123 items, means 10 of the 123 items in the collection are downloaded sufficient to view offline,
and a total of 400Mb is downloaded in this collection. (Which includes some files, like thumbnails, in other items).

## Details page - viewing a single item

If you click on an item that is already downloaded (Blue, Green or White dot) then it will be displayed offline, 
the behavior depends on the kind of item.
* Images are displayed and saved for offline use
* Books display in a flip book format, pages you look at will be saved for offline use. 
* Video and Audio will play immediately and you can skip around in them as normal

The crawl button at the top will indicate whether the object is being crawled and if not, whether it has been downloaded, 
in the same way tiles do, and also show you (approximately) the total downloaded for this item. 

Click on the Crawl button till it turns Green and it will download a full copy of the book, video or audio.
It waits about 30 seconds to do this, allowing time to cycle back to the desired level of crawling.
These items will also appear on your Local page.  
See the note above, usually you won’t want to leave it at yellow (all) as this will usually try
(there are some size limits) to download all the files.

There is a Reload button which will force the server to try archive.org, 
this is useful if you think the item has changed, or for debugging.

If you want to Save this item to a specific disk, for example to put it on a USB-drive then click the Save button.  
This button brings up a dialogue with a list of the available destinations. 
These should include any inserted drive with "archiveorg" as a directory at its top level. 
The content will be copied to that drive, which can then be removed and inserted into a different server.

The server checks whether these disks are present every 15 seconds, so to use a new USB disk:
* Insert the USB 
* Create a folder at its top level called `archiveorg`
* Wait about 15 seconds
* Hitting `Save` should now allow this USB disk to be selected. 

## Collection and Search pages - multiple items

If you click on a Collection, then we’ll display a grid of tiles for all the items that have been placed in the collection. 
White, Green and Blue indicators mean the same as on the Local page. 
If you click on the crawl button till its Green then it will check this collection each time it crawls, 
download the tiles for the first page or so, and can be configured to get some of the items as well 

[issue#140](https://github.com/internetarchive/dweb-mirror/issues/140) allow UI to configure. 

Save is not yet enabled for collections or searches.
[issue#187][https://github.com/internetarchive/dweb-mirror/issues/187]

## Accessing Internet Archive resources

The Internet Archive logo tile on the local page will take you to the Archive front page collection, 
content here is probably not already downloaded or crawled, 
but can be selected for crawling as for any other item.

## Managing crawling

If you click on the "Settings" button, it should bring up a page of settings to control Crawling.
This page is still under development (as of June 2019). 

On here you will see a list of crawls, (currently just one).
You should get useful information about status, any errors etc. 
Hitting `<<` will restart the crawl and `||` or `>' pause and resume,
but note that any file already being downloaded will continue to do so.  

### Advanced crawling

If you have access to the command line on the server, then there is a lot more you can do with the crawler.

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

This functionality will be gradually added to the UI in future releases.

## Downloading content for a different box

You can copy one or more items that are downloaded to a new storage device (e.g. a USB drive), 
take that device to another Universal Library server, and plug it in.  
All the content will appear as if it was downloaded there. 

To put content onto a device, at the moment requires accessing the command line on the server.

[issue#175](https://github.com/internetarchive/dweb-mirror/issues/175)
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
