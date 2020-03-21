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

    /**
     * Node event handlers
     */

    node.onControllerEvent = (event, message) => {
      // Always update node state
      updateNodeStatus(node, STATES.EVENTSOURCE_STATE, event, message);

      switch (event) {
        // If the controller just connected to the EventSource
        case STATES.EVENTSOURCE_STATE_TYPE.CONNECTED: {
          // If we have an item configured
          if (node.item) {
            // Fetch current state of item
            controller
              .getItem(node.item)
              .then(item => {
                updateNodeStatus(node, STATES.NODE_STATE, STATES.NODE_STATE_TYPE.CURRENT_STATE, item.state);
              })
              .catch(error => {
                // Log error message
                node.warn(error.message);

                // Change node state
                updateNodeStatus(node, STATES.NODE_STATE, STATES.NODE_STATE_TYPE.ERROR, error.message);
              });
          }
          break;
        }
        // Ignore other events
        default: {
          break;
        }
      }
    };

    node.onInput = message => {
      const topicType = config.topicType;
      const payloadType = config.payloadType;

      let topic = config.topic;
      let payload = config.payload;

      switch (topicType) {
        case 'msg': {
          topic = message[topic];
          break;
        }
        case 'str':
        case 'ohCommandType':
        default: {
          // Keep selected topic
          break;
        }
      }

      switch (payloadType) {
        case 'msg': {
          payload = message[payload];
          break;
        }
        case 'flow':
        case 'global': {
          RED.util.evaluateNodeProperty(payload, payloadType, this, message, function(error, result) {
            if (error) {
              node.error(error, message);
            } else {
              payload = result;
            }
          });
          break;
        }
        case 'date': {
          payload = Date.now();
          break;
        }
        case 'num':
        case 'str':
        default: {
          // Keep selected payload
          break;
        }
      }

      if (node.item && topic) {
        if (payload !== undefined) {
          controller.sendItem(node.item, topic, payload).catch(error => {
            node.error(error);
          });
        } else {
          // node.updateNodeStatus(STATE.NO_PAYLOAD);
        }
      } else {
        // node.updateNodeStatus(STATE.NO_TOPIC);
      }
    };

    node.onEvent = event => {
      // Update node state
      updateNodeStatus(node, STATES.NODE_STATE, STATES.NODE_STATE_TYPE.CURRENT_STATE, event.state);

      // Store state in current flow
      if (node.storeState) {
        node.flowContext.set(node.item, event.state);
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

    // Listen for subscribed events for selected item
    if (node.item) {
      ['ItemStateChangedEvent', 'GroupItemStateChangedEvent'].forEach(eventType => {
        controller.on(`${node.item}/${eventType}`, node.onEvent);
        node.debug(`Attaching 'node' event listener '${node.item}/${eventType}'`);
      });
    }

    // Cleanup event listeners upon node removal
    node.on('close', () => {
      if (node.item) {
        ['ItemStateChangedEvent', 'GroupItemStateChangedEvent'].forEach(eventType => {
          controller.removeListener(`${node.item}/${eventType}`, node.onEvent);
          node.debug(`Removing 'node' event listener '${node.item}/${eventType}'`);
        });
      }

      node.removeListener('input', node.onInput);
      node.debug("Removing 'node' event listener 'input'");

      controller.removeListener(STATES.EVENTSOURCE_STATE, node.onControllerEvent);
      node.debug(`Removing 'controller' event listener '${STATES.EVENTSOURCE_STATE}'`);

      node.debug('Closing node');
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
