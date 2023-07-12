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
COPY ops/bin/download-kernel.sh ops/bin/download-kernel.sh
COPY package.json yarn.lock ./
RUN yarn install --production
COPY prisma prisma
RUN yarn run regen && mkdir /kernel/ && ops/bin/download-kernel.sh /kernel

FROM quay.io/hocus/hocus-prebuilds-obd:b3a68b6dc6cfac7eb730e10b1eabd74f9ac89fc4004fa820d8380382d45adc1b AS obd

FROM node:16-bullseye AS runner

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        software-properties-common \
        net-tools \
        iproute2 \
        iptables \
        psmisc \
        socat \
        openssh-server \
        iputils-ping \
    && add-apt-repository "deb http://httpredir.debian.org/debian sid main" \
    && apt-get update \
    && apt-get -t sid install -y \
        qemu-system \
        skopeo \
        # the following are used by overlaybd
        libaio1 \
        libnl-3-200 \
        libnl-genl-3-200 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
RUN test -f /usr/sbin/nologin && useradd -ms /usr/sbin/nologin sshgateway
COPY --chown=root:root --chmod=0644 ops/docker/resources/sshd_config /etc/ssh/sshd_config
# Install crane
RUN bash -c 'wget -O - "https://github.com/google/go-containerregistry/releases/download/v0.15.2/go-containerregistry_Linux_x86_64.tar.gz" | tar -zxvf - -C /usr/bin/ crane'

COPY --from=obd /opt/overlaybd /opt/overlaybd
COPY --from=obd /etc/overlaybd /etc/overlaybd

WORKDIR /app
ENV NODE_ENV production
COPY --from=deps /build/node_modules /app/node_modules
COPY --from=deps /kernel /kernel
COPY --from=builder /build/agent-build/agent.js /app/agent.js
COPY --from=builder /build/agent-build/workflow-bundle.js /app/workflow-bundle.js
COPY --from=builder /build/agent-build/data-converter.js /app/data-converter.js
COPY resources resources
COPY ops/docker/resources/setup-network.sh setup-network.sh
COPY ops/bin/setup-tcmu.sh setup-tcmu.sh
CMD [ "bash", "-c", " \
    ./setup-tcmu.sh && \
    ./setup-network.sh && \
    node agent.js" ]
