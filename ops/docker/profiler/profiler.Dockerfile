# diat fails to install on node 18
FROM node:16-bullseye

RUN apt-get update && apt-get install -y build-essential python && npm i --global diat
