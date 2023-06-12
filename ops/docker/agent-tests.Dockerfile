# Image defined in ./ops/docker/prebuilds.Dockerfile
# Please run ./ops/bin/dev/prebuild-push-update.sh to update
FROM quay.io/hocus/hocus-prebuilds-agent-dev:3d32dbc7b6daec03c37b2286f3ba88090fe5ba1a2835579bee62be2bb9e7ffcb

WORKDIR /app
COPY ops/bin/override-prisma-types.sh ops/bin/override-prisma-types.sh
COPY deps deps
COPY package.json yarn.lock ./
RUN --mount=type=cache,id=hocus-tests-yarn,sharing=locked,target=/usr/local/share/.cache/yarn \
   yarn --frozen-lockfile
COPY prisma prisma
RUN yarn run regen
COPY . .
