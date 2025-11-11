FROM node:18-alpine

WORKDIR /server

COPY . /server

RUN npm install

#RUN apk add dos2unix
#RUN dos2unix /server/migrate.sh

EXPOSE 8080

CMD npm start