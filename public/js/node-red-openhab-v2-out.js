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
/* global RED,SlimSelect */
/* global getItems */ // From node-red-openhab-v2-utilities.js
/* global OH_TYPED_INPUT */ // From node-red-openhab-v2-typedinput.js

RED.nodes.registerType('openhab-v2-out', {
  category: 'OpenHAB',
  // Styling
  icon: 'node-red-contrib-openhab-v2-color.png',
  color: '#fff',
  align: 'right',
  paletteLabel: 'out',
  label: function() {
    return this.name || this.item || 'out';
  },
  labelStyle: function() {
    return this.name || this.item ? 'node_label_italic' : '';
  },
  // Inputs & outputs
  inputs: 1,
  outputs: 0,
  inputLabels: ['Command'],
  outputLabels: [],
  // Default
  defaults: {
    // Main config
    name: {
      value: undefined,
      required: false
    },
    controller: {
      value: '',
      type: 'openhab-v2-controller',
      required: true
    },
    // Output tab
    item: {
      value: undefined,
      required: true
    },
    topic: {
      value: 'topic',
      required: true
    },
    topicType: {
      value: 'msg', // OH_TYPED_INPUT.COMMAND_TYPE.value,
      required: true
    },
    payload: {
      value: 'payload',
      required: true
    },
    payloadType: {
      value: 'msg', // OH_TYPED_INPUT.PAYLOAD.value,
      required: true
    },
    // Misc tab
    storeState: {
      value: false,
      required: true
    }
  },
  // Dialog events
  oneditprepare: function() {
    /**
     * Initialization
     */
    const node = this;

    /**
     * Methods
     */

    const createTabs = id => {
      const tabs = RED.tabs.create({
        id,
        onchange: function(tab) {
          $(`#${id}-content`)
            .children()
            .hide();
          $('#' + tab.id).show();
        }
      });
      tabs.addTab({
        id: `${id}-output`,
        label: node._('openhab-v2.out.tabs.outputTab', { defaultValue: 'Output' })
      });
      tabs.addTab({
        id: `${id}-misc`,
        label: node._('openhab-v2.out.tabs.miscTab', { defaultValue: 'Misc' })
      });

      setTimeout(function() {
        tabs.resize();
      }, 0);
    };

    const populateItemList = (slimSelector, itemList, selectedItem) => {
      const items = [];

      // Construct itemList array for use with SlimSelect
      for (let i = 0; i < itemList.length; i++) {
        items.push({ text: itemList[i].name, value: itemList[i].name });
      }

      // Sort SlimSelect options alphabetically and case-insensitive
      items.sort((a, b) => {
        a = a.text.toLowerCase();
        b = b.text.toLowerCase();

        if (a < b) return -1;
        else if (a > b) return 1;
        else return 0;
      });

      // Reconfigure the SlimSelect box
      if (items.length > 0) {
        slimSelector.config.placeholderText = node._('openhab-v2.out.labels.placeholderSelectItem', { defaultValue: 'Select item' });
        slimSelector.config.allowDeselect = true;
        slimSelector.config.allowDeselectOption = true;
      } else {
        slimSelector.config.placeholderText = node._('openhab-v2.out.labels.placeholderEmptyList', { defaultValue: 'No items found' });
        slimSelector.config.allowDeselect = false;
        slimSelector.config.allowDeselectOption = false;
      }

      // Add a placeholder element required for a list with de-selectable items
      $(slimSelector.select.element).prepend(
        $('<option>')
          .val(undefined)
          .attr('data-placeholder', true)
      );

      // Load the data into the SlimSelect list
      slimSelector.setData(items);
      slimSelector.set(selectedItem);
    };

    const initializeFormElements = () => {
      // Initialize SlimSelect form elements
      slimSelectElements.init();

      /**
       * 'Output' tab
       */

      $('#node-input-topic').typedInput({
        types: ['msg', 'str', OH_TYPED_INPUT.COMMAND_TYPE],
        value: node.topic,
        type: node.topicType,
        typeField: $('#node-input-topicType')
      });

      $('#node-input-payload').typedInput({
        types: ['msg', 'flow', 'global', 'str', 'num', 'date', OH_TYPED_INPUT.PAYLOAD],
        value: node.payload,
        type: node.payloadType,
        typeField: $('#node-input-payloadType')
      });
    };

    const applyCustomStyling = () => {
      // Enhance typedInput element by aligning all options
      // i.e. here we select all elements without an image or icon label
      $('div.red-ui-typedInput-options a:not(:has(*))').each((_, elem) => {
        $(elem).css('padding-left', '28px');
      });

      // Enhance typedInput element by aligning all options
      // i.e. here we select all elements with either and image or icon label
      $('div.red-ui-typedInput-options a').each((_, elem) => {
        $(elem)
          .find('>img:first-child')
          .css('width', '18px');
        $(elem)
          .find('>i:first-child')
          .css('padding-left', '4px');
      });
    };

    /**
     * Configure SlimSelect form elements
     */

    const slimSelectElements = {
      options: {
        'node-input-item': {
          placeholder: node._('openhab-v2.out.labels.placeholderLoading', { defaultValue: 'Loading...' }),
          searchText: node._('openhab-v2.out.labels.searchNoResults', { defaultValue: 'No results' }),
          searchPlaceholder: node._('openhab-v2.out.labels.searchPlaceholder', { defaultValue: 'Search' }),
          deselectLabel: '<span>&#10006;</span>',
          allowDeselect: false,
          allowDeselectOption: false,
          showOptionTooltips: true
        }
      },
      elements: {},
      get: function(id) {
        return this.elements[id];
      },
      init: function() {
        for (const [id, options] of Object.entries(this.options)) {
          const select = document.querySelector(`select#${id}`);
          if (select) {
            const { selectedElement, ...config } = options;
            const slimSelect = new SlimSelect({ select, ...config });

            // If a selectedElement was passed - select it
            if (selectedElement) {
              slimSelect.set(selectedElement);
            }

            this.elements[id] = slimSelect;
          }
        }
      }
    };

    /**
     * Events
     */

    // onChange handler: When node controller selection changes
    $('#node-input-controller').change(
      ({ target: { value: controller } }) =>
        controller !== '__ADD__' &&
        getItems(controller).then(itemList => {
          const allItems = itemList;
          populateItemList(slimSelectElements.get('node-input-item'), allItems, node.item);
        })
    );

    /**
     * Main
     */

    // Create navigation tabs
    createTabs('node-openhab-v2-out-tabs');

    // Load correct values into form elements where necessary
    initializeFormElements();

    // Apply custom styling
    applyCustomStyling();
  },
  oneditsave: function() {
    /**
     * Initialization
     */
    const node = this;

    // Using SlimSelect and submitting no selected option results in 'null' value instead of undefined
    // This is a workaround to prevent NodeRED from not storing an undefined value
    node.item = $('node-input-item').val() !== null ? $('node-input-item').val() : undefined;
  },
  oneditcancel: function() {},
  oneditdelete: function() {},
  oneditresize: function() {}
});
