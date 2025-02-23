FROM node:20-alpine

WORKDIR /app

# Copy all source files first
COPY . .

# Install dependencies
RUN yarn install --frozen-lockfile

# Build TypeScript
RUN yarn build

# Create directories for backups and logs
RUN mkdir -p /app/backup /app/logs

CMD ["node", "dist/examples/sync-hoarder.js"] 