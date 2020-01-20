/*
 * Sorry - this is ugly, OLIP uses "opensearch" which is XML based,
 * and to avoid including overweight XML libraries,
 * I will output stuff via templates
 */
const ArchiveItem = require('./ArchiveItemPatched');
const ItemsPerPage = 75;

function doQuery(o, opts, config, cb) {
  o.fetch_metadata(opts, (err, unused) => { // Not passing noCache as query usually after a fetch_metadata
    if (err) {
      debug('streamQuery could not fetch metadata for %s', o.itemid);
      cb(err);
    } else {
      o.fetch_query({copyDirectory: opts.copyDirectory, wantFullResp: true, noCache: opts.noCache}, (err, resp) => { // [ArchiveMember*]
        if (err) {
          debug('streamQuery for q="%s" failed with %s', o.query, err.message);
          cb(err);
        } else {
          // Note we are adding crawlinfo to o - the ArchiveItem, but the resp.response.docs
          // is an array of pointers into same objects so its getting updated as well
          if (!opts.wantCrawlInfo) {
            cb(null, resp);
          } else {
            o.addCrawlInfo({config, copyDirectory: opts.copyDirectory}, (unusederr, unusedmembers) => {
              resp.response.downloaded = o.downloaded;
              resp.response.crawl = o.crawl;
              cb(null, resp);
            });
          }
        }
      });
    }
  });
}
// https://github.com/dewitt/opensearch/blob/master/opensearch-1-1-draft-6.md#opensearch-response-elements
// https://validator.w3.org/feed/docs/atom.html

function atomFeedInfo(resp, {query, opts}) {
  // Skipping paging as OLIP not doing it
  const {protoHost} = opts;
  const queryString = query.q;
  const encQuery = encodeURIComponent(queryString);
  const now = new Date(Date.now()).toISOString();
  return `
<title>Offline Internet Archive Search: ${queryString}</title>
    <link href="${protoHost}/${encQuery}"/>
    <updated>${now}</updated>
  <author>
      <name>Offline Internet Archive</name>
  </author>
  <id>http://archive.org/search/${encQuery}</id>
  <opensearch:totalResults>${resp.response.numFound}</opensearch:totalResults>
  <opensearch:startIndex>${resp.response.start}</opensearch:startIndex>
  <opensearch:itemsPerPage>${ItemsPerPage}</opensearch:itemsPerPage>
  <opensearch:Query role="request" searchTerms=${queryString} startPage="${Math.floor(resp.response.start / ItemsPerPage)}" />
  <link rel="search" type="application/opensearchdescription+xml" href="${protoHost}/opensearch"/>
  `;
}
function atomEntry(m, {protoHost}) {
  // TODO note archive search results dont usually include description field as can be large so <content/> omitted
  return `
    <entry>
      <title>${m.title}</title>
      <link href="${protoHost}/details/${m.identifier}"/>
      <id>https://archive.org/details/${m.identifier}</id>
      <updated>${m.publicdate}</updated>
    </entry>
  `;
}
function atomFrom(resp, req) {
  return `
    <?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
      ${atomFeedInfo(resp, req)}
      ${resp.response.docs.map(m => atomEntry(m, req.opts)).join('')}
    </feed>
  `;
}
function XMLdescriptor({protoHost=undefined}={}) {
  return `
    <?xml version="1.0" encoding="UTF-8"?>
    <OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
      <ShortName>Offline Internet Archive</ShortName>
      <Description>Offline Internet Archive search engine</Description>
      <Url type="application/atom+xml" template="${protoHost}/opensearch?q={searchTerms}"/>
    </OpenSearchDescription>
  `;
}
function searchExpress(req, res, next) {
  // req should have proto host set to e.g. http://localhost:4244 or https://www-dweb-mirror.dev.archive.org
  if (!req.query.q) {
    res.status(200).send(XMLdescriptor(req.opts));
  } else {
    const sort = "-downloads"; // Opensearch doesnt specify any other metric
    const o = Object.assign(new ArchiveItem({sort, query: req.query.q}), { rows: ItemsPerPage, page: 1, });
    doQuery(
      o,
      Object.assign(req.opts, {wantCrawlInfo: false}),
      undefined, // config - used with crawl info - since have no way to return in Atom, for now its undefined
      (err, searchResult) => {  // Looks like Archive search result with downloaded and crawl fields added
        if (err) {
          next(err); // doQuery sends to debug
        } else {
          res.status(200).send(atomFrom(searchResult, req));
        }
      }
    );
  }
}


exports = module.exports = {searchExpress, doQuery};
