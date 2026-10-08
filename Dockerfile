# database/ is a git submodule of this repo (see .gitmodules) — `git clone --recurse-submodules`
# (or an equivalent "checkout submodules" option, which most CI/deploy platforms offer) pulls it
# in automatically, so this builds from server/ alone: `docker build -t glasslogic-server .`
FROM node:20-alpine
WORKDIR /app

COPY database/package.json database/package-lock.json ./database/
RUN cd database && npm install --omit=dev

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY database/config ./database/config
COPY . .

EXPOSE 4000
CMD ["node", "index.js"]
