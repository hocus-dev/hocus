# Image defined in ./ops/docker/prebuilds.Dockerfile
# Please run ./ops/bin/dev/prebuild-push-update.sh to update
FROM quay.io/hocus/hocus-prebuilds-hocus-workspace:01dd2981d5d70b86e6e4050fc0cbee92a4e1ad0898cc3646e320842023367c8b
RUN sudo wget -O /usr/bin/zot https://github.com/project-zot/zot/releases/download/v2.0.0-rc4/zot-linux-amd64; sudo chmod +x /usr/bin/zot
