process.env.NODE_DEBUG="fs";    //TODO-MIRROR comment out when done testing FS
const fs = require('fs');   // See https://nodejs.org/api/fs.html

const stream = require('readable-stream');
const debug = require('debug');

class ParallelStream extends stream.Transform {
    /*
    Implement a variant of TransformStream that allows a configurable number of threads in parallel,

    The key differences are ...
    subclasses should implement _parallel(data, encoding, cb) which has exactly same syntax as _transform in TransformStreams
    Of they can implement _transform (and not work in parallel)

    constructor(options)    Includes {
        parallellimit: max number of threads to run simultaneously}
        transform:  optional function(data, encoding, cb) to use instead of implementing _parallel
     */

    constructor(options={}) {
        const defaultopts = {
            objectMode: true, // Default to object mode rather than stream of bytes
            highWaterMark: 3,
        };  // Default to pushback after 3, will probably raise this
        let paralleloptions = Object.assign( { limit: undefined, count: 0, max: 0, retryms: 100, silentwait: false}, options.paralleloptions);
        delete options.paralleloptions;
        super(Object.assign(defaultopts, options));
        this.paralleloptions = paralleloptions;
        if (options.parallel) { this._parallel = options.parallel; }
        this.name = options.name || "ParallelStream";
        this.debug = debug(`dweb-mirror:${options.name.replace(' ','_')}`); // Debugger for this log stream
    }

    _final(cb) {
        if (this.paralleloptions.limit) {
            if (this.paralleloptions.count) {
                console.log(this.name, "Waiting on", this.paralleloptions.count,"of max",this.paralleloptions.max,"threads to close");
                setTimeout(()=>this._final(cb), 1000);
                return;
            }
            console.log(this.name, "_final Closing parallel. Was max=", this.paralleloptions.max);
        } else {
            console.log(this.name, "_final Closing");
        }
        cb();
    }

    _parallel(data, encoding, cb) {
        if (this.paralleloptions.transform) {
            this.paralleloptions.transform(data, encoding, cb);
        } else {
            cb(null, data)
            //throw new Error("Subclasses of ParallelStream must implement _parallel(data, encoding, cb) or pass to constructor");
        }
    }

    _transform(data, encoding, cb) {    // A search result got written to this stream
        let psxx =  ParallelStream.xxx++;
        let donecb = false;
        if (typeof encoding === 'function') { cb = encoding; encoding = null; } // Allow for missing parameter
        let name = this.name;
        if (this.paralleloptions.limit && (this.paralleloptions.count >= this.paralleloptions.limit)) {
            if (!this.paralleloptions.silentwait)
                console.log(name, ": waiting ", this.paralleloptions.retryms, "ms for parallel availability using", this.paralleloptions.count,"of", this.paralleloptions.limit);
            setTimeout(()=>this._transform(data, encoding, cb), this.paralleloptions.retryms);   // Delay 100ms and try again
            return;
        }
        try {
            this.paralleloptions.count++;
            if (this.paralleloptions.count > this.paralleloptions.max) this.paralleloptions.max = this.paralleloptions.count;
            this._parallel(data, encoding, (err, data) => {
                if (!this.paralleloptions.limit) {
                    //console.log("XXX@PS68", this.name, psxx)
                    donecb = true;
                    cb(err, data);
                } else {
                    if (!err)
                        this.push(data);
                }
                this.paralleloptions.count--;
            });
            if (this.paralleloptions.limit) {
                //console.log("XXX@PS76", this.name, psxx)
                donecb = true;
                cb(null);   // Return quickly and allow push to pass it on
            }
        } catch(err) { // Shouldnt catch errors - they should only happen inside _parallel and be caught there, triggering cb(err)
            console.error(name, "._transform caught error that _parallel missed", err.message, psxx);
            this.paralleloptions.count--;
            //console.log("XXX@PS82", this.name, psxx)
            if (!donecb)
                cb(err);
        }

    }

    //TODO Building on pattern in https://nodejs.org/api/stream.html#stream_implementing_a_transform_stream

    log(logfunction, options) { //logfunction(m => ["Foo=%s", m.foo])  return array suitable for debug's string processing
        return this.pipe(
            new ParallelStream(Object.assign({
                parallel(data, encoding, cb) {
                    this.debug(...logfunction(data));
                    cb(null, data) // Error in logfunction should through to catcher in _transform
                },
                highWaterMark: 99999,
                name: "log"
            },options))
        )
    }

    logX(cb, options) {
        return this.pipe(new _MirrorDebugStream(cb, options));
    }

    map(cb, options) {
        return this.pipe(new _MirrorMapStream(cb, options));
    }
    flatten(options) {
        return this.pipe(new _MirrorFlattenStream(options));
    }
    end(cbstart, cbperitem, cbfinal, options) {
        return this.pipe(new _MirrorEndStream(cbstart, cbperitem, cbfinal, options));
    }
    filter(cb, options) {
        return this.pipe(new _MirrorFilterStream(cb, options));
    }
    slice(begin, end, options) {
        return this.pipe(new _MirrorSliceStream(begin, end, options));
    }
    /*
    Usage of fork is slightly odd .. ..
    let ss =  .... .fork(2).streams;
    ss[0].log ...; ss[1].filter.... etc
     */
    fork(nstreams, options) {
        return this.pipe(new _MirrorForkStream(nstreams, options));
    }
    uniq(cb, options) {
        return new _MirrorUniqStream(cb, options);
    }

    static fromEdibleArray(ediblearr, options) { // Static
        /*
            Consume array, feeding it to a new stream
         */
        // noinspection JSUnresolvedFunction
        let name = options.name || "EdibleArray";
        let through = new ParallelStream(Object.assign({objectMode: true, highWaterMark: 3}, options));
        try {
            _pushbackablewrite(); // Will .end stream when done
        } catch (err) {
            // Would be unexpected to see error here, more likely _parallel will catch it asynchronously
            console.error(err);
            through.destroy(new Error(`Failure in ${name}.s_fromEdibleArray: ${err.message}`))
        }
        console.log(name, "s_fromEdibleArray ending");
        return through;

        function _pushbackablewrite() { // Asynchronous, retriggerable
            // Note consumes eatable array from parent
            console.log(`Continuing ${name}`);
            try {
                let i;
                while (i = ediblearr.shift()) {
                    if (!through.write(i)) { // It still got written, but there is pushback
                        console.warn(`Pushback at ${name}.${i} from stream=========================`);
                        through.once("drain", _pushbackablewrite);
                        return; // Without finishing
                    }
                } //while
                // Notice the return above will exit if sees backpressure
                through.end();    // Only end on final loop
            } catch(err) {
                console.error(err);
                through.destroy(new Error(`Failure in ${name}._pushbackablewrite: ${err.message}`))
            }
        }
    }
}

class _MirrorDebugStream extends ParallelStream {

    constructor(cb, options={}) {
        /* cb is function to turn item into something console.log can handle */
        super(Object.assign({ highWaterMark: 99999, name: "log"}, options));
        this.logfunction = cb;
    }
    // noinspection JSUnusedGlobalSymbols
    _parallel(data, encoding, cb) {    // A search result got written to this stream
        try {
            this.debug(...this.logfunction(data));
        } catch(err) {
            cb(err);
            return;
        }
        cb(null, data);
    }
}

class _MirrorEndStream extends ParallelStream {

    constructor(cbstart, cbperitem, cbfinal, options={}) {
        /* cb is function to turn item into something console.log can handle */
        options.highWaterMark = options.highWaterMark || 99999; // Dont let this debugging cause backpressure itself
        options.objectMode = true;
        options.name = options.name || "Endstream";
        super(options);
        this.cbperitem = cbperitem;
        this.cbfinal = cbfinal;
        if (cbstart) cbstart(this);
    }
    // noinspection JSUnusedGlobalSymbols
    _parallel(data, encoding, cb) {    // A search result got written to this stream
        try {
            if (this.cbperitem) { this.cbperitem(data, this); } // Note doesnt push
        } catch(err) {
            cb(err);
            return;
        }
        cb(); // Note no data sent on
    }
    _final(cb) {
        if (this.paralleloptions.limit) {
            console.log(this.name, "Probably Shouldnt be running an End stream in parallel")
            if (this.paralleloptions.count) {
                console.log("EndStream: Waiting on", this.paralleloptions.count, "of max", this.paralleloptions.max, "threads to close");
                setTimeout(() => this._final(cb), 1000);
                return;
            }
            //console.log(this.name, "_final Closing parallel. Was max=", this.paralleloptions.max);
        } else {
            //console.log(this.name, "_final Closing");
        }
        // OK cleared any parallel stuff that shouldnt be there!
        if (this.cbfinal) {
            this.cbfinal(this)
        }
        cb();
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
        try {
            // cb(null, this.mapfunction(o));   //TODO automate detection of promise
            let p = this.mapfunction(o);
            if (p instanceof Promise) {
                p.then((data) => cb(null, data))
                    .catch((err) => cb(err));
            } else {
                cb(null, p);
            }
        } catch(err) {
            console.error("_MirrorMapStream._parallel caught error", err.message);
            cb(err);
        }
    }
}

class _MirrorFlattenStream extends ParallelStream {
    /*
    input stream - of arrays
    output stream - expand arrays into a single stream

    TODO could add options as to whether should handle single objs as well as arrays and whether to ignore undefined
     */
    _parallel(oo, encoding, cb) {    // A search result got written to this stream
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
class _MirrorUniqStream extends ParallelStream {
    /*
    input stream
    output stream with non uniq ids removed
     */
    constructor(cb, options={}) {
        options.name = options.name || "uniq";
        super(options); // None currently
        this.uniq = Array.isArray(options.uniq) ? options.uniq : [] ; // Can pass an existing array, which will be filtered out
        this.uniqid = (typeof cb === "function" ? cb : function(a){return a} );
    }

    _parallel(o, encoding, cb) {    // A search result got written to this stream
        try {
            let id = this.uniqid(o);
            if (! this.uniq.includes(id) ) {
                //console.log("Not Duplicate with id=", id);
                this.uniq.push(id);
                this.push(o);   // Only push if uniq
            } else {
                console.log("Duplicate with id=", id);
            }
            cb();
        } catch(err) {
            cb(err);
        }
    }
}


class _MirrorForkStream extends stream.Writable {
    /*
    input stream any objects
    output stream any objects (unmodified)
    with copy to each of the forked stream(s)
    */
    constructor(nstreams, options={}) {
        const defaultopts = {
            objectMode: true, // Default to object mode rather than stream of bytes
            highWaterMark: 3,
        };  // Default to pushback after 3, will probably raise this
        let opts = Object.assign(defaultopts, options)
        super(opts); // None currently
        this.name = options.name || "fork";
        this.streams = Array.from(Array(nstreams)).map(unused=>new ParallelStream(opts));
    }
    _write(o, encoding, cb) {
        if (typeof encoding === 'function') { cb = encoding; encoding = null; } // Allow missing encoding
        try {
            let firstpushback = this.streams.map(s => s.write(o) ? false : s).find(s => !!s); // Writes to all streams, catches first that has pushback
            if (firstpushback) {
                console.warn(`Pushback at $(name) from $(firstpushback.name)`);
                firstpushback.once("drain", cb); // Just wait on first pushback to be ready, should be ok as if 2nd hasn't cleared it will pushback on next write
            } else {
                cb();
            }
        } catch(err) { // Unlikely to have an error since should catch in pushbackable fork
            this.streams.map(s => s.destroy(new Error(`Failure in ${name}._write: ${err.message}`)));
            cb(err);
        }
    }
    _final(cb) {
        this.streams.map(s=>s.end());
        cb();
    }

}

ParallelStream.xxx = 1





exports = module.exports = ParallelStream;
