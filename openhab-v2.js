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
   * Constants
   */

  const NODE_STATE = 'NODE_STATE';
  const EVENTSOURCE_STATE = 'EVENTSOURCE_STATE';
  const NODE_STATE_TYPE = Object.freeze({ ERROR: 99 });
  const EVENTSOURCE_STATE_TYPE = Object.freeze({ CONNECTING: 0, CONNECTED: 1, DISCONNECTED: 2, ERROR: 3 });

  /**
   * Helper methods
   */
  const updateNodeStatus = (node, newState, newStateType, newStateTypeText) => {
    // TODO Have node context retain it's current state message
    const currentStateText = ''; // node.context().get('currentState');

    if (newState === EVENTSOURCE_STATE) {
      switch (newStateType) {
        case EVENTSOURCE_STATE_TYPE.CONNECTED: {
          node.status({ fill: 'green', shape: 'dot', text: newStateTypeText !== undefined ? newStateTypeText : 'Connected' });
          break;
        }
        case EVENTSOURCE_STATE_TYPE.CONNECTING: {
          node.status({ fill: 'green', shape: 'ring', text: newStateTypeText !== undefined ? newStateTypeText : 'Connecting' });
          break;
        }
        case EVENTSOURCE_STATE_TYPE.DISCONNECTED: {
          node.status({ fill: 'grey', shape: 'dot', text: newStateTypeText !== undefined ? newStateTypeText : 'Disconnected' });
          break;
        }
        case EVENTSOURCE_STATE_TYPE.ERROR: {
          node.status({ fill: 'red', shape: 'dot', text: newStateTypeText !== undefined ? newStateTypeText : 'Error' });
          break;
        }
        default: {
          node.status({ fill: 'grey', shape: 'dot', text: newStateTypeText !== undefined ? newStateTypeText : currentStateText });
          break;
        }
      }
    } else if (newState === NODE_STATE) {
      switch (newStateType) {
        case NODE_STATE_TYPE.ERROR: {
          node.status({ fill: 'red', shape: 'dot', text: newStateTypeText !== undefined ? newStateTypeText : 'Error' });
          break;
        }
        default: {
          node.status({ fill: 'grey', shape: 'dot', text: newStateTypeText !== undefined ? newStateTypeText : currentStateText });
          break;
        }
      }
    } else {
      // Clear node status
      node.status({});
    }
  };

  /**
   * Node definitions
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
       * Utility methods
       */
      this.getState = function() {
        return node._client.readyState;
      };

      this.isConnected = function() {
        return node._client && node._client instanceof EventSource && node._client.readyState === EVENTSOURCE_STATE_TYPE.CONNECTED;
      };

      this.isConnecting = function() {
        return node._client && node._client instanceof EventSource && node._client.readyState === EVENTSOURCE_STATE_TYPE.CONNECTING;
      };

      this.isDisconnected = function() {
        return !node._client || !(node._client instanceof EventSource) || node._client.readyState === EVENTSOURCE_STATE_TYPE.DISCONNECTED;
      };

      /**
       * Event handlers
       */
      this.onOpen = function(event) {
        node.log(`Connected to ${url}`);
        node.emit(EVENTSOURCE_STATE, EVENTSOURCE_STATE_TYPE.CONNECTED);
      };

      this.onMessage = function(messageEvent) {};

      this.onError = function(event) {
        const message = event.message || '';
        const status = event.status;
        let retryConnection = true;

        let errorMessage;

        if (message.toUpperCase().includes('ENOTFOUND') || status === 404) {
          errorMessage = `Not found - ${url}`;
        } else if (status === 401 || status === 403) {
          errorMessage = `Not authorized - ${url}`;
          retryConnection = false;
        } else if (message.toUpperCase().includes('ECONNREFUSED')) {
          errorMessage = `Connection refused - ${url}`;
        } else if (message.toUpperCase().includes('CERTIFICATE')) {
          errorMessage = `Certificate error - ${url}`;
          retryConnection = false;
        } else {
          errorMessage = `Connection lost - ${url}`;
        }

        // If connection was interrupted or lost then 'event.message' is undefined
        // In that case the EventSource will try to reconnect itself
        if (!event.message) {
          node.emit(EVENTSOURCE_STATE, node._client.readyState);
        } else {
          node._client.removeAllListeners();
          node._client.close();
          delete node._client;

          // Retry to connect in 10 seconds
          if (retryConnection) {
            node.retryTimer = setTimeout(() => {
              node.client.connect();
            }, 10000);
          }

          node.emit(EVENTSOURCE_STATE, EVENTSOURCE_STATE_TYPE.ERROR, errorMessage);
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
            headers: Object.assign({}, node.clientHeaders),
            https: { rejectUnauthorized: !node.allowInsecure }
          });

          node._client.on('open', this.onOpen);
          node._client.on('message', this.onMessage);
          node._client.on('error', this.onError);
        }

        node.log(`Connecting to ${url}`);
        node.emit(EVENTSOURCE_STATE, EVENTSOURCE_STATE_TYPE.CONNECTING);

        return node._client;
      };

      this.disconnect = function() {
        // If we have an EventSource instance remove all listeners and close connection
        if (node._client && node._client instanceof EventSource) {
          node._client.removeAllListeners();
          node._client.close();

          node.log(`Disconnecting from ${url}`);
          node.emit(EVENTSOURCE_STATE, EVENTSOURCE_STATE_TYPE.DISCONNECTED);
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
      this.get = path =>
        new Promise((resolve, reject) => {
          const url = node.url + path;
          const options = {
            url,
            followRedirect: false,
            rejectUnauthorized: !node.allowInsecure,
            headers: {
              'User-Agent': 'request'
            }
          };
          node.log(`GET Request ${url}`);
          Request.get(options, (error, response, body) => {
            if (error) {
              reject(error);
            } else {
              resolve(body);
            }
          });
        });
    };

    // Load node configuration
    node.name = config.name;
    node.host = config.host;

    node.port = config.port;
    node.protocol = config.protocol;
    node.allowInsecure = !!config.allowInsecure;
    node.url = `${node.protocol}://${node.host}:${node.port}`;
    node.clientHeaders = {};

    // Create Basic Auth headers if credentials are present in node config
    if (config.username && config.password) {
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      node.clientHeaders = Object.assign(node.clientHeaders, { Authorization: `Basic ${auth}` });
    }

    // Linters do not like an anonymous constructor function
    // Therefore we first create the (named) EventSourceClient constructor and
    // then we create an instance of the EventSourceClient and assign it to node.client
    node.client = new EventSourceClient(node);

    node.request = new RequestClient(node);

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

  function OpenHABNodeIn(config) {
    /**
     * Initialization
     */
    const node = this;
    const controller = RED.nodes.getNode(config.controller);
    RED.nodes.createNode(node, config);

    // Load node configuration
    node.name = config.name;

    if (!controller) {
      node.warn('No controller');
      updateNodeStatus(node, NODE_STATE, NODE_STATE_TYPE.ERROR, 'No controller');
      return false;
    }

    /**
     * Node event handlers
     */
    controller.addListener(EVENTSOURCE_STATE, updateNodeStatus.bind(null, node, EVENTSOURCE_STATE));

    node.on('close', () => {
      controller.removeListener(EVENTSOURCE_STATE, updateNodeStatus.bind(null, node, EVENTSOURCE_STATE));
      node.trace('Closing node');
    });

    /**
     * Node main
     */
    controller.request
      .get('/rest/items')
      .then(res => {})
      .catch(error => {
        node.error(error);
      });
  }

  /**
   * Register nodes
   */

  // Controller node
  RED.nodes.registerType('openhab-v2-controller', OpenHABNodeController);

  // Nodes
  RED.nodes.registerType('openhab-v2-in', OpenHABNodeIn);

  /**
   * HTTP Routes
   */

  RED.httpAdmin.get('/openhab2/static/*', function(req, res) {
    const options = {
      root: path.join(__dirname, 'static'),
      dotfiles: 'deny'
    };
    res.sendFile(req.params[0], options);
  });
};
