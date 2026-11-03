FROM node:20-alpine

WORKDIR /app

# Copy application sources and install dependencies (triggers postinstall -> build-rich.js)
COPY . .
RUN npm install --omit=dev

# Expose server port (Render & container defaults)
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
