# Single-stage image kept deliberately simple for hackathon demo reliability:
# it carries the Prisma CLI + tsx so the container can push schema and seed on boot.
FROM node:20-slim

# Prisma needs openssl on slim images.
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000
CMD ["sh", "docker-entrypoint.sh"]
