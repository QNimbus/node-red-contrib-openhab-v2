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
  const OPERATORS = require('../public/js/node-red-openhab-v2-operators').OPERATORS;
  const getValueAs = require('./includes/utility').getValueAs;
  const updateNodeStatus = require('./includes/utility').updateNodeStatus;

  /**
   * Node definition
   */

  function OpenHABNodeTrigger(config) {
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
    node.item = config.item;
    node.triggerConditions = config.triggerConditions.conditions;
    node.triggerConditionsLogic = config.triggerConditions.logic === 'AND' ? 'AND' : 'OR';
    node.additionalConditions = config.additionalConditions.conditions;
    node.additionalConditionsLogic = config.additionalConditions.logic === 'AND' ? 'AND' : 'OR';
    node.additionalConditionsFrequency = config.additionalConditionsFrequency;
    node.timerResetEveryTrigger = config.timerResetEveryTrigger === 'yes';
    node.eventTypes = ['ItemStateChangedEvent', 'GroupItemStateChangedEvent'];
    node.armedItem = config.triggerState === 'item' ? config.triggerStateItem : undefined;
    node.get = node.context().get.bind(node);
    node.set = node.context().set.bind(node);
    node.flow = node.context().flow;
    node.global = node.context().global;

    // setState and getState methods for storing state values in node, flow and/or global context
    node.getState = () => node.get('itemState');
    node.setState = state => {
      const context = node.context()[config.storeStateVariableType];

      node.set('itemState', state);
      if (config.storeState && config.storeStateVariable && context) {
        context.set(config.storeStateVariable, state);
      }
    };

    // Pre-cast condition values
    node.triggerConditions.forEach(condition => {
      condition.compare = OPERATORS[condition.comparator] ? OPERATORS[condition.comparator].method : _ => false;
    });

    // Pre-cast additional condition values
    node.additionalConditions.forEach(condition => {
      condition.compare = OPERATORS[condition.comparator] ? OPERATORS[condition.comparator].method : _ => false;
    });

    // triggerLogicMethod is bound to Array.prototype.every or Array.prototype.some depending on configuration
    node.triggerLogicMethod =
      node.triggerConditionsLogic === 'AND' ? Array.prototype.every.bind(node.triggerConditions) : Array.prototype.some.bind(node.triggerConditions);
    node.additionalConditionsLogicMethod =
      node.additionalConditionsLogic === 'AND' ? Array.prototype.every.bind(node.additionalConditions) : Array.prototype.some.bind(node.additionalConditions);

    // Node constants
    node.timeZoneOffset = Object.freeze(new Date().getTimezoneOffset() * 60000);

    // getCurrentTimestamp
    node.getCurrentTimestamp = config.ohTimestamp ? () => new Date(Date.now() - node.timeZoneOffset).toISOString().slice(0, -1) : Date.now;

    // getTimerValue
    node.getTimerValue = () => {
      if (config.advancedTimerToggle) {
        return getValueAs(node, config.advancedTimerType, config.advancedTimer);
      } else {
        switch (config.timerUnits) {
          case 'milliseconds': {
            return config.timer;
          }
          case 'minutes': {
            return config.timer * (60 * 1000);
          }
          case 'hours': {
            return config.timer * (60 * 60 * 1000);
          }
          default: {
            return config.timer * 1000;
          }
        }
      }
    };

    // Node context variables
    node.set('triggered', false);

    /**
     * Node methods
     */

    node.getTopic = (topic, topicType, message) => {
      switch (topicType) {
        case 'msg': {
          return message[topic];
        }
        case 'str':
        case 'ohCommandType':
        default: {
          return topic;
        }
      }
    };

    node.getPayload = (payload, payloadType, message) => {
      switch (payloadType) {
        case 'msg': {
          return message[payload];
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
          return RED.util.evaluateNodeProperty(payload, payloadType, this, message);
        }
      }
    };

    node.triggerConditionsPassed = state => {
      return node.triggerLogicMethod(({ compare, value, type }) => {
        value = getValueAs(node, type, value);

        if (compare instanceof Function) {
          // Return condition comparison
          return compare(state, value);
        } else {
          // Return false by default
          return false;
        }
      });
    };

    node.additionalConditionsPassed = _ => {
      // Quick return if there are no additional conditions
      if (node.additionalConditions.length === 0) return true;

      // If we only have the check on the first trigger return true if it's not the first trigger
      if (node.additionalConditionsFrequency === 'once' && node.get('triggered')) return true;

      return node.additionalConditionsLogicMethod(({ compare, variableValue, variableType, value, type }) => {
        value = getValueAs(node, type, value);
        variableValue = getValueAs(node, variableType, variableValue);

        if (compare instanceof Function) {
          // Return condition comparison
          return compare(variableValue, value);
        } else {
          // Return false by default
          return false;
        }
      });
    };

    node.armTrigger = ({ state, payload, payload: { state: payloadState } = {} }) => {
      const armed = !['OFF', 'CLOSED', '0', 'NULL', 'UNDEF', false].includes(state || payload || payloadState || false);
      const changed = armed !== node.get('armed');

      // If armed state has not changed, return immediately
      if (!changed) {
        return;
      }

      if (!armed) {
        // Reset trigger state
        node.set('triggered', false);

        // Remove trigger variable
        node.set('lastTrigger');

        // Cancel active timer if configured to do so
        config.cancelTimerWhenDisarmed && node.removeTimer();
      }
      node.set('armed', armed);

      // Update node status to reflect state
      armed ? node.status({ fill: 'blue', shape: 'ring', text: 'armed' }) : node.status({ fill: 'grey', shape: 'ring', text: 'disarmed' });
    };

    node.startTimer = (cb, timeout) => {
      if (timeout > 0) {
        clearTimeout(node.timerObject);
        delete node.timerObject;
        node.timerObject = setTimeout(cb, timeout);
      } else {
        setImmediate(cb);
      }
    };

    node.removeTimer = () => {
      clearTimeout(node.timerObject);
      delete node.timerObject;
    };

    /**
     * Node event handlers
     */

    node.onControllerEvent = (event, message) => {
      switch (event) {
        // If the controller just connected to the EventSource
        case STATES.EVENTSOURCE_STATE_TYPE.CONNECTED: {
          // If we have an item configured to arm/disarm the trigger
          if (node.armedItem) {
            // Fetch current state of item
            controller
              .getItem(node.armedItem)
              .then(({ state }) => {
                node.armTrigger({ state });
              })
              .catch(error => {
                // Log error message
                node.warn(error.message);

                // Change node state
                updateNodeStatus(node, STATES.NODE_STATE, STATES.NODE_STATE_TYPE.ERROR, error.message);
              });
          } else {
            node.armTrigger({ state: config.triggerState === 'armed' });
          }
          break;
        }
        // Ignore other events
        default: {
          break;
        }
      }
    };

    node.onEvent = event => {
      let hasTriggered = false;
      const { state, payload, ...message } = event;
      const triggerInitialState = node.get('triggered');

      // Only process event if the trigger is armed
      if (node.get('armed')) {
        const triggerAction = () => {
          // Test if event state satisfies the configured trigger conditions
          hasTriggered = node.triggerConditionsPassed(state) && node.additionalConditionsPassed();

          // If trigger conditions are met and trigger has not yet been triggered
          if (hasTriggered && !node.timerObject && hasTriggered !== triggerInitialState) {
            const timestamp = node.getCurrentTimestamp();
            const msgTopic = node.getTopic(config.topic, config.topicType, event);
            const msgPayload = node.getPayload(config.payload, config.payloadType, event);
            const trigger = { state, timestamp, ...message };
            const msg = { topic: msgTopic, payload: msgPayload, trigger };

            // Send message
            // See: https://nodered.org/blog/2019/09/13/cloning-messages#cloning-by-default
            node.send([msg], false);

            // Save current trigger
            node.set('lastTrigger', trigger);
          }

          // Set trigger state
          node.set('triggered', hasTriggered);

          // Update node status to reflect state
          hasTriggered && node.status({ fill: 'blue', shape: 'dot', text: 'triggered' });
        };

        const afterTriggerAction = {
          finally: () => {
            if (config.armDisarm !== 'do_not_change') {
              node.armTrigger({ state: config.armDisarm === 'arm' });
            }

            // Reset trigger state
            node.set('triggered', false);

            // Update node status to reflect state
            node.get('armed') ? node.status({ fill: 'blue', shape: 'ring', text: 'armed' }) : node.status({ fill: 'grey', shape: 'ring', text: 'disarmed' });
          },
          sendMessage: () => {
            const topic = node.getTopic(config.topicEnd, config.topicEndType, {});
            const payload = node.getPayload(config.payloadEnd, config.payloadEndType, {});
            const trigger = node.get('lastTrigger');
            const msg = { topic, payload, trigger };

            // Send message
            // See: https://nodered.org/blog/2019/09/13/cloning-messages#cloning-by-default
            node.send([msg], false);
          },
          nothing: () => {
            // Perform final actions
            if (hasTriggered) {
              afterTriggerAction.finally();
            }
          },
          timer: () => {
            const timerFunction = function() {
              // Clear timer object
              node.removeTimer();

              if (node.get('triggered') && node.get('armed') && node.timerResetEveryTrigger) {
                node.startTimer(timerFunction, node.getTimerValue());
              } else {
                afterTriggerAction.sendMessage();

                // Perform final actions
                afterTriggerAction.finally();
              }
            };

            // Perform action with delay
            if (hasTriggered) {
              if (!node.timerObject || node.timerResetEveryTrigger) {
                node.startTimer(timerFunction, node.getTimerValue());
              }
            }
          },
          untrigger: () => {
            if (triggerInitialState && !hasTriggered) {
              afterTriggerAction.sendMessage();

              // Perform final actions
              afterTriggerAction.finally();
            }
          },
          nodelay: () => {
            // Perform action without delay
            if (hasTriggered) {
              node.startTimer(() => afterTriggerAction.sendMessage(), 0);

              // Perform final actions
              afterTriggerAction.finally();
            }
          }
        };

        // Excute trigger action
        triggerAction();

        // Execute appropriate afterTrigger action
        afterTriggerAction[config.afterTrigger]();
      }

      node.setState(state);
    };

    // Listen for incomming messages to arm/disarm trigger
    config.inputArmDisarm &&
      node.on('input', message => {
        node.armTrigger(message);
      });

    /**
     * Attach event handlers
     */

    // Listen for state changes from controller
    controller.on(STATES.EVENTSOURCE_STATE, node.onControllerEvent);
    node.debug(`Attaching 'controller' event listener '${STATES.EVENTSOURCE_STATE}'`);

    // List for changes to the trigger armed item, if configured
    if (node.armedItem) {
      node.eventTypes.forEach(eventType => {
        controller.on(`${node.armedItem}/${eventType}`, node.armTrigger);
        node.debug(`Attaching 'node' event listener '${node.armedItem}/${eventType}'`);
      });
    }

    // Listen for subscribed events for selected item
    if (node.item) {
      node.eventTypes.forEach(eventType => {
        controller.on(`${node.item}/${eventType}`, node.onEvent);
        node.debug(`Attaching 'node' event listener '${node.item}/${eventType}'`);
      });
    }

    // Cleanup event listeners upon node removal
    node.on('close', done => {
      controller.removeListener(STATES.EVENTSOURCE_STATE, node.onControllerEvent);
      node.debug(`Removing 'controller' event listener '${STATES.EVENTSOURCE_STATE}'`);

      if (node.armedItem) {
        node.eventTypes.forEach(eventType => {
          controller.removeListener(`${node.armedItem}/${eventType}`, node.armTrigger);
          node.debug(`Removing 'node' event listener '${node.armedItem}/${eventType}'`);
        });
      }

      if (node.item) {
        node.eventTypes.forEach(eventType => {
          controller.removeListener(`${node.item}/${eventType}`, node.onEvent);
          node.debug(`Removing 'node' event listener '${node.item}/${eventType}'`);
        });
      }

      // Remove an existing timer
      node.removeTimer();

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

  RED.nodes.registerType('openhab-v2-trigger', OpenHABNodeTrigger);
};
