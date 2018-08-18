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
            highWaterMark: 3,
        };  // Default to pushback after 3, will probably raise this
        super(Object.assign(defaultopts, options));
        this.name = options.name || "ParallelStream";
        this.parallel = { limit: options.parallel, count: 0, max: 0, retryms: options.retryms || 100, silentwait: options.silentwait || false} ;    // Note default is NOT to run in parallel (limit undefined)
    }

    _final(cb) {
        if (this.parallel.limit) {
            if (this.parallel.count) {
                console.log(this.name, "Waiting on", this.parallel.count,"of max",this.parallel.max,"threads to close");
                setTimeout(()=>this._final(cb), 1000);
                return;
            }
            console.log(this.name, "_final Closing parallel. Was max=", this.parallel.max);
        } else {
            console.log(this.name, "_final Closing");
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
        let psxx =  ParallelStream.xxx++;
        let donecb = false;
        if (typeof encoding === 'function') { // Allow for skipping encoding parameter (which is unused anyway)
            cb = encoding;
            encoding = null;
        }
        let name = this.name;
        if (this.parallel.limit && (this.parallel.count >= this.parallel.limit)) {
            if (!this.parallel.silentwait)
                console.log(name, ": waiting ", this.parallel.retryms, "ms for parallel availability using", this.parallel.count,"of", this.parallel.limit);
            setTimeout(()=>this._transform(data, encoding, cb), this.parallel.retryms);   // Delay 100ms and try again
            return;
        }
        try {
            this.parallel.count++;
            if (this.parallel.count > this.parallel.max) this.parallel.max = this.parallel.count;
            this._parallel(data, encoding, (err, data) => {
                if (!this.parallel.limit) {
                    //console.log("XXX@PS68", this.name, psxx)
                    donecb = true;
                    cb(err, data);
                } else {
                    this.push(data);
                }
                this.parallel.count--;
            });
            if (this.parallel.limit) {
                //console.log("XXX@PS76", this.name, psxx)
                donecb = true;
                cb(null);   // Return quickly and allow push to pass it on
            }
        } catch(err) { // Shouldnt catch errors - they should only happen inside _parallel and be caught there, triggering cb(err)
            console.error(name, "._transform caught error that _parallel missed", err.message, psxx);
            this.parallel.count--;
            //console.log("XXX@PS82", this.name, psxx)
            if (!donecb)
                cb(err);
        }
    }
}
ParallelStream.xxx = 1

exports = module.exports = ParallelStream;
