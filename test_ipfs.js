process.env.DEBUG="test_ipfs dweb-transports dweb-transports:* dweb-objects dweb-objects:*";    //TODO-MIRROR comment out when done testing FS

const ipfsAPI = require('ipfs-api');
const IPFS = require('ipfs');
const debugf = require('debug')

const debug = debugf('test_ipfs');

//TODO migrate this into TransportsIPFS its probably the right approach for any browser
function IPFSconnect(cb) {
    if (global.ipfs || (typeof window !== "undefined" && window.ipfs)) {
        debug("ipfs already available in global address space");
    } else {
        ipfs = ipfsAPI('localhost', '5001', {protocol: 'http'})// leaving out the arguments will default to these values
        ipfs.version((err, data) => {
            if (err) {
                debug("ipfs-api version failed %s, trying running own IPFS client", err.message)
                ipfs = new IPFS({
                    repo: '/tmp/ipfsrepo', //TODO-IPFS think through where, esp for browser
                    config: {Bootstrap: ['/dns4/dweb.me/tcp/4245/wss/ipfs/QmPNgKEjC7wkpu3aHUzKKhZmbEfiGzL5TP1L8zZoHJyXZW']}, // Connect via WSS to IPFS instance at IA
                    EXPERIMENTAL: {pubsub: true}
                });
                ipfs.on('ready', () => {
                    debug("IPFS client ready");
                    cb()
                });   // This only works in the client version, not on API
                ipfs.on('error', (err) => {
                    debug("IPFS client error %s", err.message); // Dont call cb(err)
                }) // This only works in the client version, not on API
            } else {
                debug("IPFS API succeeded %s", data);
                cb();
            }
        });
    }
}
IPFSconnect((err, data) => {
    if (err) throw err;
    debug("Connect successfull")
});
