FROM node:16-bullseye AS builder
WORKDIR /build
COPY ops/bin/override-prisma-types.sh ops/bin/override-prisma-types.sh
COPY package.json yarn.lock ./
RUN yarn
COPY prisma prisma
RUN yarn run regen
COPY app app
COPY entrypoints entrypoints
COPY tsconfig.json ./
RUN npx esbuild entrypoints/codec-server.ts --outfile=codec-server.js --platform=node --format=cjs --bundle --external:bson --alias:~=./app

FROM gcr.io/distroless/nodejs16-debian11 AS runner
ENV NODE_ENV production
WORKDIR /app
COPY --from=builder /build/node_modules/bson /app/node_modules/bson
COPY --from=builder /build/codec-server.js /app/codec-server.js
CMD [ "codec-server.js" ]
