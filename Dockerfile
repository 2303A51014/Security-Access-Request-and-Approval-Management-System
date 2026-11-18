FROM node:22-alpine AS client-build
WORKDIR /app
COPY package*.json ./
COPY client/package*.json client/
RUN npm install
COPY client client
RUN npm run build --workspace client

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY server/package*.json server/
RUN npm install --omit=dev
COPY server server
COPY --from=client-build /app/client/dist client/dist
ENV NODE_ENV=production
EXPOSE 5000
CMD ["npm", "run", "start", "--workspace", "server"]
