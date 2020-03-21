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

// These are used for the operators used for the node-red-openhab-v2-trigger node

(function() {
  'use strict';

  this.OPERATORS = (function() {
    return Object.freeze({
      eq: { label: '===', types: ['str', 'num', 'ohPayload'], method: (a, b) => a === b },
      neq: { label: '!==', types: ['str', 'num', 'ohPayload'], method: (a, b) => a !== b },
      lt: { label: '<', types: ['num'], method: (a, b) => a < b },
      lte: { label: '<=', types: ['num'], method: (a, b) => a <= b },
      gt: { label: '>', types: ['num'], method: (a, b) => a > b },
      gte: { label: '>=', types: ['num'], method: (a, b) => a >= b }
    });
  })();
}.call(this));
