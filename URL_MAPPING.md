# An overview of mapping of URLs in dweb

NOTE THIS IS OUT OF DATE, NEEDS A MAINTENANCE PASS, DONT RELY ON IT BEING ACCURATE

#### Abbreviations and explanations

* In express (HTTP server in dweb-mirror) parameters are :xyz 


context|from|to|notes
-------|----|-----|-----|
mirrorHttp|/|/archive/html?mirror:localhost:4244&transport=HTTP|
mirrorHttp|/arc/archive.org/*|/*|Handle legacy /arc/archive.org urls
mirrorHttp|/arc/archive.org|/archive/archive.html|
mirrorHttp|/advancedsearch?q=collection::COLL&sort=:SORT|ArchiveItem > fetch_metadata & fetch_query|
mirrorHttp|/advancedsearch?q=identifier::ID1 OR ID2|ArchiveItem > fetch_metadata & fetch_query (expand)|
mirrorHttp|/advancedsearch?q=:QUERY"|ArchiveItem > fetch_metadata & fetch_query|
mirrorHttp|/details|/archive/archive.html|
mirrorHttp|/details/:itemid|/archive/archive.html?item=:itemid|
mirrorHttp|/download/:itemid/__ia_thumb.jpg|streamThumbnail|
mirrorHttp|/download/:itemid/*|streamArchiveFile|
mirrorHttp|/images/*|CACHE/images/*|
mirrorHttp|/metadata/:itemid|loadedAI|
mirrorHttp|loadedAI(itemid)|ArchiveItem(patched).fetch_metadata
mirrorHttp|/metadata/:itemid/:filepath|https://dweb.archive.org/metadata/:itemid/:filepath|
mirrorHttp|/mds/v1/get_related/all/*|sendRelated > loadedAI & ArchiveItem.relatedItems|
mirrorHttp|/mds/*|https://be-api.us.archive.org/mds/*|
mirrorHttp|/serve/:itemid/*|streamArchiveFile|
mirrorHttp|/services/img/:itemid'|streamThumbnail|
mirrorHttp|/thumbnail/:itemid|streamThumbnail|
mirrorHttp|/archive/*|ARCHIVEUIDIR/*|
mirrorHttp & config.upstream|/contenthash/:contenthash|hashstore('sha1.filepath',:contenthash) or dweb.me/contenthash/:contenthash
mirrorHttp|/favicon.ico|ARCHIVEUIDIR/favicon.ico|
mirrorHttp|/images/*|ARCHIVEUIDIR/images|
mirrorHttp|/info|{config: CONFIG}|
DwebTransports & p_resolveNames|dweb:/arc/archive.org/metadata/IDENTIFIER|gun:/gun/arc/archive.org/metadata/IDENTIFIER & https://dweb.archive.org/metadata/IDENTIFIER|
mirrorHttp|ArchiveFile(Patched).cacheAndOrStream|MirrorFS(CACHEDIRS/IDENTIFIER/FILE, urls)|
mirrorHttp|ArchiveItem(Patched).fetch_metadata|CACHEDIR/IDENTIFIER/{_meta.json, _reviews.json, _files.json etc} or ArchiveItem._fetch_metadata|
mirrorHttp|ArchiveItem(Patched).relatedItems|MirrorFS.cacheAndOrStream(CACHEDIRS/IDENTIFIER/IDENTIFIER_related.json, https://be-api.us.archive.org/mds/v1/get_related/all/IDENTIFIER| 
dweb-archivecontroller|ArchiveItem._fetch_metadata|www-dweb-metadata.dev.archive.org:/metadata/IDENTIFIER|
mirrorHttp|ArchiveItem.fetch_query .members unexpanded|CACHEDIR/IDENTIFIER_member_cached.json|
dweb-archivecontroller|ArchiveItem.fetch_query .members unexpanded|dweb.archive.org/advancedsearch|
mirrorHttp|ArchiveItem(patched).saveThumbnail|ArchiveFile.cacheAndOrStream(files.find(__ia_thumb.jpg or IDENTIFIER_itemimage.jpg}) or MirrorFS.cacheAndOrStream(/services/img/IDENTIFIER)
mirrorHttp|MirrorFS.cacheAndOrStream|CACHEDIRS or urls|
mirrorHttp|streamArchiveFile|loadedA;ArchiveFile(patched).cacheAndOrStream|
mirrorHttp|streamThumbnail|loadedAI;ArchiveItem(patched).saveThumbnail|
