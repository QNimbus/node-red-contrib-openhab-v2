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

/* eslint-env browser,jquery */
/* global RED */

RED.nodes.registerType('openhab-v2-in', {
  category: 'OpenHAB',
  // Styling
  icon: 'node-red-contrib-openhab-v2-color.png',
  color: '#fff',
  align: 'left',
  paletteLabel: 'in',
  label: function() {
    return this.name || this.item || 'in';
  },
  labelStyle: function() {
    return this.name || this.item ? 'node_label_italic' : '';
  },
  // Inputs & outputs
  inputs: 0,
  outputs: 1,
  inputLabels: [],
  outputLabels: ['StateEvent'],
  // Default
  defaults: {
    name: {
      value: ''
    },
    controller: {
      value: '',
      type: 'openhab-v2-controller',
      required: true
    },
    item: {
      value: '',
      required: false
    },
    ohCompatibleTimestamp: {
      value: false
    },
    eventTypes: {
      value: [],
      required: true
    },
    outputAtStartup: {
      value: true,
      required: true
    },
    storeStateInFlow: {
      value: false,
      required: true
    }
  },
  // Dialog events
  oneditprepare: function() {
    const node = this;

    // getItemList(node.item, $('#node-input-controller'), '#node-input-item', true);
    // getEventTypeList(node);

    // // Enable/Disable OpenHAB compatible timestamp
    // $('#node-input-ohCompatibleTimestamp').change(() => {
    //   if ($('#node-input-ohCompatibleTimestamp').is(':checked')) {
    //     node.ohCompatibleTimestamp = true;
    //   } else {
    //     node.ohCompatibleTimestamp = false;
    //   }
    // });
  },
  oneditsave: function() {
    const node = this;

    // workaroundForEmptyItemsList(node, '#node-input-eventTypes');
  },
  oneditcancel: function() {},
  oneditdelete: function() {},
  oneditresize: function() {}
});
