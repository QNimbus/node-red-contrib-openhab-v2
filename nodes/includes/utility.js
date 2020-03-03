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

/**
 * Local imports
 */

const STATES = require('./states');

module.exports = {
  updateNodeStatus: (node, newState, newStateType, newStateTypeText) => {
    // TODO Have node context retain it's current state message
    const currentStateType = undefined; // node.context().get('currentStateType');

    if (newState === STATES.EVENTSOURCE_STATE) {
      switch (newStateType) {
        case STATES.EVENTSOURCE_STATE_TYPE.CONNECTED: {
          node.status({ fill: 'green', shape: 'dot', text: newStateTypeText !== undefined ? newStateTypeText : 'connected' });
          break;
        }
        case STATES.EVENTSOURCE_STATE_TYPE.CONNECTING: {
          node.status({ fill: 'green', shape: 'ring', text: newStateTypeText !== undefined ? newStateTypeText : 'connecting' });
          break;
        }
        case STATES.EVENTSOURCE_STATE_TYPE.DISCONNECTED: {
          node.status({ fill: 'grey', shape: 'dot', text: newStateTypeText !== undefined ? newStateTypeText : 'disconnected' });
          break;
        }
        case STATES.EVENTSOURCE_STATE_TYPE.ERROR: {
          node.status({ fill: 'red', shape: 'dot', text: newStateTypeText !== undefined ? newStateTypeText : 'error' });
          break;
        }
        default: {
          node.status({ fill: 'grey', shape: 'dot', text: newStateTypeText !== undefined ? newStateTypeText : currentStateText });
          break;
        }
      }
    } else if (newState === STATES.NODE_STATE) {
      switch (newStateType) {
        case STATES.NODE_STATE_TYPE.ERROR: {
          node.status({ fill: 'red', shape: 'dot', text: newStateTypeText !== undefined ? newStateTypeText : 'error' });
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
  }
};
