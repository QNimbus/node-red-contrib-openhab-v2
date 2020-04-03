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
   * Local imports
   */

  const STATES = require('./includes/states');
  const updateNodeStatus = require('./includes/utility').updateNodeStatus;

  /**
   * Node definition
   */

  function OpenHABNodeOut(config) {
    /**
     * Initialization
     */
    const node = this;
    const controller = RED.nodes.getNode(config.controller);
    RED.nodes.createNode(node, config);

    if (!controller) {
      node.warn('No controller');
      updateNodeStatus(node, STATES.NODE_STATE, STATES.NODE_STATE_TYPE.ERROR, 'No controller');
      return false;
    }

    // Load node configuration
    node.name = config.name;
    node.item = config.item;
    node.allowItemOverride = config.allowItemOverride;

    /**
     * Node methods
     */

    node.getTopic = message => {
      switch (config.topicType) {
        case 'msg': {
          return message[config.topic];
        }
        case 'str':
        case 'ohCommandType':
        default: {
          return config.topic;
        }
      }
    };

    node.getPayload = message => {
      switch (config.payloadType) {
        case 'msg': {
          return message[config.payload];
        }
        case 'date': {
          return Date.now();
        }
        case 'flow':
        case 'global':
        case 'num':
        case 'str':
        case 'bool':
        case 'env':
        case 'json':
        default: {
          return RED.util.evaluateNodeProperty(config.payload, config.payloadType, this, message);
        }
      }
    };

    /**
     * Node event handlers
     */

    node.onControllerEvent = (event, message) => {
      // Always update node state
      updateNodeStatus(node, STATES.EVENTSOURCE_STATE, event, message);

      switch (event) {
        // If the controller just connected to the EventSource
        case STATES.EVENTSOURCE_STATE_TYPE.CONNECTED: {
          break;
        }
        // Ignore other events
        default: {
          break;
        }
      }
    };

    node.onInput = message => {
      const item = message.item || node.item;

      if (item) {
        const topic = node.getTopic(message);
        const payload = node.getPayload(message);

        if (topic) {
          if (payload) {
            controller.sendItem(item, topic, payload).catch(({ response: { status, statusText } }) => {
              node.error(`Error ${status}: ${statusText}`);

              // TODO: Update node status in case of error
            });
          } else {
            // TODO: Handle no payload case
            // node.updateNodeStatus(STATE.NO_PAYLOAD);
          }
        } else {
          // TODO: Handle no topic case
          // node.updateNodeStatus(STATE.NO_TOPIC);
        }
      } else {
        // TODO: Handle no item case
        // node.updateNodeStatus(STATE.NO_ITEM);
      }
    };

    /**
     * Attach event handlers
     */

    // Listen for state changes from controller
    controller.on(STATES.EVENTSOURCE_STATE, node.onControllerEvent);
    node.debug(`Attaching 'controller' event listener '${STATES.EVENTSOURCE_STATE}'`);

    // Listen for node input messages
    node.on('input', node.onInput);
    node.debug("Attaching 'node' event listener 'input'");

    // Cleanup event listeners upon node removal
    node.on('close', done => {
      node.removeListener('input', node.onInput);
      node.debug("Removing 'node' event listener 'input'");

      controller.removeListener(STATES.EVENTSOURCE_STATE, node.onControllerEvent);
      node.debug(`Removing 'controller' event listener '${STATES.EVENTSOURCE_STATE}'`);

      node.debug('Closing node');
      done();
    });

    /**
     * Node main
     */
  }

  /**
   * Register node
   */

  RED.nodes.registerType('openhab-v2-out', OpenHABNodeOut);
};
