FROM node:16-bullseye AS builder
WORKDIR /build
COPY ops/bin/override-prisma-types.sh ops/bin/override-prisma-types.sh
COPY deps deps
COPY package.json yarn.lock ./
RUN yarn
COPY . .
RUN yarn run regen && yarn run build
# TODO: Remix is unable to detect aliases when using require.resolve
# For now just replace that alias manually
# Actually what does it even mean to do require.resolve(one_module_from_a_bundle) in a bundle?!?!?!?
RUN mkdir node_modules/@hocus-workaround
RUN npx esbuild app/temporal/data-converter.ts --outfile=node_modules/@hocus-workaround/data-converter.js --platform=browser --format=cjs --bundle --alias:~=./app
RUN sed -i 's|"~/temporal/data-converter"|"@hocus-workaround/data-converter.js"|g' build/index.js

FROM node:16-bullseye AS deps
ENV NODE_ENV production
WORKDIR /build
COPY ops/bin/override-prisma-types.sh ops/bin/override-prisma-types.sh
COPY deps deps
COPY package.json yarn.lock ./
RUN yarn install --production
COPY . .
RUN yarn run regen

FROM node:16-bullseye AS runner
ENV NODE_ENV production
WORKDIR /app
COPY --from=deps /build/node_modules /app/node_modules
COPY --from=builder /build/build /app/build
COPY --from=builder /build/public /app/public
COPY --from=builder /build/package.json /app/package.json
COPY --from=builder /build/node_modules/@hocus-workaround /app/node_modules/@hocus-workaround
COPY prisma prisma
CMD [ "bash", "-c", "npx prisma migrate deploy && node build/index.js" ]
