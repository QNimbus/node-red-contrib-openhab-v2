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
  const EventSource = require('eventsource');

  /**
   * Constants
   */

  const EVENTSOURCE_STATE = 'EVENTSOURCE_STATE';
  const EVENTSOURCE_STATE_TYPE = Object.freeze({ CONNECTING: 0, CONNECTED: 1, DISCONNECTED: 2, ERROR: 3 });

  /**
   * Helper methods
   */

  const updateNodeStatus = (node, newState, newStateText) => {
    // TODO Have node context retain it's current state message
    const currentStateText = ''; // node.context().get('currentState');

    switch (newState) {
      case EVENTSOURCE_STATE_TYPE.CONNECTED: {
        node.status({ fill: 'green', shape: 'dot', text: newStateText !== undefined ? newStateText : 'Connected' });
        break;
      }
      case EVENTSOURCE_STATE_TYPE.CONNECTING: {
        node.status({ fill: 'green', shape: 'ring', text: newStateText !== undefined ? newStateText : 'Connecting' });
        break;
      }
      case EVENTSOURCE_STATE_TYPE.DISCONNECTED: {
        node.status({ fill: 'grey', shape: 'dot', text: newStateText !== undefined ? newStateText : 'Disconnected' });
        break;
      }
      case EVENTSOURCE_STATE_TYPE.ERROR: {
        node.status({ fill: 'red', shape: 'dot', text: newStateText !== undefined ? newStateText : 'Error' });
        break;
      }
      default: {
        node.status({ fill: 'grey', shape: 'dot', text: newStateText !== undefined ? newStateText : currentStateText });
        break;
      }
    }
  };

  /**
   * Node definitions
   */

  function OpenHABNodeController(config) {
    // Initialize node
    const node = this;
    RED.nodes.createNode(node, config);

    // timeoutID for reconnection of EventSource
    node.retryTimer = undefined;

    // Create EventSourceClient
    const EventSourceClient = function() {
      // Utility methods
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

      // Event handlers
      this.onOpen = function(event) {
        // TODO Log succesfull connection
        node.emit(EVENTSOURCE_STATE, EVENTSOURCE_STATE_TYPE.CONNECTED);
      };

      this.onMessage = function(messageEvent) {};

      this.onError = function(event) {
        const message = event.message || '';
        const status = event.status;

        let errorMessage;

        if (message.includes('ENOTFOUND') || status === 404) {
          errorMessage = `Not found - ${node.url}`;
        } else if (status === 401 || status === 403) {
          errorMessage = `Not authorized - ${node.url}`;
        } else if (message.includes('ECONNREFUSED')) {
          errorMessage = `Connection refused - ${node.url}`;
        } else {
          errorMessage = `Connection lost - ${node.url}`;
        }

        // If connection was interrupted or lost then 'event.message' is undefined
        // In that case the EventSource will try to reconnect itself
        if (!event.message) {
          node.emit(EVENTSOURCE_STATE, node._client.readyState);
        } else {
          node.retryTimer = setTimeout(() => {
            node.client.connect();
          }, 5000);
          node._client.removeAllListeners();
          node._client.close();
          delete node._client;

          node.emit(EVENTSOURCE_STATE, EVENTSOURCE_STATE_TYPE.ERROR, errorMessage);
        }

        // Log error message
        node.warn(errorMessage);
      };

      // Methods
      this.connect = function() {
        // TODO Log connection attempt
        if (!node._client || !(node._client instanceof EventSource)) {
          node._client = new EventSource(node.url, { headers: Object.assign({}, node.headers) });

          node._client.on('open', this.onOpen);
          node._client.on('message', this.onMessage);
          node._client.on('error', this.onError);
        }

        node.emit(EVENTSOURCE_STATE, EVENTSOURCE_STATE_TYPE.CONNECTING);

        return node._client;
      };

      this.disconnect = function() {
        // TODO Log disconnect
        // If we have an EventSource instance remove all listeners and close connection
        if (node._client && node._client instanceof EventSource) {
          node._client.removeAllListeners();
          node._client.close();
        }

        // If a reconnect timer is running, cancel it
        if (node.retryTimer) {
          clearTimeout(node.retryTimer);
        }

        node.emit(EVENTSOURCE_STATE, EVENTSOURCE_STATE_TYPE.DISCONNECTED);
      };
    };

    // Load node configuration
    node.name = config.name;
    node.host = config.host;
    node.port = config.port;
    node.protocol = config.protocol;
    node.url = `${node.protocol}://${node.host}:${node.port}/rest/events`;
    node.headers = {};

    // Create Basic Auth headers if credentials are present in node config
    if (config.username && config.password) {
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      node.headers = Object.assign(node.headers, { Authorization: `Basic ${auth}` });
    }

    // Linters do not like an anonymous constructor function
    node.client = new EventSourceClient();

    // Node event handlers
    node.on('close', () => {
      node.client.disconnect();
    });

    node.client.connect();
  }

  function OpenHABNodeIn(config) {
    // Initialize node
    const node = this;
    const controller = RED.nodes.getNode(config.controller);
    RED.nodes.createNode(node, config);

    // Load node configuration
    node.name = config.name;

    // TODO Proper handling of missing controller
    if (!controller) {
      node.warn('No controller');
      return false;
    }

    // Node event handlers
    controller.addListener(EVENTSOURCE_STATE, updateNodeStatus.bind(null, node));

    node.on('close', () => {
      controller.removeListener(EVENTSOURCE_STATE, updateNodeStatus.bind(null, node));
      node.trace('Closing node');
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
