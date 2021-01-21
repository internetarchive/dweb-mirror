#!/bin/bash
set -e # Break on error
set -x # Lets see whats happening

# Define a parent directory they will sit under
PARENTDIRECTORY=git
REPOS="dweb-archive"

echo "==== Creating parent directory ========================="
mkdir -p ${PARENTDIRECTORY}
cd ${PARENTDIRECTORY}

echo "==== Getting repositories from Git ========================="
for REPO in ${REPOS}
do
  if [ ${REPO} eq "epubjs-reader"]
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
  webpack --mode development
  popd
done
for i in epubjs-reader
do
  pushd $i
  grunt
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
