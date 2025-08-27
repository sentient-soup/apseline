FROM node:24-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install --global serve
RUN npm install

COPY . .
RUN npm run build 

EXPOSE 3000
CMD [ "serve", "-s", "dist" ]