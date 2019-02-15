#!/bin/bash
# Note - this can be run multiple times, and should adjust to current reality


set -e # Break on error
set -x

# Not running install as this script is in packages.json so called BY `npm install`
#npm install # Get all the node_modules etc

function firstof {
	while (( "$#" )); do
		POSS="$1"
		if [ -e "${POSS}" ] 
		then
			echo "${POSS}"
            return
		fi
		shift
	done
}
function lnfirst { # lnfirst destn source1 source2 source3 ...
    # Symlink the first source found to the desn
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
# Note the ./dweb-archive/dist works whether this directory is in node_modules or just installed via git clone
ARCHIVEUI=`firstof ../dweb-archive/dist ./node_modules/@internetarchive/dweb-archive/dist`

echo "linking into ArchiveUI at ${ARCHIVEUI}"
pushd "${ARCHIVEUI}"
lnfirst . ../../dweb-objects/dist/dweb-objects-bundle.js \
	../../dweb-mirror/node_modules/@internetarchive/dweb-objects/dist/dweb-objects.bundle.js
lnfirst . ../../dweb-transports/dist/dweb-transports-bundle.js \
	../../dweb-mirror/node_modules/@internetarchive/dweb-transports/dist/dweb-transports.bundle.js
popd
#ls -al ${ARCHIVEUI}
./install_ipfs.sh   # IPFS install in a seperate script as its prone to failure