#!/bin/bash
# This script is intended to make sure GO is installed for a variety of platforms, especially MacOS, RaspberryPi and Rachel3+

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


# First have to see if have a version of go already
if (go version)
then
    # TODO if anyone can figure out some math on the go version and then to go ot apt-get if its <=1.9 and then to fail if apt-get doesn't fix that
    echo "Go appears to be installed: `go version`;
    echo "If this version is not >= 1.9 then install of ipfs-update will fail, try \"apt-get -y install golang\" and see if it improves version number"
    if [ -n "${GOPATH}" ]
    then
        echo "Go is telling us it is at ${GOPATH} so we wont try and guess"
    else
        echo "GOPATH isnt set so guessing where to find it"
        if [ -d "/usr/lib/go" ]
        then
            export GOPATH="/usr/lib/go"
        elif [ -f "${HOME}/go" ]
        then
            export GOPATH="${HOME}/go"
        else
            echo "GOPATH isnt set and we cant find go"
            echo "Unless you have it somewhere strange then please edit install_go.sh so it finds it automatically, and please submit as a PR"
        fi
        if [ -e "${HOME}/.profile" ]
        then PROFILE=${HOME}/.profile
        elif [ -e "${HOME}/.bash_profile" ]; then PROFILE=[ -e "${HOME}/.bash_profile" ]
        else touch ${HOME}/.profile
        fi
        cat >>${PROFILE} <<EOT # THis might fail if it uses .bash_profile instead or if .profile doesnt exist
            export GOPATH=${GOPATH}
            export PATH='${GOPATH}:${PATH}'
EOT
    fi
else
    echo "Installing go (so we can install ipfs)"
    export GOPATH="/usr/lib/go"
    # TODO unclear best place to put go $HOME/go is default in 1.8 (current version is 1.7), but RPi seems to already have in /usr/lib
    # Note the download is about 110Mb
    if [ `uname -m` -eq "armv71" ]
    then
        GOTAR=go1.10.3.linux-armv6l.tar.gz
        echo "apt-get on RPi installs 1.7 which is too old for IPFS - note we try and avoid installing go for ipfs see install_ipfs"
        mkdir -p /usr/lib/go \
        && pushd /tmp \
        && curl -o${GOTAR} https://dl.google.com/go/${GOTAR} \
        && tar -C /usr/lib -xzf ${GOTAR} \
        && echo "You can safely delete /tmp/${GOTAR}" \
        && popd
  else
        ${INSTALL} golang   # Uses brew or apt-get, whichever is on this machine
        cat >>${PROFILE} <<EOT # THis might fail if it uses .bash_profile instead or if .profile doesnt exist
            export GOPATH=${GOPATH}
            export PATH='${GOPATH}:${PATH}'
EOT
    fi
fi
export PATH=${GOPATH}/bin:${PATH}
