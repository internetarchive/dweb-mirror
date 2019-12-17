# An overview of mapping of URLs in dweb

Last update 2019-12-17

#### Abbreviations and explanations

* In express (HTTP server in dweb-mirror) parameters are :xyz 

|from|via|to|notes|
|-------|----|---|--|-----|
|/|redirect|/archive/archive.html|
|/admin/setconfig/IDENTIFIER/LEVEL|config.writeUserTaskLevel|info
|/admin/crawl/*/CRAWLID|CrawlManager|crawl status or info
|/arc/archive.org|redirect|/|Legacy
|/arc/archive.org/*|redirect|/*|Legacy
|/archive/bookreader/BookReader/*|_sendFileFromBookreader|config.bookreader.directory/*
|/archive/epubreader/*|_sendFileFromEpubreader|config.epubreader.directory/*
|/archive/*|_sendFileUrlArchive|config.archiveui.directory/*
|/advancedsearch?*|streamQuery, fetch_query, Naming|https://www-dweb-cors.dweb.archive.org/advancedsearch.php?*
|/bookreader/BookReader/*|_sendFileFromBookreader|config.bookreader.directory/*
|/BookReader/BookReaderJSIA.php?*|sendBookReaderJSIA fetch_bookreader|DATANODE/Bookreader/BookreaderJSIA.php?*
|/BookReader/BookReaderJSON.php?*|sendBookReaderJSON fetch_bookreader|DATANODE/Bookreader/BookreaderJSIA.php?*|converts JSIA to JSON format
|/books/IDENTIFIER/ia_manifest|sendBookReaderJSON fetch_bookreader|DATANODE/Bookreader/BookreaderJSIA.php?*|converts JSIA to JSON format (api.ArchiveLab.org)
|/BookReader/BookReaderImages.php|sendBookReaderImages fetchPage|https://DATANODE/BookReader/BookReaderPreview.php or /BookReader/BookReaderImages.php
|/components/*|_sendFileUrlSubdir|config.archiveui.directory/component/*
|/contenthash/HASH|proxyUrl Naming|https://dweb.archive.org/contenthash/HASH|legacy
|/details|redirect|/archive/archive.html|
|/details/IDENTIFIER|redirect|/archive/archive.html?identifier=IDENTIFIER
|/details/IDENTIFIER/page/PAGE|redirect|/archive/archive.html?identifier=IDENTIFIER&page=PAGE|bookreader
|/download/IDENTIFIER/__ia_thumb.jpg|streamThumbnail, Naming|https://archive.org/services/img/IDENTIFIER
|/download/IDENTIFIER/page/PAGE|sendBookReaderImages fetchPage|https://DATANODE/BookReader/BookReaderPreview.php or /BookReader/BookReaderImages.php
|/download/IDENTIFIER|redirect|/archive/archive.html?identifier=IDENTIFIER
|/download/IDENTIFIER/*|streamArchiveFile Naming|https://archive.org/cors/IDENTIFIER/*
|/embed/IDENTIFIER?output=json|sendPlaylist Naming|https://www-dweb-cors.dev.archive.org/embed/IDENTIFIER?output=json
|/epubreader/*|_sendFileFromEpubreader|config.epubreader.directory/*
|/favicon.ico|sendFile|config.archiveui.directory/favicon.ico
|/images/*|sendFileUrlSubdir|config.archiveui.directory/images/*
|/includes/*|sendFileUrlSubdir|config.archiveui.directory/includes/*
|/info|sendInfo|{info}
|/ipfs/CID|proxyUrl|ipfs:/ipfs/CID
|/jw/*|sendFIleUrlSubdir|config.archiveui.directory/jw/*
|/langages/*|sendFileUrlSubdir|config.archiveui.directory/langages/*
|/mds/v1/get_related/all/*|sendRelated Naming|https://be-api.us.archive.org/mds|
|/metadata/IDENTIFIER|fetch_metadata Naming|https://www-dweb-metadata.dev.archive.org/metadata/IDENTIFIER
|/metadata/*|proxyUrl, Naming|https://dweb.archive.org/metadata/*|this is ID/FILENAME and probably broken TODO
|/playlist/IDENTIFIER|sendPlaylist Naming|https://www-dweb-cors.dev.archive.org/embed/IDENTIFIER?output=json
|/search?*|redirect|/archive/archive.html?*
|/search.php|redirect|/archive/archive.html?*
|/serve/IDENTIFIER/FILENAME|streamArchiveFile AF.cacheAndOrStream this.urls|https://archive.org/download/IDENTIFIER/FILENAME, http://www-dweb-torrent.dev.archive.org/IDENTIFIER/IDENTIFIER_archive.torrent etc
|/services/img/IDENTIFIER|streamThumbnail Naming|https://archive.org/services/img/IDENTIFIER
|/stream/IDENTIFIER/UNUSED|redirect|/archive/archive.html?identifier=IDENTIFIER|palmleaf wiki
|/thumbnail/IDENTIFIER|streamThumbnail Naming|https://archive.org/services/img/IDENTIFIER|Legacy
