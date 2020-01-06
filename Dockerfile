# This should work, but AFAIK noone is currently using dweb-mirror under Docker so if not please send post a bug report or PR

# Docker reference: https://docs.docker.com/engine/reference/builder/
# Building
# > cd ...dweb-mirror
# > docker image build --no-cache -t mitraardron/dweb-mirror:latest .   # Use no-cache or it might not rebuild from a changed npm
# > docker push mitraardron/dweb-mirror:latest                          # Send to repo
#
# For testing
# > docker run -i -p 4244:4244 --name internetarchive mitraardron/dweb-mirror:latest           # Test it
# > docker run -i -p 4244:4244 --name internetarchive mitraardron/dweb-mirror:latest /bin/bash # OR run bash inside it
#
# For production
# > docker run -d —name internetarchive -p 4244:4244 mitraardron/dweb-mirror:latest    # Run production
# > docker container stop mirrorHttp                                        # Stop running server
# > docker container rm mirrorHttp                                          # Delete container
# > docker logs mirrorHttp                                                  # See the logs


# Specify node version, alternatives node:12 or node:alpine but alpine is missing git, which is needed for dependencies of dweb-archive-dist
FROM node:12
MAINTAINER "Mitra Ardron <mitra@archive.org>"
WORKDIR /app

# Yarn used to need installing, but seems present in alpine docker and node:12 images now
#Yarn needs npm for the build, but should be happy with the version in the docker base distro
#RUN npm i npm@latest -g
# Install yarn which does a better job of de-duplicating etc
#RUN npm i yarn -g

# Have to run as root to do the apt steps
USER root
# Stole this line from https://github.com/tarampampam/node-docker/blob/master/Dockerfile
RUN set -x \
    apt-get update \
    && apt-get -yq install git \
    && apt-get -yq clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    && git --version && bash --version && ssh -V && npm -v && node -v && yarn -v
#Alternative if you want bash or ssh:  && apt-get -yq install bash git openssh-server \

# /root/archiveorg is the home directory it will run in, but its not persistent so all data lost between restarts
#TODO require a persistent location, we can add that to configDefaults.yaml#directories
RUN mkdir -p /root/archiveorg

# This was "COPY . /app" but better to get dweb-mirror from npm,
# will be sure then to get a release rather than whatever is local
#Have to run install during the build otherwise will build for different environment and may fail with ELF error
RUN yarn add @internetarchive/dweb-mirror

# tell the world we use port 4244, doesnt actually make docker do anything
EXPOSE 4244

# when this container is invoked like "docker exec .." this is what that will run
CMD [ "./node_modules/.bin/supervisor", ".", "Main.js" ]
