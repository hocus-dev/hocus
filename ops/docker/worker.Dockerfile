FROM node:16-bullseye

RUN groupadd -r --gid 1002 hocus && useradd -r -g hocus -m -u 1002 hocus
RUN mkdir -p /app && chown -R hocus:hocus /app
USER hocus
RUN yarn config set cache-folder /app/.yarn-cache

WORKDIR /app
