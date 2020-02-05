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

/* global RED */

RED.nodes.registerType('openhab-v2-controller', {
  category: 'config',
  defaults: {
    name: {
      value: '',
      required: true
    },
    protocol: {
      value: 'http',
      required: true
    },
    allowInsecure: {
      value: false,
      required: true
    },
    host: {
      value: 'localhost',
      required: true
    },
    port: {
      value: 8080,
      validate: RED.validators.number(),
      required: true
    },
    username: {
      value: '',
      required: false
    },
    password: {
      value: '',
      required: false
    }
  },
  paletteLabel: 'openhab-v2-controller',
  label: function() {
    return this.name;
  },
  labelStyle: function() {
    return this.name ? 'node_label_italic' : '';
  }
});
