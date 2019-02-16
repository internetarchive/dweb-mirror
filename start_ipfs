#!/bin/sh
# Modified from https://github.com/ipfs/go-ipfs/blob/master/bin/container_daemon
# Almost same code in "dweb" and "dweb-mirror" repos - main difference is enabling Filestore
# all changes commented
set -e      # Break on error

# Requires caller to set up
# $IPFS_PATH pointing to directory space to use (aka the "repo"), if unspecified will use .ipfs, On DOCKER=/pv/ipfs
# $IPFS_USER if set, and run as root then will switch to this user
# $IPFS_API_PORT if not 5001
# $IPFS_GATEWAY_PORT if not 8080
# $IPFS_SWAM_PORT if not 4001
# $IPFS_WS_PORT if not 4002


#DOCKER: make sure log includes date restarting and prominent === to help find crashes
echo "===== Starting IPFS daemon at `date` ================="

# If running as root && specified a IPFS_USER then relaunch as that user.
#DOCKER runs as root, but doesnt specify a user,
#DWEB-MIRROR may specifiy 'ipfs' or might just run as the logged in user (not sudo-ed)
if [ `id -u` -eq 0 ]; then
    if [ -n "${IPFS_USER}" ]; then
        echo "Changing user to ${IPFS_USER}"
        # ensure folder is writable
        su-exec "${IPFS_USER}" test -w "${IPFS_PATH:=${HOME}/.ipfs}" || chown -R -- "${IPFS_USER}" "${IPFS_PATH:=${HOME}/.ipfs}"
        # restart script with new privileges
        exec su-exec "${IPFS_USER}" "$0" "$@"
    fi
fi

# 2nd invocation with regular user
if [ -n "${IPFS_PATH}" ] ; then
    ln -s "${IPFS_PATH}" ${HOME}/.ipfs    # I think IPFS is using .ipfs anyway,
else
    IPFS_PATH="${HOME}/.ipfs"
fi

ipfs version

#DOCKER: Want peerid allocated once per machine; files to persist across invocations, and config same on all sites
#TODO: It should be coming up on 4001 and 4002 like dweb.me, check !
if [ -e "${IPFS_PATH}/config" ]; then
  echo "Found IPFS fs-repo at ${IPFS_PATH}, not reconfiguring"
else
  ipfs init # ipfs init will create new repo if one doesnt exist which allocates a new peer-id.
  #DOCKER: Allow parameterization of ports by env variables
  ipfs config Addresses.API /ip4/0.0.0.0/tcp/${IPFS_API_PORT:=5001}
  ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/${IPFS_GATEWAY_PORT:=8080}
  ipfs config --json Addresses.Swarm "[\"/ip4/0.0.0.0/tcp/${IPFS_SWARM_PORT:=4001}\",\"/ip6/::/tcp/${IPFS_SWARM_PORT:=4001}\",\"/ip4/0.0.0.0/tcp/${IPFS_WS_PORT:=4002}/ws\",\"/ip6/::/tcp/${IPFS_WS_PORT:=4002}/ws\"]"
  #DOCKER: Allow access to http API from localhost
  ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["http://localhost"]'
  ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials '["true"]'
  ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "GET", "POST"]'
  #DOCKER: Enable urlstore
  ipfs config --json Experimental.UrlstoreEnabled true
  #DOCKER: Not enabling Filestore on production dweb.archive.org but will on dweb-mirror dockers
  ipfs config --json Experimental.FilestoreEnabled true
fi

# if the first argument is daemon
if [ "$1" = "daemon" ]; then
  # filter the first argument until
  # https://github.com/ipfs/go-ipfs/pull/3573
  # has been resolved
  shift
else
  # print deprecation warning
  # go-ipfs used to hardcode "ipfs daemon" in it's entrypoint
  # this workaround supports the new syntax so people start setting daemon explicitly
  # when overwriting CMD
  echo "DEPRECATED: arguments have been set but the first argument isn't 'daemon'" >&2
  echo "DEPRECATED: run 'docker run ipfs/go-ipfs daemon $@' instead" >&2
  echo "DEPRECATED: see the following PRs for more information:" >&2
  echo "DEPRECATED: * https://github.com/ipfs/go-ipfs/pull/3573" >&2
  echo "DEPRECATED: * https://github.com/ipfs/go-ipfs/pull/3685" >&2
fi

exec ipfs daemon "$@"
