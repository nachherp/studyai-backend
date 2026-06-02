# Usar la versión LTS de Node 
FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias y generar cliente Prisma
RUN npm install
RUN npx prisma generate

# Copiar el código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Exponer el puerto
EXPOSE 3000

# Iniciar la aplicación
CMD ["npm", "start"]