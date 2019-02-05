## Release Notes 

## Known issues - and features for next release or two

(See [https://github.com/internetarchive/dweb-mirror/issues] for more detail)
* support collection sort order in caching (minor) [https://github.com/internetarchive/dweb-mirror/issues/32](#32)
* better integration with IAUX library (mostly this will be in dweb-archive) [https://github.com/internetarchive/dweb-mirror/issues/66](#66)
* Video caching [https://github.com/internetarchive/dweb-mirror/issues/67](#67) (major)
* Add support for at least one other box e.g. Rachel or RaspberryPi/Internet-in-a-Box (major)
* Support UX for adding collections to crawl etc [https://github.com/internetarchive/dweb-mirror/issues/55](#55) (major)
* Support for adding and retrieving files from IPFS, WebTorrent [https://github.com/internetarchive/dweb-mirror/issues/16](#16) & Gun
* Support for Text files (major)
* Support for Wayback Machine (major)

## Release 0.1.0

This is the first release that we are encouraging people to experiment with, its far from complete
but has some hopefully useful functionality, in particular. 

See [Milestone v0.1.0 on Github](https://github.com/internetarchive/dweb-mirror/milestone/3) for the up to date list of what needs completing

* Crawler first release - see [README.md](./README.md)

### Minor releases

* 0.1.1: Added support for multiple cache directories
* 0.1.1: Added support for "copyDirectory" to support cloning to a USB for example. 
* 0.1.1: Support for search collections that have "identifier:xxx*" as the query.  
* 0.1.2: Support multiple config files in yaml,  [https://github.com/internetarchive/dweb-mirror/issues/88](#88)(minor)
* 0.1.2: Fix bug installing with yarn

#### IPFS - will fold into releases when done and branch merged ... 

* Figure out how to install IPFS 
  * Check "dweb" repo for how we do it on Docker, copy into an install script
  * Instal IPFS on my machine, following those instructions, and check multiple runs work
* Figure out how to add files
  * Check whether nocopy works as described in https://github.com/internetarchive/dweb-mirror/issues/22
  * Find a way to add so matches the IPFS hash generated on server
  * Hook into caching process
* if there is a way to just automate updating the entire cache on IPFS see [https://github.com/protocol/collab-internet-archive/issues/62](collab#62)
  * Hook IPFS to watch the cache directories
* If no way then hook into MirrorFS (?) so updates IPFS as it writes the cache,
  * will need some bulk process to counter IPFS's dendency to randomly lose the whole repo or some subset of it (via GC we think) 
* Make sure that either dweb-mirror (prefered) or the browser can fetch files that are on IPFS