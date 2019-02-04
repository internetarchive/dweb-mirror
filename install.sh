#!/bin/bash

# Note - this can be run multiple times, and should adjust to current reality

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
ls -al ${ARCHIVEUI}

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




