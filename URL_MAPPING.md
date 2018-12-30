# An overview of mapping of URLs in dweb

TODO-2SC -expand & check notes below and write abbreviations

#### Abbreviations and explanations

* In express (HTTP server in dweb-mirror) parameters are :xyz 


from|to|in|notes
-----|-----|-----|---
/|/archive/html?mirror:localhost:4244&transport=HTTP|mirrorHTTP|sets up appropriate parameters to keep mirroring
/arc/archive.org|/archive/archive.html|mirrorHTTP|
/arc/archive.org/advancedsearch?q=collection::COLL&sort=:SORT|MirrorCollection > fetch_metadata & fetch_query|mirrorHTTP|
/arc/archive.org/advancedsearch?q=identifier::ID1 OR ID2|MirrorSearch > fetch_metadata & fetch_query (expand)|mirrorHTTP|
/arc/archive.org/advancedsearch?q=:QUERY"|MirrorSearch > fetch_metadata & fetch_query|mirrorHTTP|
/arc/archive.org/details|/archive/archive.html|mirrorHTTP|
/arc/archive.org/details/:itemid|/archive/archive.html?item=:itemid|mirrorHTTP|
/arc/archive.org/download/:itemid/__ia_thumb.jpg|streamThumbnail|mirrorHTTP|TODO-EXPAND
/arc/archive.org/download/:itemid/*|streamArchiveFile|mirrorHTTP|TODO-EXPAND
/arc/archive.org/images/*|CACHE/images/*|mirrorHTTP|
/images/*|CACHE/images|mirrorHTTP|TODO-CHECK appears to conflict below
/arc/archive.org/metadata/:itemid|CACHE/:itemid/{:itemid_meta.json etc}|mirrorHTTP & ArchiveItemPatched
/arc/archive.org/metadata/:itemid|dweb:/arc/archive.org/metadata/:itemid|ArchiveItem.fetch_metadata|TODO-CHECK
/arc/archive.org/metadata/:itemid/:filepath|dweb.me/arc/archive.org/metadata/:itemid/:filepath|mirrorHttp&config.archiveorg.metadata|TODO-CHECK
/arc/archive.org/mds/v1/get_related/all/*|sendRelated|mirrorHttp|TODO-EXPAND
/arc/archive.org/mds/*|<< config.archiveorg.mds,req.params[0]|mirrorHttp|TODO-EXPAND
/arc/archive.org/serve/:itemid/*|streamArchiveFile|mirrorHttp|TODO-EXPAND
/arc/archive.org/services/img/:itemid'|streamThumbnail|mirrorHttp|TODO-EXPAND
/arc/archive.org/thumbnail/:itemid|streamThumbnail|mirrorHttp|TODO-EXPAND
/archive/*|ARCHIVEUIDIR/*|mirrorHttp|
/contenthash/:contenthash|streamContenthash|mirrorHttp|TODO-EXPAND & CHECK WHY BEFORE HASHSTORE
/contenthash/:contenthash|hashstore('sha1.filepath',:contenthash)mirrorHttp|
/contenthash/*|proxyUpstream|mirrorHttp|TODO-EXPAND
/favicon.ico|ARCHIVEUIDIR/favicon.ico|mirrorHttp|
/images/*|ARCHIVEUIDIR/images|mirrorHttp|TODO-CHECK appears to conflict above
/info|{config: CONFIG}|mirrorHttp|
MirrorSearch.fetch_metadata|ArchiveItem.fetch_metadata|subclass|
ArchiveItem.fetch_metadata|CACHEDIR/IDENTIFIER/{_meta.json, _reviews.json, _files.json etc}|ArchiveItemPatched|
ArchiveItem.fetch_metadata|dweb:/arc/archive.org/metadata/IDENTIFIER|ArchiveItem|TODO-CHECK
MirrorSearch.fetch_query|ArchiveItem.fetch_query|subclass|
ArchiveItem.fetch_query .members unexpanded|CACHEDIR/IDENTIFIER_member_cached.json|ArchiveItemPatched|
ArchiveItem.fetch_query .members unexpanded|dweb.me/arc/archive.org/advancedsearch|ArchiveItem._fetch_query|
