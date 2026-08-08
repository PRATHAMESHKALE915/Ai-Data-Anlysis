# Dockerfile for AI Data Analyst (Vite React + Express Server)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy full application source
COPY . .

# Build Vite frontend and Express server bundle
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built dist directory from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/output ./output

# Expose port
EXPOSE 3000

# Start production server
CMD ["npm", "start"]
