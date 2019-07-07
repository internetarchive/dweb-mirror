//#!/usr/bin/env node
//process.env.DEBUG="dweb-mirror:mdns";
/*
 * Register multicast DNS
 *
 * Adapted from https://github.com/mafintosh/register-multicast-dns that uses his `multicast-dns`
 *
 *
 */
const addr = require('network-address')
const multicastdns = require('multicast-dns')
const debug = require('debug')('dweb-mirror:mdns');

let mdns;

function registerMDNS(name) {
  name = name.replace('.local', '')
  debug("MDNS registering %s.local", name);
  if (typeof mdns === "undefined") {
    mdns = multicastdns(); }

  mdns.on('error', function () {
    // ignore errors
  })

  mdns.on('query', function (query) {
    query.questions.forEach(q => {
      if ((q.name.replace('.local', '') === name) && ["A","AAAA"].includes(q.type)) {
        debug("MDNS responding to query %s %s", q.type, q.name);
        mdns.respond({
          answers: [{
            name: q.name,
            type: 'A',
            ttl: 300,
            data: addr.ipv4()
          }],
          additionals: [{
            name: q.name,
            type: 'AAAA',
            ttl: 300,
            data: addr.ipv6()
          }]
        })
      } else {
        // This can get very verbose as Apple especially use MDNS a lot for services, just uncomment for debugging
        // debug("MDNS ignoring query %s %s %O", q.type, q.name, query);
      }
    });
  });
}
function destroyMDNS() {
  if (mdns) {
    debug("MDNS Destroying");
    mdns.destroy;
    mdns = undefined;
  } else {
    debug("MDNS Not started, no destroying");
  }
}
//mdns.destroy;

exports = module.exports = {registerMDNS, destroyMDNS};