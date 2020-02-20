#API for dweb-mirror v0.2.0

This document covers the API for v0.2.0 of dweb-mirror which is semi-stable now.

#### Outline of APIs

* URI support: support most of the Internet Archive's core APIs.
* Config files: Control the behavior of each of the apps in this package
* dweb-archivecontroller - base level classes which are extended by this package:
  ArchiveItem; ArchiveMember; ArchiveFile.
* A set of classes that provide higher level support esp:
  CrawlManager; ConfigController HashStore; MirrorFS;
* An applications that uses the APIs above, but which is itself forkable:
  internetarchive.

# URI support

dweb.mirror is intended to support an expanding subset of Archive APIs. 

Check ./MirrorHttp.js for the routing but in summary all these work as for 
archive.org or DATANODE.archive.org except as where noted,
though given all the Internet Archive edge cases and exceptions 
there may be unknown places where certain options are not supported.

Some archivelab.org API's are also (partially) supported (/books and /iiif)
largely because Palmleaf's extensions to Mediawiki use them.

|url|notes|
|---|-----|
|/advancedsearch.php|Return json file as on IA  <br>Does not support fl=|
|/BookReader/BookReaderJSIA.php|Return the IA specific json used by bookreader|
|/BookReader/BookReaderJSON.php  <br>/books/IDENTIFIER/ia_manifest|Return the IA specific json used by bookreader|
|/BookReader/BookReaderImages.php  <br>/BookReader/BookReaderPreview.php|Send page images|
|/details/IDENTIFIER|Redirect to single page for IDENTIFIER|
|/stream/IDENTIFIER||
|/details/IDENTIFIER/page/*|Opens book to page|
|/download/IDENTIFIER/page/PAGE|Returns one image|
|/download/IDENTIFIER|Redirects to page that displays download directory|
|/download/IDENTIFIER/FILE  <br>/serve/IDENTIFIER/FILE|Download file|
|/embed/IDENTIFIER?output=json  <br>/playlist/IDENTIFIER|Return a playlist|
|/iiif/:identifierindex/ LEFT,TOP,WIDTH,HEIGHT/full/0/default.jpg|Return a scaled image 
|/mds/v1/get_related/all/IDENTIFIER|Gets related items|
|/metadata/IDENTIFIER|Standard metadata except:  <br>Does not support returning subset of metadata|
|~~/metadata/IDENTIFIER/FILE~~|As used in earlier dweb.archive.org is no longer supported|
|/search.php|Redirect to search results page|
|/services/img/IDENTIFIER  <br>/download/IDENTIFIER/__ia_thumb.jpg|Return the thumbnail|
|/images/FILE   <br>/includes/FILE   <br>/jw/FILE   <br>/bookreader/BookReader/FILE  <br>/favicon.ico |Return static files as on IA|

In addition there are URI's unique to dweb-mirror:

|url|notes|
|---|-----|
|/admin/crawl|Set of functions to control crawling|
|/archive/FILE  <br>/FILE|Returns file from this UI|
|/components/FILE|Returns webcomponents used by UI|
|/echo|Echo back headers (for debugging)|
|/epubreader/FILE|Return file from epubreader application|
|/info|Return info about the server including config and status of crawls|
|/languages/FILE|Returns static language files|
|/opensearch|Supports opensearch API currently only when online to gateway|

# Config file

There are two config files, one at dweb-mirror/configDefaults.yaml 
and ~/dweb-mirror.config.yaml for which there is an example you can copy.

Both files follow the same format, and the settings in your home directory override that in dweb-mirror.

Check ./configDefaults.yaml which has comments on each line.

```
directories: [ path* ] # List of places to look for the Cache directory - expands ~/xx and ./xx and * etc
archiveui: # Anything relating to display of the Archive UI
  directory: [ ... ] # Where to look for the files for the Archive UI - uses first - expands ~/xx and ./xx and * etc
  apps: # Each application can have its own configuration
    http: # Relating to serving
    crawl: # Relating to crawling 
  upstream: "dweb.archive.org" # Where to find an upstream server, typically "dweb.archive.org"
```

# Files on disk

Files are stored in a 2 (or more) level directory structure, each Archive Item is a directory, and each Archive File is a file. 
Metadata is stored in specially named files. 

### Cache outline for each Item.

/archiveorg/IDENTIFIER/ each Archive item has its own directory that contains the following files.

|file|from|
|----|----|
|IDENTIFIER.meta.json|ArchiveItem.metadata|
|IDENTIFIER.reviews.json|ArchiveItem.reviews, On disk is format returned by API
|IDENTIFIER.speech_vs_music_asr.json|ArchiveItem.speech_vs_music_asr.json, Format as returned by metadata API
|IDENTIFIER.files.json|ArchiveItem.files|
|IDENTIFIER.extra.json|ArchiveItem.{collection_titles, collection_sort_order, files_count, is_dark, dir, server}|
|IDENTIFIER.member.json|ArchiveMember, As retrieved in a search
|IDENTIFIER.members.json|List of members - this file is a normal ArchiveFile in fav-* collections|
|IDENTIFIER.members_cached.json|ArchiveMember.*, All the search results for this item retrieved so far
|IDENTIFIER.members_titleSorter_cached.json|ArchiveMember.*, Search results based on a  `titleSorter` sort
|IDENTIFIER.playlist.json|ArchiveItem.playlist, The playlist for the item
|IDENTIFIER.bookreader.json|ArchiveItem.bookreader, The info that the bookreader API returns
|__ia_thumb.jpg|Image file from /service/img/IDENTIFIER ~10kbytes|

# Local classes
dweb-mirror uses the three core classes from [dweb-archivecontroller](https://github.com/internetarchive/dweb-archivecontroller), 
but patches them so that they become cache aware.  
See ./ArchiveItemPatched.js ./ArchiveFilePatched.js and ./ArchiveMemberPatched.js

# Applications

`internetarchive`: A comprehensive function that can with
-s  Run a server
-c  Run a crawler
-m  Perform maintenance

There is a lot more functionality, running `internetarchive -h` 
or look in ./internetarchive for all the options. 

# Installation files

The following files are present in `dweb-mirror` but, as of v0.1.0 are still a work in progress and not yet defined and will probably change a lot. 

* Dockerfile - create  docker file of dweb-mirror (untested, probably doesnt work yet)
* Dockerfile_ipfs - create a docker file for an IPFS instance - to go with the above Dockerfile (untested, probably doesnt work yet)
* install.sh  - run during `npm install` or after `npm update` by `npm run update` - makes some links based on which other repos are installed. 
* install_rachel.sh - variant of install.sh being built for Rachel platform (only partially complete)
* run_dockers.sh - ???

# See Also

* [LICENCE] - GNU Alfredo licence
* [INSTALLATION.md] - generic installation instructions and links to specific instructions.
* [README.md] - main documentation
* [RELEASENOTES.md] - history of releases
* [URL_MAPPING.md] - how universal urls flow through the different mappings in mirrorHttp and elsewhere.


