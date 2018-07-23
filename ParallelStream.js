process.env.NODE_DEBUG="fs";    //TODO-MIRROR comment out when done testing FS
const fs = require('fs');   // See https://nodejs.org/api/fs.html

const stream = require('readable-stream');

class ParallelStream extends stream.Transform {
    /*
    Implement a variant of TransformStream that allows a configurable number of threads in parallel,

    The key differences are ...
    subclasses should implement _parallel(data, encoding, cb) which has exactly same syntax as _transform in TransformStreams
    Of they can implement _transform (and not work in parallel)

    constructor(options)    Includes {
        parallel: max number of threads to run simultaneously}
        transform:  optional function(data, encoding, cb) to use instead of implementing _parallel
     */

    constructor(options={}) {
        const defaultopts = {
            objectMode: true, // Default to object mode rather than stream of bytes
            highWaterMark: 3
        }   // Default to pushback after 3, will probably raise this
        super(Object.assign(defaultopts, options));
        this.parallel = { limit: options.parallel, count: 0, max: 0} ;    // Note default is NOT to run in parallel (limit undefined)
    }

    _final(cb) {
        if (this.parallel.limit) {
            if (this.parallel.count) {
                console.log("ParallelStream: Waiting on", this.parallel.count,"of max",this.parallel.max,"threads to close");
                setTimeout(()=>this._final(cb), 1000);
                return;
            }
            console.log("ParallelStream: Closed parallel streams. Was max=", this.parallel.max);
        }
        cb();
    }

    _parallel(data, encoding, cb) {
        if (this.parallel.transform) {
            this.parallel.transform(data, encoding, cb);
        } else {
            throw new Error("Subclasses of ParallelStream must implement _parallel(data, encoding, cb) or pass to constructor");
        }
    }

    _transform(data, encoding, cb) {    // A search result got written to this stream
        if (typeof encoding === 'function') { // Allow for skipping encoding parameter (which is unused anyway)
            cb = encoding;
            encoding = null;
        }
        if (this.parallel.limit && (this.parallel.count >= this.parallel.limit)) {
            console.log("MirrorFS: waiting for parallel availability using", this.parallel.count,"of", this.parallel.limit);
            setTimeout(()=>this._transform(data, encoding, cb), 100);   // Delay 100ms and try again
            return;
        }
        try {
            this.parallel.count++;
            if (this.parallel.count > this.parallel.max) this.parallel.max = this.parallel.count;
            this._parallel(data, encoding, (err, data) => {
                if (!this.parallel.limit) {
                    cb(err, data);
                } else {
                    this.push(data);
                }
                this.parallel.count--;
            });
            if (this.parallel.limit) {
                cb(null);   // Return quickly and allow push to pass it on
            }
        } catch(err) { // Shouldnt catch errors - they should only happen inside _parallel and be caught there, triggering cb(err)
            console.log("MirrorFS._transform caught error that _parallel missed", err.message);
            this.parallel.count--;
            cb(err);
        }
    }
}
exports = module.exports = ParallelStream;
