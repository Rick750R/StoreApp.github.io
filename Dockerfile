
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN mkdir -p public/uploads \
    && chown -R node:node public/uploads

USER node

EXPOSE 3000

CMD ["npm", "start"]
