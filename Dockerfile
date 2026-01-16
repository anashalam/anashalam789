# 1. Base image select karein
FROM node:18

# 2. Working directory set karein
WORKDIR /app

# 3. Pehle package files copy karein aur install karein
COPY package*.json ./
RUN npm install

# 4. Prisma users ke liye: Prisma client generate karein
COPY prisma ./prisma/
RUN npx prisma generate

# 5. Baqi saara code copy karein
COPY . .

# 6. Port expose karein
EXPOSE 8080

# 7. Server start karne ki command
CMD ["npm", "start"]