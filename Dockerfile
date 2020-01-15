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

# Setup initial crawl - do this BEFORE the 'yarn add' of dweb-mirror
# This config file is a good place to override anything (like port numbers, or initial crawl) needed for specific applications.
COPY ./dweb-mirror.config.yaml /root/dweb-mirror.config.yaml

# This was "COPY . /app" but better to get dweb-mirror from npm,
# will be sure then to get a release rather than whatever is local
#Have to run install during the build otherwise will build for different environment and may fail with ELF error
RUN yarn add @internetarchive/dweb-mirror
RUN yarn add supervisor

# tell the world which port we use, doesnt actually make docker do anything
# On dweb-mirror this is 4244 and on www-dweb-archive under kubernetes (K8) is 5000 - MUST match port in dweb-mirror.config.yaml
EXPOSE 4244

# Nasty hack to unhack this nasty line in archive.js :-) which generates unwanted logs if running on certain CI servers at IA
# Should have no impact on any other setup
#var log = location.host.substr(0, 4) !== 'www-' ? function () {} : console.log.bind(console);
RUN sed -i '.BAK' -e 's/www-/xwww-/' '/app/node_modules/@internetarchive/dweb-archive-dist/includes/archive.js'
RUN sed -i '.BAK' -e 's/www-/xwww-/' '/app/node_modules/@internetarchive/dweb-archive-dist/includes/archive.min.js'

# On K8 only After yarn add DM, overwrite redir.html as a redirect breaks the liveness test
#COPY ./redir.html /app/node_modules/@internetarchive/dweb-archive-dist/redir.html

WORKDIR /app/node_modules/@internetarchive/dweb-mirror

# Just for debugging. comment out when done
#RUN apt-get update && apt-get -yq install sudo vim
#Not working on k8 CMD [ "/bin/bash" ]

# when this container is invoked like "docker exec .." this is what that will run.
CMD [ "/app/node_modules/.bin/supervisor", "-i", "..", "--", "internetarchive", "-sc" ]
