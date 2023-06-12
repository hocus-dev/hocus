# Image defined in ./ops/docker/prebuilds.Dockerfile
# Please run ./ops/bin/dev/prebuild-push-update.sh to update
FROM quay.io/hocus/hocus-prebuilds-agent-dev:cbde1cd5ee1432c05b1d7933cf3a8d4ded9b7469bf4f483698b6851eb296a4f7
RUN bash -c 'wget -O - "https://github.com/google/go-containerregistry/releases/download/v0.15.2/go-containerregistry_Linux_x86_64.tar.gz" | tar -zxvf - -C /usr/bin/ crane' 