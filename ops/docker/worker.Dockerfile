FROM node:16-bullseye

COPY . /app
WORKDIR /app

RUN npm install --only=production
