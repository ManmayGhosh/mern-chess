# ---- Stage 1: build the React (Vite) client ----
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ ./
RUN npm run build   # -> /app/client/dist

# ---- Stage 2: server runtime, serving the built client as static files ----
FROM node:20-alpine
WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev

COPY server/ ./
COPY --from=client-build /app/client/dist ./public

ENV PORT=8080 \
    NODE_ENV=production

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:${PORT}/ || exit 1

USER node

CMD ["node", "server.js"]
