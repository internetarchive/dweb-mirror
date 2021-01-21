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
