# Docker reference: https://docs.docker.com/engine/reference/builder/
# Usage:
# > docker run -d -p 4244:4244 test1

# Specify node version, alternatives node:8 or node:alpine
FROM node:8
WORKDIR /app

# Copy all the contents of this directory
# TODO only copy things that are needed, or maybe from dist directory (which is currently empty)
# TODO or npm install dweb-mirror
COPY . /app

#Have to run install during the build otherwise will build for different environment and fail with ELF error in at least wrtc
RUN npm install

# tell the world we use port 4244, doesnt actually make docker do anything
EXPOSE 4244
# TODO add command line override of port or get from an ENV variable
CMD node ./mirrorHttp.js
#Replace CMD above with this if want to test on the machine
#CMD /bin/bash
