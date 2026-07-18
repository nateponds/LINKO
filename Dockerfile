# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Build-time public browser token only. Vite embeds it in client JavaScript.
# Never pass a Mapbox secret sk.* token. See docs/MAPBOX_SETUP.md.
ARG VITE_MAPBOX_TOKEN
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Copy custom nginx config template to support React SPA routing and dynamic API proxy
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
