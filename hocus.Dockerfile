# Image defined in ./ops/docker/prebuilds.Dockerfile
# Please run ./ops/bin/dev/prebuild-push-update.sh to update
FROM quay.io/hocus/hocus-prebuilds-hocus-workspace:03733853b92d401a67886165529d0cd6b5e29650d4b0f3b30c85ebaaa3d4e6c2
RUN sudo wget -O /usr/bin/zot https://github.com/project-zot/zot/releases/download/v2.0.0-rc4/zot-linux-amd64; sudo chmod +x /usr/bin/zot
