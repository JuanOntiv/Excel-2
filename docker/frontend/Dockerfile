FROM node:20-bullseye-slim AS builder

WORKDIR /app

COPY frontend/package*.json ./

RUN npm install
#ci --silent

COPY frontend/ .

EXPOSE 3000

CMD ["npm", "run", "dev"]
