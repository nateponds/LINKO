FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5000
# Run database migrations before starting the Express server
CMD ["sh", "-c", "npm run migrate && npm start"]
