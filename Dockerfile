# -----------------------------------------------------------
# ETAPA 1: Construcción (Builder)
# -----------------------------------------------------------
FROM node:24-alpine AS builder

# Instalar compatibilidad para Prisma en Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar todas las dependencias (incluyendo devDependencies para el build)
RUN npm ci

# Copiar el código fuente
COPY . .

# Generar el cliente de Prisma
RUN npx prisma generate

# Construir la aplicación NestJS (crea la carpeta /dist)
RUN npm run build

# -----------------------------------------------------------
# ETAPA 2: Producción (Runner)
# -----------------------------------------------------------
FROM node:24-alpine AS runner

# Instalar openssl requerido por Prisma en producción
RUN apk add --no-cache openssl

WORKDIR /app

# Copiar solo lo necesario desde la etapa de construcción
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# IMPORTANTE: Prisma 7 con Alpine requiere los motores binarios correctos
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Exponer el puerto de NestJS (por defecto 3000)
EXPOSE 3000

# Comando de inicio personalizado para Producción.
# 1. Ejecuta migraciones
# 2. Ejecuta el seed (OJO: Requiere que ts-node/tsx funcione o tener el seed compilado)
# 3. Inicia la app compilada
# NOTA: Usamos 'tsx' (si está en dependencias) o 'node' directo si compilamos el seed.
# Para asegurar que el seed funcione en prod sin ts-node, simplificamos a migrar e iniciar.
# Si necesitas seed sí o sí, asegúrate de que 'ts-node' esté en dependencies o usa el script de abajo.

CMD ["/bin/sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main"]