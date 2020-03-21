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
/* global OPERATORS */ // From node-red-openhab-v2-operators.js

RED.nodes.registerType('openhab-v2-trigger', {
  category: 'OpenHAB',
  // Styling
  icon: 'node-red-contrib-openhab-v2-color.png',
  color: '#fff',
  align: 'left',
  paletteLabel: 'trigger',
  label: function() {
    return this.name || this.item || 'trigger';
  },
  labelStyle: function() {
    return this.name || this.item ? 'node_label_italic' : '';
  },
  // Inputs & outputs
  inputs: 0,
  outputs: 1,
  inputLabels: [],
  outputLabels: ['Trigger'],
  // Default
  defaults: {
    name: {
      value: undefined,
      required: false
    },
    controller: {
      value: '',
      type: 'openhab-v2-controller',
      required: true
    },
    item: {
      value: undefined,
      required: true
    },
    ohTimestamp: {
      value: false,
      required: true
    },
    triggerState: {
      value: 'armed',
      required: true
    },
    triggerConditions: {
      value: { logic: 'OR', conditions: [] },
      required: true
    }
  },
  // Dialog events
  oneditprepare: function() {
    /**
     * Initialization
     */
    const node = this;
    const controller = $('#node-input-controller').val();

    /**
     * Methods
     */

    const createTabs = () => {
      const tabs = RED.tabs.create({
        id: 'node-openhab-v2-trigger-tabs',
        onchange: function(tab) {
          $('#node-openhab-v2-trigger-tabs-content')
            .children()
            .hide();
          $('#' + tab.id).show();
        }
      });
      tabs.addTab({
        id: 'node-openhab-v2-trigger-tab-trigger',
        label: this._('Trigger')
      });
      tabs.addTab({
        id: 'node-openhab-v2-trigger-tab-condition',
        label: this._('Conditions')
      });
      tabs.addTab({
        id: 'node-openhab-v2-trigger-tab-action',
        label: this._('Action')
      });
      tabs.addTab({
        id: 'node-openhab-v2-trigger-tab-finally',
        label: this._('Finally')
      });

      setTimeout(function() {
        tabs.resize();
      }, 0);
    };

    const createTriggerConditionsList = id => {
      // Helper method
      const setComparatorOptions = (select, type, comparator = undefined) => {
        // Get currently selected value if any
        comparator = comparator || select.val();

        // Clear out existing options
        select.empty();

        // Build new option elements and append to select element
        for (const [name, operator] of Object.entries(OPERATORS)) {
          if (operator.types.includes(type)) {
            select.append(
              $('<option>')
                .val(name)
                .text(operator.label)
                .prop('selected', name === comparator)
            );
          }
        }
      };

      // div - form-row (triggerConditionsListRow)
      const triggerConditionsListRow = $('<div>')
        .addClass('form-row')
        .prependTo($('#node-openhab-v2-trigger-tab-condition'));

      // ol - editableList 'triggerConditionsList'
      return $('<ol>')
        .attr({ id })
        .appendTo(triggerConditionsListRow)
        .editableList({
          removable: true,
          addButton: true,
          height: 'auto',
          // editableList header element
          header: $('<div>')
            .attr({ style: 'display: flex; justify-content: flex-start; padding: 5px; background-color: rgba(192, 192, 192, 0.1)' })
            .append(
              $.parseHTML("<div style='width:75px; margin-right: 10px'>Logic</div><div style='width:65px; margin-right: 10px'>Test</div><div>Value</div>")
            ),
          // editableList addItem method
          addItem: function(elem, rowIndex, { comparator = 'eq', type = 'num', value = '' }) {
            // Make row flexbox
            elem.attr({ style: 'display: flex' });

            // First column
            if (rowIndex === 0) {
              // First row
              $('<div>')
                .attr({ style: 'display: flex; flex: 0 0 75px; justify-content: center; align-items: center; margin-right: 10px;' })
                .append(
                  $('<select>')
                    .attr({ id: 'node-input-conditionsLogic', style: 'width: unset' })
                    .append(
                      $('<option>')
                        .attr({ value: 'OR', selected: node.triggerConditions.logic === 'OR' ? 'selected' : undefined })
                        .text('OR')
                    )
                    .append(
                      $('<option>')
                        .attr({ value: 'AND', selected: node.triggerConditions.logic === 'AND' ? 'selected' : undefined })
                        .text('AND')
                    )
                    .on('change', ({ target: { value } }) => {
                      $('div.test-case').html(`<strong>${value}</strong>`);
                    })
                )
                .appendTo(elem);
            } else {
              // Rest of the rows
              $('<div>')
                .appendTo(elem)
                .addClass('test-case')
                .html(`<strong>${$('#node-input-conditionsLogic').val()}</strong>`)
                .attr({ style: 'display: flex; flex: 0 0 75px; justify-content: center; align-items: center; margin-right: 10px;' });
            }

            // Second column
            setComparatorOptions(
              $('<select>')
                .appendTo(elem)
                .attr({ id: `node-input-comparator-${rowIndex}`, style: 'flex: 0 0 65px; text-align: center; margin-right: 10px' }),
              type,
              comparator
            );

            // Third column
            $('<input>', { id: `node-input-conditionType-${rowIndex}`, type: 'hidden' }).appendTo(elem);
            $('<input>', { id: `node-input-conditionValue-${rowIndex}` })
              .appendTo(elem)
              .typedInput({
                default: 'num',
                value,
                types: ['global', 'flow', 'str', 'num', OH_TYPED_INPUT.PAYLOAD],
                typeField: `#node-input-conditionType-${rowIndex}`
              })
              .typedInput('value', value)
              .typedInput('type', type)
              .on('change', function(event, type) {
                setComparatorOptions($(this).siblings('select'), type);
              });

            // Make typeInput elements grow to 100% width (3rd column)
            elem.children('div.red-ui-typedInput-container').attr({ style: 'flex: 1 1 auto' });
          }
        });
    };

    const populateItemList = (slimSelectItem, itemList, selectedItem) => {
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
        slimSelectItem.config.placeholderText = node._('openhab-v2.out.labels.placeholderSelectItem', { defaultValue: 'Select item' });
        slimSelectItem.config.allowDeselect = true;
        slimSelectItem.config.allowDeselectOption = true;
      } else {
        slimSelectItem.config.placeholderText = node._('openhab-v2.out.labels.placeholderEmptyList', { defaultValue: 'No items found' });
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

    const populateTriggerConditionsList = (list, conditions) => {
      list.editableList('addItems', conditions);
    };

    /**
     * Configure input elements
     */

    /* eslint-disable no-unused-vars */

    // *** Controller ***

    const slimSelectController = new SlimSelect({
      select: '#node-input-controller',
      showSearch: false,
      hideSelectedOption: true,
      // TODO: Ensure that 'Loading' placeholder gets displayed during loading
      onChange: event => getItems(event.value).then(itemList => populateItemList(slimSelectItem, itemList, node.item))
    });

    // *** Item ***

    const slimSelectItem = new SlimSelect({
      select: '#node-input-item',
      placeholder: node._('openhab-v2.trigger.labels.placeholderLoading', { defaultValue: 'Loading...' }),
      searchText: node._('openhab-v2.trigger.labels.searchNoResults', { defaultValue: 'No results' }),
      searchPlaceholder: node._('openhab-v2.trigger.labels.searchPlaceholder', { defaultValue: 'Search' }),
      deselectLabel: '<span>&#10006;</span>',
      allowDeselect: false,
      allowDeselectOption: false,
      showOptionTooltips: true
    });

    // *** Trigger armed/disarmed ***

    const slimSelectTriggerState = new SlimSelect({
      select: '#node-input-triggerState',
      showSearch: false,
      onChange: event => {
        if (event.value === 'item') {
          $('#node-openhab-v2-trigger-tab-trigger-armed-item').show();
        } else {
          $('#node-openhab-v2-trigger-tab-trigger-armed-item').hide();
        }
      }
    });

    /* eslint-enable no-unused-vars */

    /**
     * Main
     */

    // Populate openHAB items list
    getItems(controller).then(itemList => populateItemList(slimSelectItem, itemList, node.item));

    // Create navigation tabs
    createTabs();

    // Create and populate trigger conditions
    const triggerConditionsList = createTriggerConditionsList('node-input-trigger-conditions');
    populateTriggerConditionsList(triggerConditionsList, node.triggerConditions.conditions);
  },
  oneditsave: function() {
    /**
     * Initialization
     */
    const node = this;

    // Save triggerConditions
    const logic = $('#node-input-conditionsLogic').val() ? $('#node-input-conditionsLogic').val() : this._def.defaults.triggerConditions.value.logic;
    node.triggerConditions = { logic, conditions: [] };
    $('#node-input-trigger-conditions')
      .editableList('items')
      .each((index, elem) => {
        const comparator = elem.children(`#node-input-comparator-${index}`).val();
        const type = elem.children(`#node-input-conditionType-${index}`).val();
        const value = elem.children(`#node-input-conditionValue-${index}`).val();

        node.triggerConditions.conditions.push({ comparator, type, value });
      });

    // Using SlimSelect and submitting no selected option results in 'null' value instead of undefined
    // This is a workaround to prevent NodeRED from not storing an undefined value
    node.item = $('node-input-item').val() !== null ? $('node-input-item').val() : undefined;
  },
  oneditcancel: function() {},
  oneditdelete: function() {},
  oneditresize: function() {}
});
