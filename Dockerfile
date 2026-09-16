# Builds apps/web (the Next.js dashboard/API) out of the pnpm monorepo.
# apps/widget is also built here and its output copied into apps/web's
# public/ dir, so the same container serves /widget.js — see the widget
# build step below for why (NEXT_PUBLIC_WIDGET_CDN_URL points at this
# app's own domain, not a separate CDN).

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/widget/package.json apps/widget/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/apps/widget/node_modules ./apps/widget/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle by `next build`, so
# they must arrive as build args, not just runtime env vars on the container.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG NEXT_PUBLIC_WIDGET_CDN_URL
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID \
    NEXT_PUBLIC_WIDGET_CDN_URL=$NEXT_PUBLIC_WIDGET_CDN_URL \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

RUN pnpm --filter @velobot/web... build

# The widget bundle needs to know its own API origin and Supabase project
# at build time (Vite `define`, baked into the file — see
# apps/widget/vite.config.ts) — reusing the Next.js app's own build args
# rather than requiring separate ones, since they're the same values
# (this app IS the widget's backend).
ENV VITE_API_BASE_URL=$NEXT_PUBLIC_APP_URL \
    VITE_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN pnpm --filter @velobot/widget build

# apps/web has no public/ directory (no static assets committed) — make sure
# it exists, then drop the widget bundle into it so Next.js serves it as a
# plain static file at /widget.js (see middleware.ts's matcher, which
# excludes .js the same way it already excludes image extensions — a
# static asset must never redirect an anonymous embedder to /login).
RUN mkdir -p apps/web/public && \
    cp apps/widget/dist/widget.js apps/web/public/widget.js && \
    cp apps/widget/dist/widget.js.map apps/web/public/widget.js.map

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /repo/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
