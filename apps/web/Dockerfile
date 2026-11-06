FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN npm run build
CMD ["npm","run","dev","--","--host","0.0.0.0"]
