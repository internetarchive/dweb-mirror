const MirrorBaseStream = require('./MirrorBaseStream');

class _MirrorMapStream extends MirrorBaseStream {
    /*
    input stream - any objects
    output stream - transformed depending
     */
    constructor(cb, options={}) {
        super(options)
        this.mapfunction = cb;
    }

    _transform(o, encoding, cb) {    // A search result got written to this stream
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

class _MirrorSplitStream extends MirrorBaseStream {
    /*
    input stream - of arrays
    output stream - expand arrays into a single stream
     */
    _transform(oo, encoding, cb) {    // A search result got written to this stream
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


class s {
    constructor(options={}) {
        this.options=options;
    }
    map(cb) {
        return new _MirrorMapStream(cb, this.options);
    }
    split() {
        return new _MirrorSplitStream(this.options);
    }
}

// usage .pipe(new s(options).map(cb))
exports = module.exports = s;