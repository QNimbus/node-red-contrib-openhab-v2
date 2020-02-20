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
  const Request = require('request');
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
      controller.getItems().then(items => {
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
      const url = node.url + '/rest/events';

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
          errorMessage = `EventSource ${url} - Not found`;
        } else if (status === 401 || status === 403) {
          errorMessage = `EventSource ${url} - Not authorized`;
          retryConnection = false;
        } else if (message.toUpperCase().includes('ECONNREFUSED')) {
          errorMessage = `EventSource ${url} - Connection refused`;
        } else if (message.toUpperCase().includes('CERTIFICATE')) {
          errorMessage = `EventSource ${url} - Certificate error`;
          retryConnection = false;
        } else {
          errorMessage = `EventSource ${url} - Connection lost`;
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
              node.client.connect();
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
            https: { rejectUnauthorized: node.checkCertificate }
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

    // Create RequestClient
    const RequestClient = function() {
      /**
       * Main methods
       */
      this.get = (path, customOptions = {}) =>
        new Promise((resolve, reject) => {
          const url = node.url + path;
          const options = {
            url,
            followRedirect: false,
            rejectUnauthorized: node.checkCertificate,
            headers: {
              'User-Agent': 'request'
            },
            ...customOptions
          };
          node.debug(`GET Request ${url}`);
          Request.get(options, (error, response, body) => {
            if (!error) {
              resolve(body);
            } else {
              console.log(response);
              console.log(body);
              reject(error);
            }
          });
        });
    };

    // Load node configuration
    node.name = config.name;
    node.host = config.host;

    node.port = config.port;
    node.protocol = config.protocol;
    node.checkCertificate = !!config.checkCertificate;
    node.url = `${node.protocol}://${node.host}:${node.port}`;
    node.clientHeaders = {};

    // Create Basic Auth headers if credentials are present in node config
    if (config.username && config.password) {
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      node.clientHeaders = { Authorization: `Basic ${auth}`, ...node.clientHeaders };
    }

    // Linters do not like an anonymous constructor function
    // Therefore we first create the (named) EventSourceClient constructor and
    // then we create an instance of the EventSourceClient and assign it to node.client
    node.client = new EventSourceClient(node);

    node.request = new RequestClient(node);

    /**
     * Node methods
     */

    node.getItems = () => {
      const endpoint = '/rest/items/';

      return node.request.get(endpoint, { json: true }).catch(error => {
        const { message } = error;
        let errorMessage;

        if (message.toUpperCase().includes('ENOTFOUND')) {
          errorMessage = `Not found - GET Request ${endpoint}`;
        } else if (message.toUpperCase().includes('ECONNREFUSED')) {
          errorMessage = `Connection refused - GET Request ${endpoint}`;
        } else if (message.toUpperCase().includes('CERTIFICATE')) {
          errorMessage = `Certificate error - GET Request ${endpoint}`;
        } else {
          errorMessage = `Connection lost - GET Request ${endpoint}`;
        }

        // Log error message
        node.warn(errorMessage);
      });
    };

    /**
     * Node event handlers
     */

    node.on('close', () => {
      node.client.disconnect();
    });

    /**
     * Node main
     */

    node.client.connect();
  }

  /**
   * Register node
   */

  RED.nodes.registerType('openhab-v2-controller', OpenHABNodeController);
};
