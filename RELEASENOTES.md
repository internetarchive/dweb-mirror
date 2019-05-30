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

* Crawler first release - see [INSTALLATION.md](./INSTALLATION.md)

### Minor releases

* 0.1.1: Added support for multiple cache directories
* 0.1.1: Added support for "copyDirectory" to support cloning to a USB for example. 
* 0.1.1: Support for search collections that have "identifier:xxx*" as the query.  
* 0.1.2: Support multiple config files in yaml,  [#88](https://github.com/internetarchive/dweb-mirror/issues/88)(minor)
* 0.1.2: Fix bug installing with yarn

## Release 0.2.0

This release integrates IPFS integration, so any files in the crawled cache are also seeded to IPFS.

See [#11](https://github.com/internetarchive/dweb-mirror/issues/11) for current state.

* 0.2.24: Correct default user config
* 0.2.23: Update default UserConfig
* 0.2.22: home page; not stopping server didnt start; better HashStore error handling; simplelist/collection/search_collection; start on /local
* 0.2.21: USING.md and some bug fixes (with 0.2.20), dont enable IPFS by default
* 0.2.20: Installation doc reorganization; better manage http server; support crawl and downloaded fields; 
* 0.2.19: Installer for bookreader
* 0.2.18: Initialize user config file if not there
* 0.2.16: Improved behavior standalone or when cant see gateway, installation documentation
* 0.2.15: bookreader bug when not cached and bug in installer
* 0.2.14: Add configuration for IIAB (partial)
* 0.2.14: Use new playlist api
* 0.2.13: Refactor to move seed support to dweb-transports reqs dweb-transport >= v0.1.40
* 0.2.12: Merge mirrorHttp and crawl into internetarchive
* 0.2.12: Refactor to remove subclasses of ArchiveMember reqs archivecontroller >= v0.1.51
* 0.2.11: Better fully offline handling of relateditems and metadata for files
* 0.2.10: Bookreader working offline; Improved installation documentation; 
* 0.2.9: Bug fixes including not retrying local IPFS if not installed, and fix to not require a package that was moved
* 0.2.8: Bug fix
* 0.2.7: Bookreader support
* 0.2.6: Recognize default location for IIAB USB sticks /media/pi/*
* 0.2.5: Oops - was depending on fixed version of dweb-transports
* 0.2.4: Move transport config into YAML; IPFS fetching now supported
* 0.2.4: Fix bug in crawling "all" for querys
* 0.2.3: Simple button to change config crawl level for item/collection reqs dweb-archive v0.1.49
* 0.2.2: Switch dependencies to our own repo's to npm releases (away from github)
* 0.2.1: Tidy up IPFS, GO, install; and platform specific docs & installs for Rachel3+ (which now includes IPFS)
* 0.2.1: Working on Raspberry Pi 3 with IPFS
* 0.2.0: Integrate seeding to IPFS and IPFS installation
* 0.2.0: Integrate installation process for Rachel3+ - still not perfect but works though doesnt support IPFS yet. 

