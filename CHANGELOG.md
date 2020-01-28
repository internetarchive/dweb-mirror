## CHANGELOG

## Known issues - and features for next release or two

(See [dweb-mirror/issues](https://github.com/internetarchive/dweb-mirror/issues) for more detail)

## Release 0.2.x
* 0.2.74: Oops - catch typo introduced in liniting 
* 0.2.73: Bump dependency on dweb-transports to 0.2.17 and dweb-archive-dist 0.2.18
* 0.2.71:
  * Mediawiki installation script / instructions now work for IIAB platform
  * Docker improved to support OLIP
  * Fix bug in search
  * Handle page leafs for BookReaderPreview better
* 0.2.70: Implement opensearch for OLIP, debug Dockerfile and mediawiki installs
* 0.2.69: DOnt force protcocol to be http in mirrorHttp (breaks www-dev-mirror)
* 0.2.67: 
  * Add config to point button at local palmleafwiki
  * Mediawiki: Debugging ArchiveOrgAth
  * Aligning Dockerfile with www-dweb-mirror Dockerfile for Kubernetes
* 0.2.66: Support redir.html file if used
* 0.2.65: 
  * Mediawiki installation
  * Dockerfile tweeks
* 0.2.64: 
  * Add eslint dependencies
  * Routing changes including contenthash obsolescence
  * Installation including Dockerfile now working
  * BookReader debugging for mediawiki
  * Refactor mirrorHttp to combine functions , and remove /archive/ redirects https://github.com/internetarchive/dweb-mirror/issues/242
* 0.2.63: More epub support
* 0.2.62: Use routed instead of Naming; support epub, book urls and iiif subset; error handling on no disk; 
* 0.2.61: Remove dweb.archive.org dependencies and major naming refactor; stream error; installation if npm protected; 
* 0.2.61: fetch_query cache fallback; Save on Local
* 0.2.60: Major naming refactor; support magnet links
* 0.2.59: Support for enhanced media player and better offline support, refactor sendFileFromDir
* 0.2.58: Support radio player and speech_vs_music_asr.json
* 0.2.57: support metadata/local
* 0.2.56: Dockerfile; Refactor Installers; Save on collections/local/search; Epub partial; I18n dynamic files; remove wrtc dependency; EDGE CASES: local, specialidentifiers, related; BUGS: contenthash; deleting bad hashes; 
* 0.2.55: Fix path to archiveui, Dockerfile rework
* 0.2.54: Dependency moved from dweb-archive to dweb-archive-dist; Unified install.sh and update Installation docs to reflect. 
* 0.2.53: Slight improvement on re-runability of install_dev.sh
* 0.2.52: Catch error handling around page resolutions; Crawl Indicators for search; workaround embed API bug; bug fixes on is_dark; crawl indicators; 
* 0.2.51: Move Requires back into DwebTransports
* 0.2.50: Explicitly require transports only if in config; Bookreader resolution optimisation; 
* 0.2.50: Remove dweb-objects dependency, 
* 0.2.49: dev installer - add webpack; MirrorFS change prefered directory; simplify rachel instructions
* 0.2.48: config.directories fix; hashstores bug; Rachel install; error return from related
* 0.2.47: install_armbian.sh
* 0.2.46: install_dev.sh
* 0.2.45: Handle /includes so dont have to edit less for font directories
* 0.2.44: level to v5 (for compatability with node v12)
* 0.2.43: yarn upgrade, and some Installation instructions
* 0.2.42: Fix sort handling; Look for disk changes; MDNS on by default; Update dependencies; Installation docs upgrade
* 0.2.40: Crawl error handling, zero length files, bookreader location, texts subtypes, crawl when offline
* 0.2.39: USB mounting; exportfiles fix; Rachel intallation notes
* 0.2.38: is_dark improvements; first install; docs; rachel
* 0.2.37: yarn upgrade; sort in searches; write-to-usb; carousel; cleanup URLs; MDNS; 
* 0.2.36: Turn off IPFS install by default, dist.ipfs.io servers are too slow and unreliable. See https://github.com/ipfs/ipfs-update/issues/105
* 0.2.35: download count improvements, and copyDirectory refactor
* 0.2.34: Prettier byte; edge cases with _extra.json and downloaded crawling and downloaded indicators on mediatype=texts
* 0.2.33: Split members>membersFav,membersSearch; /info now has Transport info; install_ipfs fixed; downloaded on searches; adding to live crawls;	ef8d8f0	Mitra Ardron <mitra@mitra.biz>	28Jun2019 at 6:54 PM
* 0.2.31: Support for expanded downloaded indicator (counts and sizes), crawling single files
* 0.2.30: Support for /download/
* 0.2.29: Improvements to MirrorFS/maintenance (to properly handle subdirectories) and HashStore/_db (to fix locks)
* 0.2.27: Add Local and Reload buttons to DwebNav
* 0.2.26: Crawl controls - URL support for UI in dweb-archive
* 0.2.25: Support for crawl/download on related; support for reload; 
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

### Minor releases

* 0.1.2: Support multiple config files in yaml,  [#88](https://github.com/internetarchive/dweb-mirror/issues/88)(minor)
* 0.1.2: Fix bug installing with yarn
* 0.1.1: Added support for multiple cache directories
* 0.1.1: Added support for "copyDirectory" to support cloning to a USB for example. 
* 0.1.1: Support for search collections that have "identifier:xxx*" as the query.  
