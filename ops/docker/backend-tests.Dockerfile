FROM node:16-bullseye AS builder
WORKDIR /app
COPY ops/bin/override-prisma-types.sh ops/bin/override-prisma-types.sh
COPY package.json yarn.lock ./
RUN --mount=type=cache,id=hocus-tests-yarn,sharing=locked,target=/usr/local/share/.cache/yarn \
   yarn --frozen-lockfile
COPY prisma prisma
RUN yarn run regen
COPY . .
