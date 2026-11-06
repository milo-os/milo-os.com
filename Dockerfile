FROM node:26.13.0-alpine3.24@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build stage
FROM dependencies AS build
COPY . .
RUN npm run build

# Production dependencies stage
FROM dependencies AS production-dependencies
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Development stage
FROM dependencies AS development
COPY . .
ENV NODE_ENV=development
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD ["npm", "run", "dev"]

# Production stage
FROM node:26.13.0-alpine3.24@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS production
WORKDIR /app

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/server.mjs ./server.mjs

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321
CMD ["node", "./server.mjs"]
