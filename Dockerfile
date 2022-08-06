FROM node:16-alpine3.16 as builder

WORKDIR /app

COPY package.json .
COPY yarn.lock .
COPY src/ ./src
COPY tsconfig.json .

RUN yarn install --frozen-lockfile
RUN yarn tsc

FROM node:16-alpine3.16 as prod

WORKDIR /app

COPY --from=builder app/package.json .
COPY --from=builder app/yarn.lock .
COPY --from=builder app/src/index.js .

RUN yarn install --frozen-lockfile --production
RUN rm -f package.json
RUN rm -f yarn.lock

CMD [ "node", "index.js" ]