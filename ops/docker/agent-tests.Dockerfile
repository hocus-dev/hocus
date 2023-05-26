FROM quay.io/gorbak25/hocus-prebuilds-agent-dev@sha256:833c388a0d86146872ca1accd76e9636502e80ac3789151b4be1a0c1be504656

# Install overlaybd
COPY --from=obd-builder /opt/overlaybd /opt/overlaybd
COPY --from=obd-builder /etc/overlaybd /etc/overlaybd
RUN chmod u+s /opt/overlaybd/bin/overlaybd-apply
# Install the overlaybd conversion tool
COPY --from=obd-convertor-builder /convertor /opt/overlaybd/bin/convertor

WORKDIR /app
COPY ops/bin/override-prisma-types.sh ops/bin/override-prisma-types.sh
COPY deps deps
COPY package.json yarn.lock ./
RUN --mount=type=cache,id=hocus-tests-yarn,sharing=locked,target=/usr/local/share/.cache/yarn \
   yarn --frozen-lockfile
COPY prisma prisma
RUN yarn run regen
COPY . .
