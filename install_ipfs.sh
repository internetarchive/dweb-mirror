#!/bin/bash
set -x
# I put this script together given the unavailability of any "official" way to install IPFS from a script
# Alternatives include "ipfs-update" which is written in GO, and installs from source, but depends on GO >= 1.9 which means it fails on Raspberry Pis
# Or getting from the web page at 'https://dist.ipfs.io/#ipfs-update' but that isn't easy to automate since the links are version specific
# and currently there is no "latest" link.
# See https://github.com/ipfs/go-ipfs/issues/5998

# Choice of strategy - if none uncommented it will use the best strategy, usually "update"
#STRATEGY="binary" # Go direct to the Go binary
#STRATEGY="update" # Get the binary of ipfs-update and use that to fetch ipfs - this is generally best, and essential if IPFS already installed
#STRATEGY="source" # This will be needed if the binaries arent available for your platform, but GO is.


# Hard coded latest version since "lastest" isn't supported (yet)
# Last line of  https://dist.ipfs.io/go-ipfs/versions is current version number, fetching this is which is what ipfs-update does
IPFS_LATEST_VERSION="`curl -Ls https://dist.ipfs.io/go-ipfs/versions | tail -1`"  # Starts with v
IPFS_CURRENT_VERSION="`ipfs --version 2>/dev/null | cut -c 14-`" # On failure will be empty, starts with digit

# The startup script sets configuration the first time IPFS is run, which we also use in our Docker installs of dweb-gateway
# On dweb-mirror its in dweb-mirror, in dweb its in /app/ but either way should be in PWD
# Note IPFS_STARTSCRIPT uses (but has reasonable defaults) for: IPFS_USER; IPFS_API_PORT; IPFS_GATEWAY_PORT; IPFS_SWAM_PORT; IPFS_WS_PORT
[ -z "${IPFS_STARTSCRIPT}"] && IPFS_STARTSCRIPT="${PWD}/start_ipfs"
if [ -e "${IPFS_STARTSCRIPT}" ];
then
    echo "Will install ${IPFS_STARTSCRIPT} as /usr/local/bin/start-ipfs.sh"
else
    echo "There is no ${IPFS_STARTSCRIPT}, include one if you want to configure ipfs at first run"
fi


# Generic function to get a binary from
function installLatestBinary { #  arg is ipfs-update or go-ipfs
    PACKAGE="$1"
    LATEST_VERSION="`curl -Ls https://dist.ipfs.io/${PACKAGE}/versions | tail -1`" # Starts with v
    CURRENT_VERSION="`${PACKAGE} --version 2>/dev/null | cut -d ' ' -f 3`" # On failure will be empty
     if [ "${CURRENT_VERSION:=0}" = "${LATEST_VERSION}" ]
     then
        echo "Current version of ${PACKAGE} already installed"
    fi
    TARGZ="${PACKAGE}_${LATEST_VERSION}_${GOOS}-${GOARCH}.tar.gz"
    URL=https://dist.ipfs.io/${PACKAGE}/${LATEST_VERSION}/${TARGZ}
        pushd /tmp \
        && curl -Lv -o${TARGZ} ${URL} \
        && tar xvf ${TARGZ} \
        && cd ${PACKAGE} \
        && ./install.sh \
        && popd \
        && echo "You can safely delete /tmp/${TARGZ} and /tmp/ipfs"
}

if [ -n "${IPFS_CURRENT_VERSION}" ]
then
    if [ "v${IPFS_CURRENT_VERSION}" = "${IPFS_LATEST_VERSION}" ]
    then
        echo "Current version of IPFS ${IPFS_LATEST_VERSION} is already installed"
        STRATEGY="skip"
    else
        echo "IPFS installed but not current version, will update"
        STRATEGY="update"
    fi
else
    echo "IPFS does not appear to be installed"

    # Convert the portable uname results into go specific environment
    case `uname -m` in
    "armv7l") GOARCH="arm";;    # e.g. Raspberry 3. Note armv8 and above would use what IPFS has as arm64, armv7 and down want "arm"
    "x86_64") GOARCH="amd64";;         # e.g. a Mac OSX
    i?86) GOARCH="386";;               # e.g. a Rachel3+
    *) echo "Unknown processor type `uname -m`- please check install_ipfs.sh but will try source"; STRATEGY="source";;
    esac
    case `uname -s` in
    "Darwin") GOOS="darwin";;   # e.g. a Mac OSX
    "Linux") GOOS="linux";;     # e.g. Raspberry 3 or Rachel3+
    *) echo "Unknown Operating system type - please check install_ipfs.sh but will try source"; STRATEGY="source";;
    esac


    [ -z "${STRATEGY}" ] && STRATEGY="update"
    case "${STRATEGY}" in
    "binary")
            installLatestBinary go-ipfs
            ;;
    "update")
            installLatestBinary ipfs-update \
            && ipfs-update install latest
            ;;
    "source")
            if (go version 2>/dev/null) && [ -n "${GOPATH}" ]
            then
                echo "Go already installed"
            else
                ./install_go.sh
            fi \
            && go get -u -v github.com/ipfs/ipfs-update \
            && ipfs-update install latest
            ;;
    "skip")
            ;;
    esac
    # first time IPFS_STARTSCRIPT is run it should configure IPFS and init the repo
    if [ -e "${IPFS_STARTSCRIPT}" ]; then
        cp ${IPFS_STARTSCRIPT} /usr/local/bin/start_ipfs
        echo "Start ipfs with: start_ipfs daemon"
    else
        # If you need any config changes on existing packages and dont have start_ipfs they can go here
        ipfs config --json Experimental.FilestoreEnabled true
    fi
fi
