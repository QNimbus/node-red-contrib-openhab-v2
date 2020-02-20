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

  function OpenHABNodeIn(config) {
    /**
     * Initialization
     */
    const node = this;
    const controller = RED.nodes.getNode(config.controller);
    RED.nodes.createNode(node, config);

    // Load node configuration
    node.name = config.name;
    node.item = config.item;
    node.eventTypes = config.eventTypes;
    node.ohTimestamp = config.ohTimestamp;
    node.initialOutput = config.initialOutput;
    node.storeState = config.storeState;
    node.flowContext = node.context().flow;
    node.globalContext = node.context().global;

    // Node constants
    node.timeZoneOffset = Object.freeze(new Date().getTimezoneOffset() * 60000);

    if (!controller) {
      node.warn('No controller');
      updateNodeStatus(node, STATES.NODE_STATE, STATES.NODE_STATE_TYPE.ERROR, 'No controller');
      return false;
    }

    /**
     * Node event handlers
     */

    node.onEvent = event => {
      const { payload, ...message } = event;
      const timestamp = node.ohTimestamp ? new Date(Date.now() - node.timeZoneOffset).toISOString().slice(0, -1) : Date.now();

      // Send node message
      node.send([{ payload: { ...message, timestamp: timestamp } }]);

      // Update node state
      updateNodeStatus(node, STATES.NODE_STATE, STATES.NODE_STATE_TYPE.CURRENT_STATE, event.state);

      // Store state in current flow
      if (node.storeState) {
        node.flowContext.set(node.item, event.state);
      }
    };

    node.onControllerEvent = (event, message) => {
      // Always update node state
      updateNodeStatus(node, STATES.EVENTSOURCE_STATE, event, message);

      switch (event) {
        // If the controller just connected to the EventSource
        case STATES.EVENTSOURCE_STATE_TYPE.CONNECTED: {
          // If we have an item configured
          if (node.item) {
            // Fetch current state of item
            const url = `/rest/items/${node.item}`;
            node.debug(`GET Request ${url}`);
            controller.request
              .get(url, { json: true })
              .then(response => {
                if (node.initialOutput) {
                  // Trigger ItemStateEvent
                  node.onEvent({ item: response.name, type: 'ItemStateEvent', state: response.state });
                } else {
                  // Just update node state
                  updateNodeStatus(node, STATES.NODE_STATE, STATES.NODE_STATE_TYPE.CURRENT_STATE, response.state);
                }
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

    /**
     * Attach event handlers
     */

    // Listen for state changes from controller
    controller.addListener(STATES.EVENTSOURCE_STATE, node.onControllerEvent);
    node.debug(`Attaching event listener '${STATES.EVENTSOURCE_STATE}'`);

    // Listen for subscribed events for selected item
    if (node.item) {
      node.eventTypes.forEach(eventType => {
        controller.addListener(`${node.item}/${eventType}`, node.onEvent);
        node.debug(`Attaching event listener '${node.item}/${eventType}'`);
      });
    }

    // Cleanup event listeners upon node removal
    node.on('close', () => {
      controller.removeListener(STATES.EVENTSOURCE_STATE, node.onControllerEvent);
      node.debug(`Attaching event listener '${STATES.EVENTSOURCE_STATE}'`);

      if (node.item) {
        node.eventTypes.forEach(eventType => {
          controller.removeListener(`${node.item}/${eventType}`, node.onEvent);
          node.debug(`Removing event listener '${node.item}/${eventType}'`);
        });
      }

      node.debug('Closing node');
    });

    /**
     * Node main
     */
  }

  /**
   * Register node
   */

  RED.nodes.registerType('openhab-v2-in', OpenHABNodeIn);
};
