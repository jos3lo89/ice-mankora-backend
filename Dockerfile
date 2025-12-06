# Usamos Node 24 (Alpine)
FROM node:24-alpine

# Instalamos OpenSSL (Vital para Prisma)
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# 1. Copiar package.json
COPY package*.json ./

# 2. Instalar dependencias (incluyendo 'tsx' y 'dev' para el build y el seed)
RUN npm install

# 3. Copiar TODO el proyecto (src, prisma, configs, etc.)
COPY . .

# 4. Generar Cliente Prisma (con variable dummy para el build)
ARG DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# 5. Compilar el proyecto (Creará dist/src/main.js según tu foto)
RUN npm run build

EXPOSE 5000

# ========================================================
# COMANDO FINAL CORREGIDO
# ========================================================
# Apuntamos a 'dist/src/main' en lugar de 'dist/main'
CMD ["/bin/sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/src/main"]