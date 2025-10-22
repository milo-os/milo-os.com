FROM node:22.19.0-alpine3.22 AS base
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install --ignore-scripts

FROM base AS build
COPY . .
RUN npm run build

FROM base AS development
COPY . .
RUN --mount=type=cache,target=/root/.npm npm install
ENV NODE_ENV=development
ENV HOST=0.0.0.0
ENV PORT=4321
RUN chmod -R 755 src/pages
EXPOSE 4321
CMD ["npm", "run", "dev", "--", "--host", "--allowed-hosts=website.staging.env.datum.net"]

FROM node:22.19.0-alpine3.22 AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src/pages ./src/pages
RUN chmod -R 755 src/pages
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
