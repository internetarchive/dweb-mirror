#!/bin/bash
#NOTE THIS IS SERIOUSLY OUT OF DATE and not used - see head of Dockerfile for hints about usage.
set -x
export ipfs_staging=/Users/mitra/temp/ipfsstaging
export ipfs_data=/Users/mitra/temp/ipfsdata
#TODO Run mirrorHttp docker container
docker run -d --name ipfs_host -v $ipfs_staging:/export -v $ipfs_data:/data/ipfs -p 4001:4001 -p 127.0.0.1:8080:8080 -p 127.0.0.1:5001:5001 mitraardron/go-ipfs:latest