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

/* eslint-disable no-unused-vars */
/* eslint-env browser,jquery */

// These are used for the 'TypedInput' fields in the config dialig
// See: https://nodered.org/docs/api/ui/typedInput/

const OH_TYPED_INPUT = {};

function define(name, value) {
  Object.defineProperty(OH_TYPED_INPUT, name, {
    value: value,
    enumerable: true
  });
}

/**
 * Constant names
 */

const COMMAND_TYPE = 'COMMAND_TYPE';
const PAYLOAD = 'PAYLOAD';

/**
 * Exported constants
 */

define(COMMAND_TYPE, Object.freeze({
  value: 'ohCommandType',
  label: 'openHAB',
  icon: 'icons/node-red-contrib-openhab-v2/node-red-contrib-openhab-v2-color.png',
  options: ['ItemCommand', 'ItemUpdate']
}));

define(PAYLOAD, Object.freeze({
  value: 'ohPayload',
  label: 'OpenHAB',
  icon: 'icons/node-red-contrib-openhab-v2/node-red-contrib-openhab-v2-color.png',
  options: [
    'ON',
    'OFF',
    'OPEN',
    'CLOSED',
    'INCREASE',
    'DECREASE',
    'UP',
    'DOWN',
    'STOP',
    'MOVE',
    'PLAY',
    'PAUSE',
    'REWIND',
    'FASTFORWARD',
    'NEXT',
    'PREVIOUS',
    'NULL'
  ]
}));
