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

  function OpenHABNodeGet(config) {
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
    node.items = config.items;
    node.getGroupMembers = config.getGroupMembers;
    node.allowItemOverride = config.allowItemOverride;

    // Node constants
    node.timeZoneOffset = Object.freeze(new Date().getTimezoneOffset() * 60000);

    // getCurrentTimestamp
    node.getCurrentTimestamp = config.ohTimestamp ? () => new Date(Date.now() - node.timeZoneOffset).toISOString().slice(0, -1) : Date.now;

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
      const payload = message.payload;
      let items = !config.allowItemOverride ? node.items : payload.items || payload.item || node.items;
      let clonedMessage = RED.util.cloneMessage(message);

      if (items) {
        // Sanitize items array
        if (typeof items === 'string') {
          items = [{ item: items }];
        } else if (Array.isArray(items)) {
          if (items.every(val => typeof val === 'string')) {
            items.forEach((val, index) => {
              items[index] = { item: val };
            });
          } else if (items.every(val => typeof val === 'object') && items.every(val => val.item !== undefined)) {
            // Items array already sanitized
          } else {
            // TODO: Handle invalid payload
            items = [];
          }
        } else {
          // TODO: Handle invalid payload
          items = [];
        }

        const reqs = [];
        items.forEach(({ item }) => {
          reqs.push(controller.getItem(item));
        });

        // Recursively drill down into group members and add them to the root object
        const getMembers = function(obj) {
          let root = {};
          if (obj.members && Array.isArray(obj.members)) {
            obj.members.forEach(val => {
              root = { ...root, [val.name]: val, ...getMembers(val) };
            });
          }
          return root;
        };

        Promise.all(reqs)
          .then(val => {
            const items = val.reduce((obj, item) => {
              const members = node.getGroupMembers ? { ...getMembers(item) } : {};
              return {
                ...obj,
                [item.name]: item,
                ...members
              };
            }, {});

            clonedMessage = { ...clonedMessage, payload: items };

            // Send message
            // See: https://nodered.org/blog/2019/09/13/cloning-messages#cloning-by-default
            node.send(clonedMessage, false);
          })
          .catch(error => {
            // Log error message
            node.warn(error.message);

            // Change node state
            updateNodeStatus(node, STATES.NODE_STATE, STATES.NODE_STATE_TYPE.ERROR, error.message);
          });
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
    node.on('close', () => {
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

  RED.nodes.registerType('openhab-v2-get', OpenHABNodeGet);
};
