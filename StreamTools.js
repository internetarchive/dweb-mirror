const ParallelStream = require('./ParallelStream');

class _MirrorDebugStream extends ParallelStream {

    constructor(cb, options={}) {
        /* cb is function to turn item into something console.log can handle */
        options.highWaterMark = options.highWaterMark || 99999; // Dont let this debugging cause backpressure itself
        options.objectMode = true;
        super(options);
        this.logfunction = cb;
    }
    // noinspection JSUnusedGlobalSymbols
    _transform(data, encoding, cb) {    // A search result got written to this stream
        if (typeof encoding === 'function') {
            cb = encoding;
            encoding = null;
        }
        try {
            console.log(...this.logfunction(data));
            cb(null, data);
        } catch(err) {
            cb(err);
        }
    }
}

class _MirrorMapStream extends ParallelStream {
    /*
    input stream - any objects
    output stream - transformed depending
     */
    constructor(cb, options={}) {
        super(options);
        this.mapfunction = cb;
    }

    _parallel(o, encoding, cb) {    // A search result got written to this stream
        if (typeof encoding === 'function') { // Allow for skipping encoding parameter (which is unused anyway)
            cb = encoding;
            encoding = null;
        }
        try {
            // cb(null, this.mapfunction(o));   //TODO automate detection of promise
            let p = this.mapfunction(o);
            if (p instanceof Promise) {
                p.then((data) =>  cb(null, data));
            } else {
                cb(null, p);
            }
        } catch(err) {
            cb(err);
        }
    }
}

class _MirrorSplitStream extends ParallelStream {
    /*
    input stream - of arrays
    output stream - expand arrays into a single stream
     */
    _parallel(oo, encoding, cb) {    // A search result got written to this stream
        if (typeof encoding === 'function') { // Allow for skipping encoding parameter (which is unused anyway)
            cb = encoding;
            encoding = null;
        }
        try {
            if (Array.isArray(oo)) {
                oo.forEach(o => this.push(o));
            } else if ((typeof oo) !== "undefined") {
                this.push(oo);
            }
            cb();
        } catch(err) {
            cb(err);
        }
    }
}
class _MirrorSliceStream extends ParallelStream {
    /*
    input stream - of objects (or anything really)
    output stream - equivalent of .splice
     */


    constructor(begin=0, end=undefined, options={}) {
        super(options);
        this.beginx = begin;
        this.endx = end; // Not included, undefined to continue
        this.count = 0; // How many already processed
    }

    _parallel(o, encoding, cb) {
        if (typeof encoding === 'function') { // Allow for skipping encoding parameter (which is unused anyway)
            cb = encoding;
            encoding = null;
        }
        try {
            if ((this.beginx <= this.count) && ((typeof this.endx  === "undefined")|| this.count < this.endx)) {
                this.push(o);
            }
            this.count++; //Note count is how many processed, not how many pushed
            cb();
        } catch(err) {
            cb(err);
        }
    }
}

class _MirrorFilterStream extends ParallelStream {
    /*
    input stream
    output stream filtered by cb
     */
    constructor(cb, options={}) {
        super(options); // None currently
        this.cb = cb;
    }


    _parallel(o, encoding, cb) {    // A search result got written to this stream
        if (typeof encoding === 'function') { // Allow for skipping encoding parameter (which is unused anyway)
            cb = encoding;
            encoding = null;
        }
        try {
            if (this.cb(o)) {
                this.push(o);   // Only push if matches filter
            }
            cb();
        } catch(err) {
            cb(err);
        }
    }
}
class s {
    constructor(options={}) {
        this.options=options;
    }
    map(cb) {
        return new _MirrorMapStream(cb, this.options);
    }
    split() {
        // TODO could add options as to whether should handle single objs as well as arrays and whether to ignore undefined
        return new _MirrorSplitStream(this.options);
    }
    slice(begin, end) {
        return new _MirrorSliceStream(begin, end, this.options);
    }
    filter(cb) {
        return new _MirrorFilterStream(cb, this.options);
    }
    log(cb) {
        return new _MirrorDebugStream(cb, this.options);
    }


}

// usage .pipe(new s(options).map(cb))
exports = module.exports = s;