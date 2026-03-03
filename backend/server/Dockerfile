FROM node:20-alpine
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./

EXPOSE 4000
CMD ["npm", "run", "dev"]
