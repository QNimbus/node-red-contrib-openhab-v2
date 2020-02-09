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

function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}

/**
 * Constant names
 */

const NODE_STATE = 'NODE_STATE';
const NODE_STATE_TYPE = 'NODE_STATE_TYPE';
const EVENTSOURCE_STATE = 'EVENTSOURCE_STATE';
const EVENTSOURCE_STATE_TYPE = 'EVENTSOURCE_STATE_TYPE';

/**
 * Exported constants
 */

define(NODE_STATE, 'NODE_STATE');
define(NODE_STATE_TYPE, Object.freeze({ CURRENT_STATE: 1, ERROR: 99 }));
define(EVENTSOURCE_STATE, 'EVENTSOURCE_STATE');
define(EVENTSOURCE_STATE_TYPE, Object.freeze({ CONNECTING: 0, CONNECTED: 1, DISCONNECTED: 2, ERROR: 3 }));
