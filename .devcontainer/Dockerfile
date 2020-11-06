FROM nodered/node-red

USER root

# Add GNUPG to allow for signed commits
RUN apk add gnupg --no-cache

USER node-red

WORKDIR /usr/src/node-red

# Install nodemon to enable restarting of NodeRED when developing
RUN npm install nodemon

COPY entrypoint.sh /

ENTRYPOINT [ "/entrypoint.sh" ]
