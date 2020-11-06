#!/bin/sh

cd /usr/src/node-red

# Add 'node-red-contrib-openhab-v2' node to NodeRED palette
npm install /workspace

# Start nodemon
npx nodemon -L -e js,json,html --watch /workspace -x "npm run debug --cache /data/.npm -- --userDir /data --nodesDir /workspace"
