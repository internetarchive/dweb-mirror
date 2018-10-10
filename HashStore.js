const level = require('level');
const errors = require("./Errors.js"); // ToBeImplementedError


class HashStore {
    /*
    A generic Hash Store built on top of level,
    NOT CURRENTLY USED

    TODO - this could probably build on top of Redis as well.
     */
    constructor() {
        throw new errors.IntentionallyUnimplementedError("There is no meaningful constructor for HashStore")
    }
    static async init(config) {
        this.config = config;
        this.tables = {}
    }
    static db(table) {
        if (!this.tables[table]) {
            this.tables[table] = level(`${this.config.dir}${table}`);
        }
        return this.tables[table]; // Note file might not be open yet, if not any put/get/del will be queued by level till its ready
    }
    static async put(table, key, val) {
        if (typeof key === "object") {
            await this.db(table).batch(Object.keys(key).map(k => {return {type: "put", key: k, value: key[k]};}));
        } else {
            await this.db(table).put(key, val);
        }
    }
    static async get(table, key) {
        const tab = this.db(table);
        //return await tab.get(key); // Fails ...see https://github.com/Level/level/issues/97
        // Promisified get because of bug reported above.
        return new Promise((resolve, reject) => tab.get(key, function(err, val) {
            if (err && err.notFound) resolve(undefined);
            if (err) { reject(err) }
            resolve(val);
        }));
    }
    static async del(table, key) {
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
                        .on('end', ()  => resolve(keys))    // Gets to end of stream
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
            await this.init({dir: "testleveldb."});
            await this.put("Testtable", "testkey", "testval");
            let res = await this.get("Testtable", "testkey");
            console.assert(res === "testval");
            await this.put("Testtable", {A: "AAA", B: "BBB"});
            res = await this.get("Testtable", "A");
            console.log("Get after put obj, res=", res);
            console.assert(res === "AAA");
            res = await this.get("Testtable", "B");
            console.assert(res === "BBB");
            res = await this.del("Testtable", "A");
            res = await this.get("Testtable", "A");
            console.log("Get after del res=", res);
            console.assert(res === undefined);
            res = await this.keys("Testtable");
            console.log("DONE",res)
            // Now test batches
            // Now test map
        } catch (err) {
            console.log("Error caught in HashStore.test", err);
        }
    }
}
exports = module.exports = HashStore;

