#!/bin/bash

# Note - this can be run multiple times, and should adjust to current reality
npm install # Get all the node_modules etc
if [ -d ../dweb-objects ]

exit # TODO untested from here down

if ! (ipfs --version)
then
    echo "Need to install IPFS from "https://dist.ipfs.io/#go-ipfs"
    open https://dist.ipfs.io/#go-ipfs
    # TODO-INSTALL install IPFS go daemon automagically
else
    ipfs config --json Experimental.FilestoreEnabled true
fi

# TODO update from GIT - using template from previous installtransport.sh

# TODO add docker files as alternative ?
