# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
# better-sqlite3 ships prebuilt bindings and doesn't need its install script
# (node-gyp rebuild) to run at all — but npm runs it unconditionally, and it
# fails here with no compiler toolchain installed. esbuild's postinstall
# *does* need to run (it downloads vite's platform binary), so skip scripts
# globally and then re-run just that one.
RUN npm ci --ignore-scripts && npm rebuild esbuild
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
# su-exec: drop from root to the app user after fixing ownership.
# sqlite: CLI useful for debugging.
RUN apk add --no-cache su-exec sqlite shadow
WORKDIR /app

COPY --from=build /app/package*.json ./
# Fresh production-only install rather than copying node_modules from the
# build stage — keeps dev dependencies out of the runtime image entirely.
# --ignore-scripts for the same reason as the build stage; nothing else in
# the production dependency set needs an install script.
RUN npm ci --omit=dev --ignore-scripts

# better-sqlite3 ships prebuilt bindings for linuxmusl; fail the build
# here instead of at the first request if that ever stops being true.
RUN node -e "new (require('better-sqlite3'))(':memory:').exec('select 1')"

COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
COPY config-defaults ./config-defaults
COPY docker-entrypoint.sh /usr/local/bin/

# The base image predefines a "node" user at uid/gid 1000; drop it so our
# own "app" user (the one docker-entrypoint.sh's PUID/PGID remap targets)
# can claim that uid/gid instead.
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && deluser node \
    && addgroup -g 1000 app \
    && adduser -D -u 1000 -G app app

ENV DATA_DIR=/data
ENV CONFIG_DIR=/config
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/dist/server/index.js"]
