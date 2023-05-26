# Image defined in ./ops/docker/prebuilds.Dockerfile
# Please run ./ops/bin/dev/prebuild-push-update.sh to update
FROM quay.io/hocus/hocus-prebuilds-agent-dev@sha256:833c388a0d86146872ca1accd76e9636502e80ac3789151b4be1a0c1be504656

WORKDIR /app
COPY ops/bin/override-prisma-types.sh ops/bin/override-prisma-types.sh
COPY deps deps
COPY package.json yarn.lock ./
RUN --mount=type=cache,id=hocus-tests-yarn,sharing=locked,target=/usr/local/share/.cache/yarn \
   yarn --frozen-lockfile
COPY prisma prisma
RUN yarn run regen
COPY . .
