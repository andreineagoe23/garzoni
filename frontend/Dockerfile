# syntax=docker/dockerfile:1

FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# CRA env vars are baked at build time.
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_BACKEND_PORT
ARG REACT_APP_CHECKOUT_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    REACT_APP_BACKEND_PORT=$REACT_APP_BACKEND_PORT \
    REACT_APP_CHECKOUT_URL=$REACT_APP_CHECKOUT_URL

RUN npm run build


FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


