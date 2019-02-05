#!/bin/bash
# Note - this can be run multiple times, and should adjust to current reality


set -e # Break on error

# Not running install as this script is in packages.json so called BY `npm install`
#npm install # Get all the node_modules etc

function firstof {
	while (( "$#" )); do
		POSS="$1"
		if [ -e "${POSS}" ] 
		then
			echo "${POSS}"
		fi
		shift
	done
}
function lnfirst {
	DEST="$1"
	shift
	while (( "$#" )); do
		POSS="$1"
		if [ -e ${POSS} ] 
		then
			echo "Linking ${POSS} -> ${DEST}"
			ln -fs ${POSS} ${DEST}
			return
		fi
		shift
	done
}
# Where to serve the ARCHIVEUI from , this must be the same list as in <config>/archiveui/directory
ARCHIVEUI=`firstof ../node_modules/dweb-archive/dist ./node_modules/@internetarchive/dweb-archive/dist`

pushd "${ARCHIVEUI}"
lnfirst . ../../dweb-mirror/@internetarchive/dweb-objects/dist/dweb-objects-bundle.js \
	../../dweb-objects/dist/dweb-objects-bundle.js \
	../../dweb-mirror/node_modules/@internetarchive/dweb-objects/dist/dweb-objects.bundle.js
lnfirst . ../../dweb-mirror/@internetarchive/dweb-transports/dist/dweb-transports-bundle.js \
	../../dweb-transports/dist/dweb-transports-bundle.js \
	../../dweb-mirror/node_modules/@internetarchive/dweb-transports/dist/dweb-transports.bundle.js
popd
#ls -al ${ARCHIVEUI}


BREW=`which brew`
APTGET=`which apt-get`
IPFS_PATH=
#TODO-IPFS
if ! (ipfs --version) # 0.4.17
then
    # Copied from dweb/Dockerfile
    # Dont appear to need these that Dockerfile installs: redis-server supervisor zsh git python3-pip curl sudo nginx python3-nacl golang nodejs npm cron
    if [ -n ${APTGET} ]
    then
        ${APTGET} -y update && ${APTGET} -y install golang
    elif [ -n ${BREW} ]
    then
         ${BREW} install golang
    fi
    go get -u -v github.com/ipfs/ipfs-update \
    && ipfs-update install latest
    && cp /app/ipfs_container_daemon_modified.sh /usr/local/bin/start_ipfs
    exit # This is how far got with testing ipfs

    #echo "Need to install IPFS from "https://dist.ipfs.io/#go-ipfs"
    #open https://dist.ipfs.io/#go-ipfs
    # TODO-INSTALL install IPFS go daemon automagically
else
    ipfs config --json Experimental.FilestoreEnabled true
fi




