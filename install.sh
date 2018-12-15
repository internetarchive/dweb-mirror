#!/bin/bash

# Note - this can be run multiple times, and should adjust to current reality

# Not running install as this script is in packages.json so called BY `npm install`
#npm install # Get all the node_modules etc


exit # IPFS NOT INTEGRATED YET
#TODO-IPFS
if ! (ipfs --version)
then
    echo "Need to install IPFS from "https://dist.ipfs.io/#go-ipfs"
    open https://dist.ipfs.io/#go-ipfs
    # TODO-INSTALL install IPFS go daemon automagically
else
    ipfs config --json Experimental.FilestoreEnabled true
fi




