FROM node:16-bullseye AS builder

WORKDIR /build
COPY ops/bin/override-prisma-types.sh ops/bin/override-prisma-types.sh
COPY deps deps
COPY package.json yarn.lock ./
RUN yarn
COPY . .
RUN yarn run regen && yarn run build 

FROM node:16-bullseye AS deps
WORKDIR /build
COPY ops/bin/override-prisma-types.sh ops/bin/override-prisma-types.sh
COPY deps deps
COPY package.json yarn.lock ./
RUN yarn install --production
COPY . .
RUN yarn run regen

FROM node:16-bullseye AS runner
WORKDIR /app
COPY --from=builder /build/build /app/build
COPY --from=builder /build/public /app/public
COPY --from=builder /build/package.json /app/package.json
COPY --from=deps /build/node_modules /app/node_modules
CMD [ "node", "build/index.js" ]
