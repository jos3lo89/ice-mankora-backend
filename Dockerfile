# ============================================
# Paso 1: Dependencies
# ============================================
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ============================================
# Paso 2: Build
# ============================================
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# ARG para DATABASE_URL dummy - prisma lo necesita en build time
ARG DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy?sslmode=require"
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# ============================================
# Paso 3: Production
# ============================================
FROM node:22-alpine AS production

# Instalar openssl - requerido por Prisma
RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package*.json ./

RUN npm install -g tsx

EXPOSE 5000

CMD ["node", "dist/src/main.js"]