# NOTE THIS FILE ISNT USED OR MAINTAINED FOR INSTALLATION - PLEASE REFER TO INSTALLATION.md
# PRs to update this would be welcome but AFAIK noone is currently using dweb-mirror under Docker.

# Docker reference: https://docs.docker.com/engine/reference/builder/
# Building
# > cd ...dweb-mirror
# > docker image build -t mitraardron/test1:latest .
# > docker push mitraardron/test1:latest                                    # Send to repo
#
# For testing
# > docker run -i -p 4244:4244 --name mirrorHttp mitraardron/test1:latest           # Test it
# > docker run -i -p 4244:4244 --name mirrorHttp mitraardron/test1:latest /bin/bash # OR run bash inside it
#
# For production
# > docker run -d —name mirrorHttp -p 4244:4244 mitraardron/test1:latest    # Run production
# > docker container stop mirrorHttp                                        # Stop running server
# > docker container rm mirrorHttp                                          # Delete container
# > docker logs mirrorHttp                                                  # See the logs


# Specify node version, alternatives node:8 or node:alpine
FROM node:10
WORKDIR /app

# Copy just package.json, package-lock.json and then npm build so it can save the image
COPY package.json /app

#Have to run install during the build otherwise will build for different environment and fail with ELF error in at least wrtc
RUN npm i npm@latest -g && npm install && npm cache clean --force

# Copy all the contents of this directory
# TODO only copy things that are needed, or maybe from dist directory (which is currently empty)
# TODO or npm install dweb-mirror
COPY . /app

# tell the world we use port 4244, doesnt actually make docker do anything
EXPOSE 4244
# TODO add command line override of port or get from an ENV variable
CMD ["node", "./internetarchive", "--server"]
#Replace CMD above with this if want to test on the machine
#CMD /bin/bash


# TODO - add IPFS will need CORS configuring because of bug with localhost not being recognized
# https://github.com/ipfs/js-ipfs-api#cors
#https://github.com/ipfs/js-ipfs-api/issues/855#issuecomment-420458337
#ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin "[\"http://example.com\"]"
#ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials "[\"true\"]"
#ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods "[\"PUT\", \"POST\", \"GET\"]"
#ipfs config --json Experimental.FilestoreEnabled true
