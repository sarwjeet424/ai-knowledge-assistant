FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate && npm run build
CMD ["sh","-c","npx prisma db push && node dist/main"]
