# Image defined in ./ops/docker/prebuilds.Dockerfile
# Please run ./ops/bin/dev/prebuild-push-update.sh to update
FROM quay.io/hocus/hocus-prebuilds-hocus-workspace:a5664dd134478bc401ab624acce7c9d3cf0295df5fa1b883764be9017fd35efc
RUN sudo wget -O /usr/bin/zot https://github.com/project-zot/zot/releases/download/v2.0.0-rc4/zot-linux-amd64; sudo chmod +x /usr/bin/zot
