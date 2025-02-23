FROM node:20-alpine

WORKDIR /app

# Copy package files and tsconfig first
COPY package.json yarn.lock tsconfig.json ./
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN yarn build

# Create directories for backups and logs
RUN mkdir -p /app/backup /app/logs

CMD ["node", "dist/examples/sync-hoarder.js"] 