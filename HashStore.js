const level = require('level');
const errors = require("./Errors.js"); // ToBeImplementedError
const debug = require("debug")("dweb-mirror:HashStore");

class HashStore {
    /*
    A generic Hash Store built on top of level,

    Note this could probably build on top of Redis or Gun as well - Redis might end up too large for memory, and actually want local item store, not global one
     */
    constructor() {
        throw new errors.IntentionallyUnimplementedError("There is no meaningful constructor for HashStore")
    }
    static init(config) {
        this.config = config;
        this.tables = {};
        return this;
    }
    static tablepath(table) {
        return `${this.config.dir}${table}`;
    }
    static db(table) {
        if (!this.tables[table]) {
            this.tables[table] = level(this.tablepath(table));
        }
        return this.tables[table]; // Note file might not be open yet, if not any put/get/del will be queued by level till its ready
    }
    static put(table, key, val, cb) {
        if (typeof cb === "function") { f.call(this, table, key, val).catch(err=>cb(err)).then((res) => cb(null, res))} else return f.call(this, table, key, val);
        function f(table, key, val) {
            debug("%s.%o <- %o", table, key, val);
            if (typeof key === "object") {
                return this.db(table).batch(Object.keys(key).map(k => {
                    return {type: "put", key: k, value: key[k]};
                }));
            } else {
                return this.db(table).put(key, val);
            }
        }
    }
    static async get(table, key, cb) {
        if (cb) { return f.call(this, table, key, cb) } else { return new Promise((resolve, reject) => f.call(this, table, key, (err, res) => { if (err) {reject(err)} else {resolve(res)} }))}        //NOTE this is PROMISIFY pattern used elsewhere        const tab = this.db(table);
        function f(table, key, cb) {
            // This is similar to level.get except not finding the value isnt an error, it returns undefined.
            return this.db(table).get(key, function (err, val) {
                if (err && !err.notFound) cb(null, undefined); // Undefined isnt an error
                if (err) {
                    cb(err);
                }
                debug("%s.%s -> %o", table, key, val);
                cb(null, val);
            });
        }
    }
    static async del(table, key) {
        debug("del %s.%o", table, key);
        if (typeof key === "object") {  // Delete all keys in object
            await this.db(table).batch(Object.keys(key).map(k => {return {type: "del", key: k};}));
        } else {
            await this.db(table).del(key);
        }
    }
    static async map(table, cb, {end=undefined}={}) {
        // cb(data) => data.key, data.value
        // Returns a stream so can add further .on
        // UNTESTED
        return this.db(table)
            .createReadStream()
            .on('data', cb );
    }
    static async keys(table) {
        const keys=[];
        const db = this.db(table);    //synchronous
        return await new Promise(function(resolve, reject) {
                try {
                    db
                        .createKeyStream()
                        // Note close comes after End
                        .on('data', (key) => keys.push(key))
                        .on('end', ()  => {debug("%s keys = %o", table, keys); resolve(keys)})    // Gets to end of stream
                        .on('close', () => resolve(keys))   // Gets to end of stream, or closed from outside
                        .on('error', (err) => { console.error('Error in stream from',table); reject(err)});
                } catch (err) {
                    reject(err);
                }
            }
        );
    }
    static async test() {
        try {
            this.init({dir: "testleveldb."});
            await this.put("Testtable", "testkey", "testval");
            let res = await this.get("Testtable", "testkey");
            console.assert(res === "testval");
            await this.put("Testtable", {A: "AAA", B: "BBB"});
            res = await this.get("Testtable", "A");
            console.assert(res === "AAA");
            res = await this.get("Testtable", "B");
            console.assert(res === "BBB");
            res = await this.del("Testtable", "A");
            res = await this.get("Testtable", "A");
            console.assert(res === undefined);
            res = await this.keys("Testtable");
            console.assert(res.length === 2);
            // Now test batches
            // Now test map
        } catch (err) {
            console.log("Error caught in HashStore.test", err);
        }
    }
}

exports = module.exports = HashStore;

