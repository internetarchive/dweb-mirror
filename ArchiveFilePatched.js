/* eslint-disable func-names */
/*
// Monkey patches dweb-archivecontroller,
// Note cant merge into dweb-archivecontroller as wont work in browser; and cant create subclass as want everywhere e.g. archivefile.fetch_metadata is used to use the cache
 */

// Standard files
const debug = require('debug')('dweb-mirror:ArchiveFile');
const path = require('path');
// Other Archive repos
const { ArchiveFile, routed } = require('@internetarchive/dweb-archivecontroller');
// Local files
const MirrorFS = require('./MirrorFS');

/**
 * Common arguments across all API functions
 *
 * copyDirectory   points at top level of a cache where want a copy
 * relFilePath     path to file or item inside a cache IDENTIFIER/FILENAME
 * noCache         ignore anything in the cache - forces re-fetching and may cause upstream server to cache it TODO-API check this is not obsoleted by separate read and write skipping
 * noStore         do not store results in cache
 * skipFetchFile   as an argument causes file fetching to be suppressed (used for testing only)
 * skipNet         do not try and use the net for anything
 * wantStream      Return results as a stream, just like received from the upstream.
 * wantSize        Return the size as a byte-count.
 * copyDirectory   Specify alternate directory to store results in rather than config.directories[0]
 * darkOk          True if a dark item is a valid response (if false, and item is dark will throw an error)
 * start,end       First and last bytes to return (0 and undefined by default)
 * cb(err, res)    Unless otherwise documented callbacks return an error, (subclass of Error) or null, and optional return data.
 *                 Some functions also support an absent cb as returning a Promise, otherwise cb is required
 *                 feel free to add Promise support to any function lacking it, search for "Promise pattern v2" for examples of how to do this consistently.
 */


/**
 * Cache an ArchiveFile, and - if wantStream=true - stream it to the consumer.
 * skipNet=true means just provide information on the file, do not retrieve from the net.
 * See above for other arguments.
 */
ArchiveFile.prototype.cacheAndOrStream = function ({
    skipFetchFile = false, skipNet = false, wantStream = false, noCache = false, wantSize = false, wantBuff = false,
    copyDirectory = undefined, start = 0, end = undefined
  } = {}, cb) {
  const { identifier } = this; // Not available in events otherwise
  const filename = this.metadata.name;
  const debugname = [identifier, filename].join('/');
  MirrorFS.cacheAndOrStream({ // Try first time without Urls, keep local - note noCache will make this return error unless sha1 specified as no urls either.
    skipFetchFile, wantStream, wantBuff, start, end, debugname, noCache, copyDirectory, wantSize,
    sha1: this.metadata.sha1,
    relFilePath: path.join(identifier, filename),
    expectsize: this.metadata.size,
    ipfs: this.metadata.ipfs // Will usually be undefined as not currently retrieving
  }, (err, streamOrUndefinedOrSizeOrBuff) => {
    if (err && skipNet) {
      cb(err);
    } else if (err) { // Unable to retrieve locally, lets get urls and try again
      // noinspection JSIgnoredPromiseFromCall
      this.urls((err1, urls) => {
        if (err1) {
          cb(err1);
        } else {
          MirrorFS.cacheAndOrStream({
            skipFetchFile, wantStream, wantSize, wantBuff, start, end, debugname, noCache, copyDirectory,
            urls: routed(urls),
            sha1: this.metadata.sha1,
            relFilePath: path.join(identifier, filename),
            expectsize: this.metadata.size,
            ipfs: this.metadata.ipfs // Will usually be undefined as not currently retrieving
          }, (err2, streamOrUndefinedOrSizeOrBuff1) => {
            if (err2) {
              debug('Unable to cacheOrStream %s', debugname);
              cb(err2);
            } else {
              if (!wantStream && !(start || end)) { this.downloaded = true; } // No error, and not streaming so must have downloaded
              cb(null, (wantStream || wantSize || wantBuff) ? streamOrUndefinedOrSizeOrBuff1 : this);
            }
          });
        }
      });
    } else { // The local check succeeded
      this.downloaded = true;
      cb(null, (wantStream || wantSize || wantBuff) ? streamOrUndefinedOrSizeOrBuff : this);
    }
  });
};

/**
 * Return true if the file is downloaded
 * See common arguments above.
 */
ArchiveFile.prototype.isDownloaded = function ({ copyDirectory = undefined }, cb) {
  if (this.downloaded === true) { // Already know its downloaded - note not rechecking, so its possible it was deleted.
    cb(null, this.downloaded);
  } else { // Maybe, lets check
    this.cacheAndOrStream({
      copyDirectory, skipNet: true, wantStream: false, wantSize: !this.metadata.size
    }, (err, res) => {
      if (!err && !this.metadata.size) {
        this.metadata.size = `${res}`; // TODO needs to be a string
      }
      // cacheAndOrStream has side effect of setting downloaded
      cb(null, !err);
    });
  }
};

exports = module.exports = ArchiveFile;
