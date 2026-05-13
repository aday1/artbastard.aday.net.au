FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --silent

COPY react-app/package.json react-app/package-lock.json ./react-app/
RUN cd react-app && npm ci --silent

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3030

COPY --from=build /app/dist ./dist
COPY --from=build /app/react-app/dist ./react-app/dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json

RUN npm ci --omit=dev --silent

EXPOSE 3030
CMD ["node", "dist/server.js"]
