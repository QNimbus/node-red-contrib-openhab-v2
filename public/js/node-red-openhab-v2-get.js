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

RED.nodes.registerType('openhab-v2-get', {
  category: 'OpenHAB',
  // Styling
  icon: 'node-red-contrib-openhab-v2-color.png',
  color: '#fff',
  align: 'right',
  paletteLabel: 'get',
  label: function() {
    return this.name || this.item || 'get';
  },
  labelStyle: function() {
    return this.name || this.item ? 'node_label_italic' : '';
  },
  // Inputs & outputs
  inputs: 1,
  outputs: 1,
  inputLabels: ['Get'],
  outputLabels: ['State'],
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
    // Get tab
    items: {
      value: [],
      required: true
    },
    // Misc tab
    ohTimestamp: {
      value: false,
      required: true
    },
    getGroupMembers: {
      value: false,
      required: true
    },
    useInput: {
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
        id: `${id}-get`,
        label: node._('openhab-v2.get.tabs.getTab', { defaultValue: 'Get' })
      });
      tabs.addTab({
        id: `${id}-misc`,
        label: node._('openhab-v2.in.tabs.miscTab', { defaultValue: 'Misc' })
      });

      setTimeout(function() {
        tabs.resize();
      }, 0);
    };

    const populateItemList = (slimSelectItem, itemList, selectedItem) => {
      const items = [];

      // Construct itemList array for use with SlimSelect
      for (let i = 0; i < itemList.length; i++) {
        const text = itemList[i].name;
        const value = text;

        if (itemList[i].type === 'Group') {
          items.push({ text: `<strong>${text}</strong>`, value });
        } else {
          items.push({ text, value });
        }
      }

      // Sort SlimSelect options alphabetically and case-insensitive
      items.sort((a, b) => {
        a = a.value.toLowerCase();
        b = b.value.toLowerCase();

        if (a < b) return -1;
        else if (a > b) return 1;
        else return 0;
      });

      // Reconfigure the SlimSelect box
      if (items.length > 0) {
        slimSelectItem.config.placeholderText = node._('openhab-v2.get.labels.placeholderSelectItem', { defaultValue: 'Select item' });
        slimSelectItem.config.allowDeselect = true;
        slimSelectItem.config.allowDeselectOption = true;
      } else {
        slimSelectItem.config.placeholderText = node._('openhab-v2.get.labels.placeholderEmptyList', { defaultValue: 'No items found' });
        slimSelectItem.config.allowDeselect = false;
        slimSelectItem.config.allowDeselectOption = false;
      }

      // Add a placeholder element required for a list with de-selectable items
      $(slimSelectItem.select.element).prepend(
        $('<option>')
          .val(undefined)
          .attr('data-placeholder', true)
      );

      // Load the data into the SlimSelect list
      slimSelectItem.setData(items);
      slimSelectItem.set(selectedItem);
    };

    const initializeFormElements = () => {
      // Initialize SlimSelect form elements
      slimSelectElements.init();
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
        'node-input-items': {
          placeholder: node._('openhab-v2.get.labels.placeholderLoading', { defaultValue: 'Loading...' }),
          searchText: node._('openhab-v2.get.labels.searchNoResults', { defaultValue: 'No results' }),
          searchPlaceholder: node._('openhab-v2.get.labels.searchPlaceholder', { defaultValue: 'Search' }),
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

          populateItemList(slimSelectElements.get('node-input-items'), allItems, node.items);
        })
    );

    /**
     * Main
     */

    // Create navigation tabs
    createTabs('node-openhab-v2-get-tabs');

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
    node.items = $('#node-input-items').val();
  },
  oneditcancel: function() {},
  oneditdelete: function() {},
  oneditresize: function() {}
});
