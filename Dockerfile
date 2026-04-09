FROM node:20-slim
WORKDIR /app
COPY package*.json ./
# Install everything including devDependencies (for tsx)
RUN npm install 
COPY . .
# Expose the HF default port
EXPOSE 7860
# Use npx to ensure tsx is found
CMD ["npx", "tsx", "server.ts"]
