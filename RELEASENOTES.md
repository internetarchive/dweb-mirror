## Release Notes 

## Known issues - and features for next release or two

(See [dweb-mirror/issues](https://github.com/internetarchive/dweb-mirror/issues) for more detail)
* support collection sort order in caching (minor) [#32](https://github.com/internetarchive/dweb-mirror/issues/32)
* better integration with IAUX library (mostly this will be in dweb-archive) [#66](https://github.com/internetarchive/dweb-mirror/issues/66)
* Video caching [#67](https://github.com/internetarchive/dweb-mirror/issues/67) (major)
* Add support for at least one other box e.g. Rachel or RaspberryPi/Internet-in-a-Box (major)
* Support UX for adding collections to crawl etc [#55](https://github.com/internetarchive/dweb-mirror/issues/55) (major)
* Support for adding and retrieving files from IPFS (seeding done v0.2.0) [#11](https://github.com/internetarchive/dweb-mirror/issues/11), 
WebTorrent [#16](https://github.com/internetarchive/dweb-mirror/issues/16) & Gun
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
* 0.1.2: Support multiple config files in yaml,  [#88](https://github.com/internetarchive/dweb-mirror/issues/88)(minor)
* 0.1.2: Fix bug installing with yarn

## Release 0.2.0

This release integrates IPFS integration, so any files in the crawled cache are also seeded to IPFS.

See [#11](https://github.com/internetarchive/dweb-mirror/issues/11) for current state.

* 0.2.0: Integrate seeding to IPFS and IPFS installation
* 0.2.0: Integrate installation process for Rachel3+ - still not perfect but works though doesnt support IPFS yet. 