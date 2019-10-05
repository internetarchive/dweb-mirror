# NOTE THIS FILE IS NOT WORKING YET
# PRs to update this would be welcome but AFAIK noone is currently using dweb-mirror under Docker.

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


# Specify node version, alternatives node:8 or node:alpine
FROM node:12
WORKDIR /app

#Yarn needs npm for the build, but should be happy with the version in the docker base distro
#RUN npm i npm@latest -g
# Install yarn which does a better job of de-duplicating etc
RUN npm i yarn -g

# /root/archiveorg is the home directory it will run in, but its not persistent so all data lost between restarts
#TODO require a persistent location, we can add that to configDefaults.yaml#directories
RUN mkdir -p /root/archiveorg

# This was "COPY . /app" but better to get dweb-mirror from npm,
# will be sure then to get a release rather than whatever is local
#Have to run install during the build otherwise will build for different environment and fail with ELF error in at least wrtc
RUN yarn add @internetarchive/dweb-mirror

# tell the world we use port 4244, doesnt actually make docker do anything
EXPOSE 4244

WORKDIR /app/node_modules/@internetarchive/dweb-mirror
CMD ["node", "./internetarchive", "-sc"]
#Replace CMD above with this if want to test on the machine
#CMD /bin/bash
