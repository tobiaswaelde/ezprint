FROM node:26.13.0-alpine AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apk add --no-cache openssl && npm install --global corepack@0.36.0 && corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm build \
  && pnpm --filter @ezprint/prisma-runtime deploy --legacy --prod /migration

FROM node:26.13.0-alpine AS runtime
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/app.db
WORKDIR /app
RUN apk add --no-cache openssl \
  && addgroup --system --gid 1001 app \
  && adduser --system --disabled-password --uid 1001 --ingroup app --home /app app \
  && mkdir /data \
  && chown app:app /data
COPY --from=build --chown=app:app /app/.output ./.output
COPY --from=build --chown=app:app /migration /migration
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN ln -s /app/.output/server/node_modules /app/node_modules \
  && chmod 755 /app/docker-entrypoint.sh
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)})"]
ENTRYPOINT ["/app/docker-entrypoint.sh"]
