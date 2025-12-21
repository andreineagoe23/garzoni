# syntax=docker/dockerfile:1

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# CRA env vars for development server
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_BACKEND_PORT
ARG REACT_APP_CHECKOUT_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    REACT_APP_BACKEND_PORT=$REACT_APP_BACKEND_PORT \
    REACT_APP_CHECKOUT_URL=$REACT_APP_CHECKOUT_URL

# Expose the default React dev server port
EXPOSE 3000

# Set HOST to 0.0.0.0 to make dev server accessible from outside container
ENV HOST=0.0.0.0

# Run development server instead of building
CMD ["npm", "start"]
