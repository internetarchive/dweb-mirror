#API for dweb-mirror v0.1.0

This document covers the API for v0.1.0 of dweb-mirror which will be the first semi-stable one. 

#### Outline of APIs

* Config file: Control the behavior of each of the apps in this package
* Apps can be built on top of dweb-archivecontroller's classes:
  ArchiveItem, ArchiveMember, ArchiveFile which are extended by this package.
* A set of classes that provide higher level support esp:
  * 

#### Expected API changes

The API may change fairly frequently up until v1.0.0. Likely changes should be documented here. 

# Config file

#### Expected changes
confi.js is definately going to change to provide both generic control, and an ability to fine grain configuration 
at the app; collection; and item; levels. 

For now - the file is (inadequate) documentation  TODO-DOCS


# Local classes

# ArchiveController and Extensions

##ArchiveFile
See dweb-archivecontroller/API.md for docs before dweb-mirror extensions

*Note* some of this functionality will be moved into dweb-archivecontroller TODO-DOCS

#####ArchiveFile.new(({itemid=undefined, archiveitem=undefined, metadata=undefined, filename=undefined}={}, f(err,data)))

Asynchronously create a new ArchiveFile instance and load its metadata.

```
 archiveitem:   Instance of ArchiveItem with or without its metadata loaded
 itemid:        Identifier of item (only used if archiveitem not defined)
 metadata:      If defined is the result of a metadata API call for loading in AF.metadata
 filename:      Name of an existing file, (may be multipart e.g. foo/bar)
 cb(err, archivefile): passed Archive File
 resolves to:   archivefile if no cb
 errors:        FileNotFound or errors from ArchiveFile() or fetch_metadata()
```

TODO-DOC ... work through rest of ArchiveFilePatched 