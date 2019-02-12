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

set +e # Errors ok here, we are testing for these two options
BREW=`which brew`
APTGET=`which apt-get`
set -e

#TODO-IPFS

IPFS_PATH=
# On dweb-mirror its in dweb-mirror, in dweb its in /app/ but either way should be in CWD
IPFS_STARTSCRIPT="${PWD}/ipfs_container_daemon_modified.sh"
if [ ! -e "${IPFS_STARTSCRIPT}" ]; then
    echo "Missing ${IPFS_STARTSCRIPT}"
    exit
fi
# Can also override variables used in IPFS_STARTSCRIPT: IPFS_USER; IPFS_API_PORT; IPFS_GATEWAY_PORT; IPFS_SWAM_PORT; IPFS_WS_PORT
if ! (ipfs --version) # 0.4.17
then
    echo "No IPFS found - installing with GO"
    # Copied from dweb/Dockerfile
    # Dont appear to need these that Dockerfile installs: redis-server supervisor zsh git python3-pip curl sudo nginx python3-nacl golang nodejs npm cron
    if [ -n "${APTGET}" ]
    then
        ${APTGET} -y update && ${APTGET} -y install golang
    elif [ -n "${BREW}" ]
    then
         ${BREW} install golang
    fi
    #Alternative is to install IPFS directly from "https://dist.ipfs.io/#go-ipfs" via a browser
    #open https://dist.ipfs.io/#go-ipfs

    # Install ipfs from source - first time IPFS_STARTSCRIPT is run it will configure IPFS.
    go get -u -v github.com/ipfs/ipfs-update \
    && ipfs-update install latest \
    && cp ${IPFS_STARTSCRIPT} /usr/local/bin/start_ipfs
else
    echo "IPFS `ipfs --version` already installed "
    ipfs config --json Experimental.FilestoreEnabled true
fi



