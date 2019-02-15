#!/bin/bash

# I put this script together given the unavailability of any "official" way to install IPFS from a script
# Alternatives include "ipfs-update" which is written in GO, and installs from source, but depends on GO >= 1.9 which means it fails on Raspberry Pis
# Or getting from the web page at 'https://dist.ipfs.io/#ipfs-update' but that isn't easy to automate since the links are version specific
# and currently there is no "latest" link.
# See https://github.com/ipfs/go-ipfs/issues/5998

# Hard coded latest version since "lastest" isn't supported (yet)
IPFSLATESTVERSION=0.4.18

# First figure out if we'll use brew or apt-get
if (which apt-get)
then
    apt-get -y update
    INSTALL="apt-get -y install"
elif (which brew)
then
    INSTALL="brew install"
else
    echo "Neither apt-get nor brew found"
    exit 1
fi

IPFS_PATH=
# The startup script sets configuration the first time IPFS is run, which we also use in our Docker installs of dweb-gateway
# On dweb-mirror its in dweb-mirror, in dweb its in /app/ but either way should be in CWD
# Note IPFS_STARTSCRIPT uses (but has reasonable defaults) for: IPFS_USER; IPFS_API_PORT; IPFS_GATEWAY_PORT; IPFS_SWAM_PORT; IPFS_WS_PORT
IPFS_STARTSCRIPT="${PWD}/ipfs_container_daemon_modified.sh"
if [ ! -e "${IPFS_STARTSCRIPT}" ]; then
    echo "Missing ${IPFS_STARTSCRIPT}"
    exit 1
fi
if ! (ipfs --version) # 0.4.17
then
    echo "No IPFS found"
    if [ `uname -m` -eq "armv71" ] # e.g. Raspberry 3. Note armv8 and above would use what IPFS has as arm64, armv7 and down want "arm"
    then
        echo "Its an ${PROCESSOR}, e.g. a Raspberry 3. apt-get on this platform as of Feb2019 only gets go-v1.7 which is incompatible with ipfs-update so we wont even try and install from source"
        IPFSTAR=go-ipfs_v${IPFSLATESTVERSION}_linux-arm.tar.gz
        pushd /tmp \
        && curl -o${IPFSTAR} https://dist.ipfs.io/go-ipfs/v${IPFSLATESTVERSION}/${IPFSTAR} \
        && tar xvf ${IPFSTAR} \
        && ./install.sh \
        && popd \
        && echo "You can safely delete /tmp/${IPFSTAR} and /tmp/ipfs"
    else
        if [`uname -s` -eq "Darwin" ]
        then
            echo "Its a Mac, should be able to install go and compile from source"
        else
            echo "OS=`uname -s` processor=`uname -m` lets hope it installs from go source"
        fi
        # Install ipfs from source - first time IPFS_STARTSCRIPT is run it will configure IPFS.
        ./install_go.sh \
        && go get -u -v github.com/ipfs/ipfs-update \
        && ipfs-update install latest
    fi
    # Move a start script to start_ipfs. Run this as "start_ipfs daemon"
    cp ${IPFS_STARTSCRIPT} /usr/local/bin/start_ipfs
else
    echo "IPFS `ipfs --version` already installed "
    # If you need any config changes on existing packages they can go here
    #ipfs config --json Experimental.FilestoreEnabled true
fi
