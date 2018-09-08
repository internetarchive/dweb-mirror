
//HashStore = require('./HashStore');

//TODO Add tests from each of the classes when/if they exist

process.env.DEBUG="dweb-transports dweb-objects dweb-mirror:*";  // Get highest level debugging of these two libraries, must be before require(dweb-transports) //TODO-MIRROR check using GUN for metadata
const ParallelStream = require('./ParallelStream.js');
/*
ParallelStream.from([0,1,2,3], {name: "Munching"}) .log(m=>[m], {name:"Stream 0..3"}); // 0 1 2 3


ParallelStream.from([0,1,2,3]) .map(m=>m**2) .log(m=>[m], {name:"Stream 0,1,4,9"})

ParallelStream.from([[0,"a"],[1,"b"]]) .log(m=>[m], {name:"Stream [0,a],[1,b]"}) .flatten() .log(m=>[m], {name:"Stream 0,a,1,b"})

ParallelStream.from([0,1,2,3,4]) .filter(m=>m>1 && m<4) .log(m=>[m], {name:"Stream filter 2,3"})

ParallelStream.from([0,1,2,2,1]) .uniq() .log(m=>[m], {name:"Stream uniq 0,1,2"})

ParallelStream.from([0,1,2,3,4]) .slice(2,4) .log(m=>[m], {name:"Stream slice 2,3"})
let ss = ParallelStream.from([0,1]) .fork(2).streams;
ss[0].log(m=>[m], {name: "ForkA 0,1"});
ss[0].log(m=>[m], {name: "ForkB 0,1"});
*/
ParallelStream.from([1,2,3,4]) .finish({
    init: function(){this.sum=0},
    foreach: function(o){this.sum = this.sum+o},
    finally: function() {this.debug("SUM=",this.sum)}} );

// Should be 110 as runs reduce 4 times
ParallelStream.from([10,20,30,40]) .reduce(function(acc,d,i) { return (acc + i + d+1) }, 0, function(res) {this.debug("SUM=", res)}, { name: "Sum=110" });
// Should be 110 as runs reduce 3 times, the 10 is used as initial value.
ParallelStream.from([10,20,30,40]) .reduce(function(acc,d,i) { return (acc + i + d+1) }, undefined, function(res) {this.debug("SUM=", res)}, { name: "Sum=109" });
// Just test that a reduce with no args does an End as expected
ParallelStream.from([10,20,30,40]) .reduce();