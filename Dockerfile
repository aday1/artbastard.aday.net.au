FROM node:20-slim AS build
WORKDIR /src

COPY app/package.json app/package-lock.json ./
RUN npm ci --silent

COPY app/ ./
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3030
ENV ARTBASTARD_DATA=/app/data

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /src/dist ./dist
COPY --from=build /src/ui/dist ./ui/dist
COPY --from=build /src/package.json ./package.json
COPY --from=build /src/package-lock.json ./package-lock.json

RUN npm ci --omit=dev --silent

EXPOSE 3030
CMD ["node", "dist/server.js"]
