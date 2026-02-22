FROM node:22-slim AS builder

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build

# Output stage - just copy the dist
FROM scratch
COPY --from=builder /app/dist /app/dist
