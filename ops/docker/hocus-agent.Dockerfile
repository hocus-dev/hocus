FROM node:16-bullseye AS builder
WORKDIR /build
COPY ops/bin/override-prisma-types.sh ops/bin/override-prisma-types.sh
COPY deps deps
COPY package.json yarn.lock ./
RUN yarn
COPY . .
RUN yarn run regen
RUN mkdir agent-build
RUN npx esbuild entrypoints/agent.ts --outfile=agent-build/agent.js --platform=node --format=cjs --bundle --packages=external --alias:~=./app
# Generate worker bundles 
RUN npx ts-node -r tsconfig-paths/register entrypoints/bundle-workflows.ts
RUN npx esbuild app/temporal/data-converter.ts --outfile=agent-build/data-converter.js --platform=browser --format=cjs --bundle --alias:~=./app
RUN sed -i 's|"~/temporal/data-converter"|"./data-converter.js"|g' agent-build/agent.js

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

RUN wget --continue --retry-connrefused --waitretry=1 --timeout=20 --tries=3 -q https://github.com/firecracker-microvm/firecracker/releases/download/v1.1.2/firecracker-v1.1.2-x86_64.tgz && \
    tar -xf firecracker-v1.1.2-x86_64.tgz && \
    mv release-v1.1.2-x86_64/firecracker-v1.1.2-x86_64 /usr/local/bin/firecracker && \
    mv release-v1.1.2-x86_64/jailer-v1.1.2-x86_64 /usr/local/bin/jailer
RUN apt-get update && apt-get install -y net-tools iproute2 iptables psmisc
RUN apt-get update && apt-get install -y socat openssh-server
RUN apt-get update && apt-get install -y iputils-ping
RUN test -f /usr/sbin/nologin && useradd -ms /usr/sbin/nologin sshgateway
COPY --chown=root:root --chmod=0644 ops/docker/resources/sshd_config /etc/ssh/sshd_config

WORKDIR /app
ENV NODE_ENV production
COPY --from=deps /build/node_modules /app/node_modules
COPY --from=builder /build/agent-build/agent.js /app/agent.js
COPY --from=builder /build/agent-build/workflow-bundle.js /app/workflow-bundle.js
COPY --from=builder /build/agent-build/data-converter.js /app/data-converter.js
COPY resources resources
COPY ops/docker/resources/setup-network.sh setup-network.sh
CMD [ "bash", "-c", " \
    ./setup-network.sh && \
    node agent.js" ]
