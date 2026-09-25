FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js ./
ENV NODE_ENV=production
USER node
CMD ["node", "index.js"]
