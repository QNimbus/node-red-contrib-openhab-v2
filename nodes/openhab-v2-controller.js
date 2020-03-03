/*

OpenHAB nodes for IBM's Node-Red
https://github.com/QNimbus/node-red-contrib-openhab2
(c) 2020, Bas van Wetten <bas.van.wetten@gmail.com>

MIT License

Copyright (c) 2020 B. van Wetten

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

module.exports = function(RED) {
  /**
   * Imports
   */

  const path = require('path');
  const http = require('http');
  const https = require('https');
  const axios = require('axios').default;
  const EventSource = require('eventsource');

  /**
   * Local imports
   */

  const STATES = require('./includes/states');

  /**
   * HTTP Routes
   */

  RED.httpAdmin.get('/openhab2/public/*', function(req, res) {
    const options = {
      root: path.join(__dirname, '..', 'public'),
      dotfiles: 'deny'
    };
    res.sendFile(req.params[0], options);
  });

  RED.httpAdmin.get('/openhab2/items', function(req, res) {
    const config = req.query;
    const controller = RED.nodes.getNode(config.controller);

    if (controller && controller instanceof OpenHABNodeController) {
      controller.getItems().then((items = {}) => {
        res.json(items);
      });
    } else {
      res.json({});
    }
  });

  /**
   * Node definition
   */

  function OpenHABNodeController(config) {
    /**
     * Initialization
     */
    const node = this;
    RED.nodes.createNode(node, config);

    // timeoutID for reconnection of EventSource
    node.retryTimer = undefined;

    // Create EventSourceClient
    const EventSourceClient = function(node) {
      /**
       * Constants
       */
      const url = node.url + '/events';

      /**
       * Members methods
       */
      this.getState = function() {
        return node._client.readyState;
      };

      this.isConnected = function() {
        return node._client && node._client instanceof EventSource && node._client.readyState === STATES.EVENTSOURCE_STATE_TYPE.CONNECTED;
      };

      this.isConnecting = function() {
        return node._client && node._client instanceof EventSource && node._client.readyState === STATES.EVENTSOURCE_STATE_TYPE.CONNECTING;
      };

      this.isDisconnected = function() {
        return !node._client || !(node._client instanceof EventSource) || node._client.readyState === STATES.EVENTSOURCE_STATE_TYPE.DISCONNECTED;
      };

      /**
       * Utility methods
       */

      const parseJSON = function fn(json) {
        /* eslint-disable no-new-func */
        return Function('return {wrap:' + json + '}')().wrap; // jshint ignore:line
        /* eslint-enable no-new-func */
      };

      /**
       * Event handlers
       */
      this.onOpen = function(event) {
        node.debug(`Connected to ${url}`);
        node.emit(STATES.EVENTSOURCE_STATE, STATES.EVENTSOURCE_STATE_TYPE.CONNECTED);
      };

      this.onMessage = function(messageEvent) {
        let parsedMessage;

        try {
          parsedMessage = parseJSON(messageEvent.data);
          parsedMessage.payload = parseJSON(parsedMessage.payload);
        } catch (error) {
          // TODO JSON parsing failed
        }

        // Topic e.g. 'smarthome/items/My_Light_Switch/state'
        // This grabs the string between the first 16 characters and the last '/' which is the item name
        const item = parsedMessage.topic.slice(16, parsedMessage.topic.lastIndexOf('/'));
        const type = parsedMessage.type;
        const state = parsedMessage.payload.value;
        const payload = parsedMessage.payload;

        node.emit(`${item}/${type}`, { item, type, state, payload });
      };

      this.onError = function(event) {
        const message = event.message || '';
        const status = event.status;
        let retryConnection = true;

        let errorMessage;

        if (message.toUpperCase().includes('ENOTFOUND') || status === 404) {
          errorMessage = `SSE ${url} - Not found`;
        } else if (status === 401 || status === 403) {
          errorMessage = `SSE ${url} - Not authorized`;
          retryConnection = false;
        } else if (message.toUpperCase().includes('ECONNREFUSED')) {
          errorMessage = `SSE ${url} - Connection refused`;
        } else if (message.toUpperCase().includes('CERTIFICATE')) {
          errorMessage = `SSE ${url} - Certificate error`;
          retryConnection = false;
        } else {
          errorMessage = `SSE ${url} - Connection lost`;
        }

        // If connection was interrupted or lost then 'event.message' is undefined
        // In that case the EventSource will try to reconnect itself
        if (!event.message) {
          node.emit(STATES.EVENTSOURCE_STATE, node._client.readyState);
        } else {
          node._client.removeAllListeners();
          node._client.close();
          delete node._client;

          // Retry to connect in 15 seconds
          if (retryConnection) {
            node.retryTimer = setTimeout(() => {
              node.sseClient.connect();
            }, 15000);
          }

          node.emit(STATES.EVENTSOURCE_STATE, STATES.EVENTSOURCE_STATE_TYPE.ERROR, errorMessage);
        }

        // Log error message
        node.warn(errorMessage);
      };

      /**
       * Main methods
       */
      this.connect = function() {
        if (!node._client || !(node._client instanceof EventSource)) {
          node._client = new EventSource(url, {
            headers: { ...node.clientHeaders },
            https: { rejectUnauthorized: node.verifyCertificate }
          });

          node._client.on('open', this.onOpen);
          node._client.on('message', this.onMessage);
          node._client.on('error', this.onError);
        }

        node.debug(`Connecting to ${url}`);
        node.emit(STATES.EVENTSOURCE_STATE, STATES.EVENTSOURCE_STATE_TYPE.CONNECTING);

        return node._client;
      };

      this.disconnect = function() {
        // If we have an EventSource instance remove all listeners and close connection
        if (node._client && node._client instanceof EventSource) {
          node._client.removeAllListeners();
          node._client.close();

          node.debug(`Disconnecting from ${url}`);
          node.emit(STATES.EVENTSOURCE_STATE, STATES.EVENTSOURCE_STATE_TYPE.DISCONNECTED);
        }

        // If a reconnect timer is running, cancel it
        if (node.retryTimer) {
          clearTimeout(node.retryTimer);
        }
      };
    };

    // Load node configuration
    node.name = config.name;
    node.host = config.host;

    node.port = config.port;
    node.protocol = config.protocol;
    node.verifyCertificate = !config.ignoreInvalidCertificate;
    node.url = `${node.protocol}://${node.host}:${node.port}/rest`;
    node.clientHeaders = {};

    // Create Basic Auth headers if credentials are present in node config
    if (node.credentials.username && node.credentials.password) {
      const auth = Buffer.from(`${node.credentials.username}:${node.credentials.password}`).toString('base64');
      node.clientHeaders = { Authorization: `Basic ${auth}`, ...node.clientHeaders };
    }

    // Linters do not like an anonymous constructor function
    // Therefore we first create the (named) EventSourceClient constructor and
    // then we create an instance of the EventSourceClient and assign it to node.sseClient
    node.sseClient = new EventSourceClient(node);

    // Initialize Axios client for GET/POST/PUT requests
    node.axios = axios.create({
      method: 'get',
      baseURL: node.url,
      auth: {
        username: config.username,
        password: config.password
      },
      httpAgent: new http.Agent({}),
      httpsAgent: new https.Agent({
        rejectUnauthorized: !!config.checkCertificate
      })
    });

    /**
     * Node methods
     */

    node.sendItem = (itemName, topic, payload) => {
      switch (topic) {
        case 'ItemUpdate': {
          node.debug(`HTTP PUT request items/${itemName}/state : ${String(payload)}`);
          return node.axios.put(`items/${itemName}/state`, String(payload), { headers: { 'Content-Type': 'text/plain' } });
        }
        case 'ItemCommand': {
          node.debug(`HTTP POST request items/${itemName} : ${String(payload)}`);
          return node.axios.post(`items/${itemName}`, String(payload), { headers: { 'Content-Type': 'text/plain' } });
        }
        default: {
          // TODO: Handle incorrect topic
          break;
        }
      }
    };

    node.getItem = itemName => {
      node.debug(`HTTP GET request items/${itemName}`);
      return node.axios
        .get(`items/${itemName}`)
        .then(response => Promise.resolve(response.data))
        .catch(error => {
          node.warn(error);
        });
    };

    node.getItems = () => {
      node.debug('HTTP GET request items');
      return node.axios
        .get('items')
        .then(response => Promise.resolve(response.data))
        .catch(error => {
          node.warn(error);
        });
    };

    /**
     * Node event handlers
     */

    node.on('close', () => {
      node.sseClient.disconnect();
    });

    /**
     * Node main
     */

    node.sseClient.connect();
  }

  /**
   * Register node
   */

  RED.nodes.registerType('openhab-v2-controller', OpenHABNodeController, {
    credentials: {
      username: { type: 'text' },
      password: { type: 'password' }
    }
  });
};
