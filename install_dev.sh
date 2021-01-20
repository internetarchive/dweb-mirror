#!/bin/bash
###### INSTALLATION CODE, MOSTLY DUPLICATED in dweb-mirror/install.sh and dweb-mirror/install_dev.sh . TODO: Merge these scripts to take e.g. a --dev argument.
cat <<EOT
  This script is intended to support development and testing of all of the dweb repo's.
  While its not strictly required to, for example dweb-mirror to work on dweb-archive, the simplicity
  of one set of installation instructions, and the advantage of being able to test dweb-archive on dweb-mirror
  makes it preferable.

  This script can be run multiple times without problems.

  The easiest way to run is

  curl -o- -L https://unpkg.com/@internetarchive/dweb-mirror/install_dev.sh | bash

EOT
set -e # Break on error
#set -x # Lets see whats happening

# Define a parent directory they will sit under
PARENTDIRECTORY=git
REPOS="dweb-transports dweb-archivecontroller epubjs-reader bookreader dweb-archive dweb-mirror iaux"
# Note that dweb-transport and dweb-gatewahy are not installed they are only useful when running as a gateway server at the archive.

function step {
  STEPALL=$*
  STEPNUMBER=$1
  shift
  STEPNAME="$*"
  #Uncomment next line if you want to find where it failed
  #echo "Offline Internet Archive Installer: ${STEPNUMBER}" > /tmp/step
  echo "Offline Internet Archive Installer: ${STEPNAME}"
}

function install_pkg() {
  step XXX "Installing $*"
  if [ "${OPERATINGSYSTEM}" != "darwin" ]
  then
    sudo apt-get install -y "$@"
  else
    brew install "$@"
  fi
}

function check_cmd() {
  "$@" >/dev/null 2>&1
}

###### PLATFORM AUTODETECTION CODE, DUPLICATED in dweb-mirror/install.sh, dweb-mirror/install_dev.sh, and dweb-mirror/mediawiki/mediawiki.conf


# Convert the portable uname results into go specific environment note Mac has $HOSTTYPE=x86_64 but not sure that is on other platforms
case `uname -m` in
"armv7l") ARCHITECTURE="arm";;    # e.g. Raspberry 3 or OrangePiZero. Note armv8 and above would use what IPFS has as arm64, armv7 and down want "arm"
"x86_64") ARCHITECTURE="amd64";;  # e.g. a Mac OSX
"i?86") ARCHITECTURE="386";;      # e.g. a Rachel3+
*) echo "Unknown processor type `uname -m`, needs configuring"; ARCHITECTURE="unknown";;
esac
# See also /sys/firmware/devicetree/base/model

# Now find OS type, note Mac also has a $OSTYPE
case `uname -s` in
"Darwin") OPERATINGSYSTEM="darwin";;   # e.g. a Mac OSX
"Linux") OPERATINGSYSTEM="linux";;     # e.g. Raspberry 3 or Rachel3+ or OrangePiZero/Armbian
*) echo "Unknown Operating system type `uname -s` - needs configuring"; OPERATINGSYSTEM="unknown";;
esac
# Hard to tell Armbian from Raspbian or a bigger Linux so some heuristics here
[ ! -e /usr/sbin/armbian-config ] || OPERATINGSYSTEM="armbian"
[ ! -e /etc/dpkg/origins/raspbian ] || OPERATINGSYSTEM="raspbian"

#TODO detect Rachel, IIAB etc and set $PLATFORM
PLATFORM="unknown"
[ ! -e /etc/rachelinstaller-version ] || PLATFORM="rachel"

# And setup some defaults
INSTALLDIR=`pwd`  # Default to where we are running this from
YARNCONCURRENCY=1 # Good for a 386 or arm, below that use 1, for OSX go up
CACHEDIR="${HOME}/archiveorg"

# Override defaults based on above
case "${PLATFORM}" in
"rachel") CACHEDIR="/.data/archiveorg";;
esac
case "${ARCHITECTURE}" in
"386") YARNCONCURRENCY=2;;
"amd64") YARNCONCURRENCY=4;;
esac

echo "Architecture: ${ARCHITECTURE} OS: ${OPERATINGSYSTEM} PLATFORM: ${PLATFORM} CACHEDIR: ${CACHEDIR} INSTALLDIR: ${INSTALLDIR}"

if [ "${OPERATINGSYSTEM}" != "darwin" ]
then
  if ! yarn --version 2>/dev/null
  then
    step XXX "Adding Yarn sources"
    curl -sSL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

  fi
  set +e # update and upgrade often have non-zero return codes even though safe to continue
  step XXX "Apt update"
  sudo apt-get update

  step XXX "Upgrade all Apt packages"
  sudo dpkg --configure -a # Clear out any previous locks/interrupted opts - especially kolibri install
  sudo apt-get upgrade    # Make sure running latest version
  sudo apt -y autoremove
  set -e # Exit on errors
else # Its OSX
  #set +e  # Uncomment if these unneccessarily have failure exit codes
  step XXX "Checking git and brew are installed"
  git --version || xcode-select --install  # Get Git and other key command line tools (need this before "brew"
  brew --version || /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
  set -e
fi


if [ "${OPERATINGSYSTEM}" != "darwin" ]
then
  check_cmd yarn --version || install_pkg yarn
  check_cmd git --version || install_pkg git
  # Note yarn alternative can skip the apt-key & sources steps above and ...
  # curl -o- -L https://yarnpkg.com/install.sh | bash
  # source ~/.bashrc # Fix path
  step XXX "Trying to install libsecret which may fail" # Failed on rachel
  # Allow libsecret-1-dev to fail , we might not need it
  install_pkg libsecret-1-dev || echo "Libsecret failed to install, but that is ok"
  check_cmd netstat --version || install_pkg net-tools # Make debugging so much easier
else
  check_cmd curl --version || install_pkg curl
  # The brew installer for node is broken (fails to run the npx line in bookreader/package.json), use the line below as found on https://nodejs.org/en/download/package-manager/#macos
  #check_cmd node --version || install_pkg nodejs
  check_cmd node --version || ( curl "https://nodejs.org/dist/latest/node-${VERSION:-$(wget -qO- https://nodejs.org/dist/latest/ | sed -nE 's|.*>node-(.*)\.pkg</a>.*|\1|p')}.pkg" > "$HOME/Downloads/node-latest.pkg" && sudo installer -store -pkg "$HOME/Downloads/node-latest.pkg" -target "/" )
  check_cmd yarn --version || curl -o- -L https://yarnpkg.com/install.sh | bash
  source ~/.bashrc # Fix up path
fi

echo "==== Creating parent directory ========================="
mkdir -p ${PARENTDIRECTORY}
cd ${PARENTDIRECTORY}

echo "==== Getting repositories from Git ========================="
for REPO in ${REPOS}
do
  if [ ${REPO} == "epubjs-reader" ] # syntax repaired 2021
  then GITREPO="https://github.com/futurepress/${REPO}"
  else GITREPO="https://github.com/internetarchive/${REPO}"
  fi
  if [ -d ${REPO} ]
  then
    pushd ${REPO}
    git checkout -f
    git pull
    popd
  else
    git clone ${GITREPO}
  fi
done

echo "Selecting mitra--release branch of iaux"
pushd iaux
git checkout mitra--release
popd

for REPO in ${REPOS}
do
  echo "==== Installing ${REPO} ========================="
  pushd ${REPO}
  yarn install
  popd
done
echo "==== IAUX needs special attention as its a multi-repo ========================="
pushd iaux
yarn run lerna bootstrap
yarn run lerna link
popd

#Looks like this is done during dweb-archive yarn install which runs install.sh
# echo "==== Linking bundles into dweb-archive =============="
#pushd dweb-archive
#yarn setuphttp
#popd

echo "==== Forcing symbolic links so that can work on multiple repos ===== "
for i in ${REPOS};
do
  for j in ${REPOS};
  do
    dest=${j}/node_modules/@internetarchive/${i};
    if [ -L ${dest} -o -d ${dest} ];
    then
      echo ${i} - ${j};
      rm -Rf ${dest};
      ln -s ../../../${i} ${dest};
    fi;
  done;
done;
for j in ${REPOS}
do
  dest=${j}/node_modules/@internetarchive/ia-components
  if [ -L ${dest} -o -d ${dest} ];
  then
    echo $dest - ia-components
    rm -Rf ${dest};
    ln -s ../../../iaux/packages/ia-components ${dest}
  fi
done

echo "=== Webpacking each repo to development version ==== "
for i in dweb-archive dweb-transports
do
  pushd $i
  yarn run webpack --mode development
  popd
done
for i in epubjs-reader
do
  pushd $i
  yarn run grunt
  popd
done
echo "==== installing http-server ====="
yarn global add http-server


cat <<EOT
==== INSTALLATION COMPLETE ==============
All the repos are installed

You can access it for testing on two different servers.

a) dweb-archive, loads the UI locally, but accesses the content via the common dweb.archive.org

  cd dweb-archive/dist
  http-server

  open http://localhost:8080/archive.html

b) dweb-mirror to test the offline mode

  cd dweb-mirror
  ./internetarchive -sc

  open http://localhost:4244

you can make changes in the UI in dweb-archive, iaux/packages/ia-components, bookreader or dweb-archive-controller then

  cd dweb-archive ; webpack --mode development -w &

This will watch for changes so that any edits you make are immediately reflected on either of the servers and testable with a browser page reload

If you make change to dweb-transports:

  cd dweb-transports ; webpack --mode development -w &

If you make changes to dweb-mirror, then ctrl-C out of the server and restart it.

EOT
