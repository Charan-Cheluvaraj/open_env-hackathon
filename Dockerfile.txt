FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# No build step needed for TSX execution, but we keep it for safety if requested
# RUN npm run build

EXPOSE 3000

# Use start script which runs server.ts via tsx
CMD ["npm", "run", "start"]

