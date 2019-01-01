# An overview of mapping of URLs in dweb

TODO write abbreviations

#### Abbreviations and explanations

* In express (HTTP server in dweb-mirror) parameters are :xyz 


context|from|to|notes
-------|----|-----|-----|
mirrorHttp|/|/archive/html?mirror:localhost:4244&transport=HTTP|
mirrorHttp|/arc/archive.org|/archive/archive.html|
mirrorHttp|/arc/archive.org/advancedsearch?q=collection::COLL&sort=:SORT|MirrorCollection > fetch_metadata & fetch_query|
mirrorHttp|/arc/archive.org/advancedsearch?q=identifier::ID1 OR ID2|MirrorSearch > fetch_metadata & fetch_query (expand)|
mirrorHttp|/arc/archive.org/advancedsearch?q=:QUERY"|MirrorSearch > fetch_metadata & fetch_query|
mirrorHttp|/arc/archive.org/details|/archive/archive.html|
mirrorHttp|/arc/archive.org/details/:itemid|/archive/archive.html?item=:itemid|
mirrorHttp|/arc/archive.org/download/:itemid/__ia_thumb.jpg|streamThumbnail|
mirrorHttp|/arc/archive.org/download/:itemid/*|streamArchiveFile|
mirrorHttp|/arc/archive.org/images/*|CACHE/images/*|
mirrorHttp|/arc/archive.org/metadata/:itemid|loadedAI|
mirrorHttp|loadedAI(itemid)|ArchiveItem(patched).fetch_metadata
mirrorHttp & config.archiveorg.metadata|/arc/archive.org/metadata/:itemid/:filepath|https://dweb.me/arc/archive.org/metadata/:itemid/:filepath|
mirrorHttp|/arc/archive.org/mds/v1/get_related/all/*|sendRelated > loadedAI & ArchiveItem.relatedItems|
mirrorHttp|/arc/archive.org/mds/*|https://be-api.us.archive.org/mds/*|
mirrorHttp|/arc/archive.org/serve/:itemid/*|streamArchiveFile|
mirrorHttp|/arc/archive.org/services/img/:itemid'|streamThumbnail|
mirrorHttp|/arc/archive.org/thumbnail/:itemid|streamThumbnail|
mirrorHttp|/archive/*|ARCHIVEUIDIR/*|
mirrorHttp & config.upstream|/contenthash/:contenthash|hashstore('sha1.filepath',:contenthash) or dweb.me/contenthash/:contenthash
mirrorHttp|/favicon.ico|ARCHIVEUIDIR/favicon.ico|
mirrorHttp|/images/*|ARCHIVEUIDIR/images|
mirrorHttp|/info|{config: CONFIG}|
DwebTransports & p_resolveNames|dweb:/arc/archive.org/metadata/IDENTIFIER|gun:/gun/arc/archive.org/metadata/IDENTIFIER & https://dweb.me/arc/archive.org/metadata/IDENTIFIER|
mirrorHttp|ArchiveFile(Patched).cacheAndOrStream|MirrorFS(CACHEDIR/IDENTIFIER/FILE, urls)|
mirrorHttp|ArchiveItem(Patched).fetch_metadata|CACHEDIR/IDENTIFIER/{_meta.json, _reviews.json, _files.json etc} or ArchiveItem._fetch_metadata|
mirrorHttp|ArchiveItem(Patched).relatedItems|MirrorFS.cacheAndOrStream(CACHEDIR/IDENTIFIER/IDENTIFIER_related.json, https://be-api.us.archive.org/mds/v1/get_related/all/IDENTIFIER| 
dweb-archivecontroller|ArchiveItem._fetch_metadata|dweb:/arc/archive.org/metadata/IDENTIFIER|
mirrorHttp|ArchiveItem.fetch_query .members unexpanded|CACHEDIR/IDENTIFIER_member_cached.json|
dweb-archivecontroller|ArchiveItem.fetch_query .members unexpanded|dweb.me/arc/archive.org/advancedsearch|
mirrorHttp|ArchiveItem(patched).saveThumbnail|ArchiveFile.cacheAndOrStream(files.find(__ia_thumb.jpg or IDENTIFIER_iteminage.jpg}) or MirrorFS.cacheAndOrStream(item.metadata.thumbnaillinks)
mirrorHtto|MirrorFS.cacheAndOrStream|CACHEDIR or urls|
mirrorHttp|MirrorSearch.fetch_metadata|ArchiveItem.fetch_metadata|
mirrorHttp|MirrorSearch.fetch_query|ArchiveItem.fetch_query|subclass|
mirrorHttp|streamArchiveFile|loadedA;ArchiveFile(patched).cacheAndOrStream|
mirrorHttp|streamThumbnail|loadedAI;ArchiveItem(patched).saveThumbnail|
