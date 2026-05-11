FROM node:20-alpine

WORKDIR /app

# Copy package files (including client/) before npm ci
# so that postinstall (cd client && npm install) can find client/
COPY package*.json ./
COPY client/package*.json ./client/

# Install all dependencies (postinstall installs client deps too)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the React client
RUN npm run build

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "server.js"]
