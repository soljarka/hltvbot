FROM node:20-alpine as build

WORKDIR /usr/src/app

COPY ./package*.json ./
RUN npm ci

COPY . .
RUN	npm run build  
RUN npm run test

CMD ["npm start"]

FROM node:20

RUN apt-get update && apt-get install gnupg wget -y && \
    wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
    apt-get update && \
    apt-get install google-chrome-stable -y --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /home/app

COPY package*.json ./
RUN npm ci --production

COPY --from=build /usr/src/app/build/. ./

USER node

CMD ["node","./index.js"]