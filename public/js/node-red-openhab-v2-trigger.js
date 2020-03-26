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
  inputs: this.inputArmDisarm ? 1 : 0,
  outputs: 1,
  inputLabels: ['Input'],
  outputLabels: ['Trigger'],
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
    // Trigger tab
    item: {
      value: undefined,
      required: true
    },
    inputArmDisarm: {
      value: false,
      required: true
    },
    triggerState: {
      value: 'armed',
      required: true
    },
    triggerStateItem: {
      value: undefined,
      required: false
    },
    // Conditions tab
    triggerConditions: {
      value: { logic: 'OR', conditions: [] },
      required: true
    },
    additionalConditions: {
      value: { logic: 'AND', conditions: [] },
      required: true
    },
    additionalConditionsFrequency: {
      value: 'first',
      required: true
    },
    // Action tab
    topic: {
      value: undefined,
      required: true
    },
    topicType: {
      value: OH_TYPED_INPUT.COMMAND_TYPE.value,
      required: true
    },
    payload: {
      value: undefined,
      required: true
    },
    payloadType: {
      value: OH_TYPED_INPUT.PAYLOAD.value,
      required: true
    },
    timer: {
      value: 10,
      validate: val => RED.validators.number(val) && val >= 0
    },
    timerUnits: {
      value: 'seconds',
      required: true
    },
    advancedTimerToggle: {
      value: false,
      required: true
    },
    advancedTimer: {
      value: undefined,
      required: false
    },
    advancedTimerType: {
      value: 'global',
      required: true
    },
    afterTrigger: {
      value: 'nothing',
      required: true
    },
    cancelTimerWhenDisarmed: {
      value: false,
      required: true
    },
    timerExpiresAction: {
      value: 'if_false_continue',
      required: true
    },
    topicEnd: {
      value: undefined,
      required: true
    },
    topicEndType: {
      value: OH_TYPED_INPUT.COMMAND_TYPE.value,
      required: true
    },
    payloadEnd: {
      value: undefined,
      required: true
    },
    payloadEndType: {
      value: OH_TYPED_INPUT.PAYLOAD.value,
      required: true
    },
    // Finally tab
    armDisarm: {
      value: 'do_not_change',
      required: true
    },
    // Misc tab
    ohTimestamp: {
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
        id: `${id}-trigger`,
        label: node._('openhab-v2.trigger.tabs.triggerTab', { defaultValue: 'Trigger' })
      });
      tabs.addTab({
        id: `${id}-condition`,
        label: node._('openhab-v2.trigger.tabs.condtionTab', { defaultValue: 'Condition' })
      });
      tabs.addTab({
        id: `${id}-action`,
        label: node._('openhab-v2.trigger.tabs.actionTab', { defaultValue: 'Action' })
      });
      tabs.addTab({
        id: `${id}-finally`,
        label: node._('openhab-v2.trigger.tabs.finallyTab', { defaultValue: 'Finally' })
      });
      tabs.addTab({
        id: `${id}-misc`,
        label: node._('openhab-v2.trigger.tabs.miscTab', { defaultValue: 'Misc' })
      });

      setTimeout(function() {
        tabs.resize();
      }, 0);
    };

    const createTriggerConditionsList = (id, element) => {
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

      const triggerConditionsList = $('<ol>')
        .attr({ id })
        .appendTo(element)
        .editableList({
          removable: true,
          addButton: true,
          height: 'auto',
          // editableList header element
          // Creates a 4-column row (4th column is used as padding to compensate for 'X' button in the rows below)
          header: $('<div>')
            .attr({ style: 'display: flex; justify-content: flex-start; padding: 5px; background-color: rgba(192, 192, 192, 0.1)' })
            .append(
              $.parseHTML(
                "<div style='flex: 0 0 75px; margin-right: 10px'>Logic</div><div style='flex: 0 0 65px; margin-right: 10px'>Test</div><div style='flex: 1; margin-right: 10px'>Value</div><div style='flex: 0 0 28px'></div>"
              )
            ),
          // editableList addItem method
          // Creates a 3-column row with flexbox styling and a right margin
          addItem: function(elem, rowIndex, { comparator = 'eq', type = 'num', value = '' }) {
            // Make row flexbox
            elem.attr({ style: 'display: flex' });

            // First column
            if (rowIndex === 0) {
              // First row
              $('<div>')
                .appendTo(elem)
                .attr({ style: 'display: flex; flex: 0 0 75px; justify-content: center; align-items: center; margin-right: 10px;' });
            } else {
              // Rest of the rows
              $('<div>')
                .appendTo(elem)
                .html(`<span class="conditionsLogic">${$('#node-input-conditionsLogic').val()}</span>`)
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
            elem.children('div.red-ui-typedInput-container').attr({ style: 'flex: 1; margin-right: 10px' });
          }
        });

      return triggerConditionsList;
    };

    const createAdditionalConditionsList = (id, element) => {
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

      const triggerConditionsList = $('<ol>')
        .attr({ id })
        .appendTo(element)
        .editableList({
          removable: true,
          addButton: true,
          height: 'auto',
          // editableList header element
          // Creates a 4-column row (4th column is used as padding to compensate for 'X' button in the rows below)
          header: $('<div>')
            .attr({ style: 'display: flex; padding: 5px; background-color: rgba(192, 192, 192, 0.1)' })
            .append(
              $.parseHTML(
                "<div style='flex: 1; margin-right: 10px'>Variable</div><div style='flex: 0 0 100px; margin-right: 10px'>Test</div><div style='flex: 1; margin-right: 10px'>Value</div><div style='flex: 0 0 28px'></div>"
              )
            ),
          // editableList addItem method
          // Creates a 3-column row with flexbox styling and a right margin
          addItem: function(elem, rowIndex, { comparator = 'eq', variableType = 'global', variableValue = '', type = 'str', value = '' }) {
            // Make row flexbox
            elem.attr({ style: 'display: flex' });

            // First column
            $('<input>', { id: `node-input-additionalConditionVariableType-${rowIndex}`, type: 'hidden' }).appendTo(elem);
            $('<input>', { id: `node-input-additionalConditionVariableValue-${rowIndex}` })
              .appendTo(elem)
              .typedInput({
                default: 'global',
                value: variableValue,
                types: ['global', 'flow'],
                typeField: `#node-input-additionalConditionVariableType-${rowIndex}`
              })
              .typedInput('value', variableValue)
              .typedInput('type', variableType);

            // Second column
            setComparatorOptions(
              $('<select>')
                .appendTo(elem)
                .attr({ id: `additionalConditioncomparator-${rowIndex}`, style: 'flex: 0 0 100px; text-align: center; margin-right: 10px' }),
              type,
              comparator
            );

            // Third column
            $('<input>', { id: `node-input-additionalConditionType-${rowIndex}`, type: 'hidden' }).appendTo(elem);
            $('<input>', { id: `node-input-additionalConditionValue-${rowIndex}` })
              .appendTo(elem)
              .typedInput({
                default: 'num',
                value,
                types: ['global', 'flow', 'str', 'num', OH_TYPED_INPUT.PAYLOAD],
                typeField: `#node-input-additionalConditionType-${rowIndex}`
              })
              .typedInput('value', value)
              .typedInput('type', type)
              .on('change', function(event, type) {
                setComparatorOptions($(this).siblings('select'), type);
              });

            // Make typeInput elements grow to 100% width (1st and 3rd column)
            elem.children('div.red-ui-typedInput-container').attr({ style: 'flex: 1; margin-right: 10px' });
          }
        });

      return triggerConditionsList;
    };

    const populateItemList = (slimSelectItem, itemList, selectedItem) => {
      if (slimSelectItem) {
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
      }
    };

    const populateTriggerConditionsList = (list, conditions) => {
      list.editableList('addItems', conditions);
    };

    const populateAdditionalConditionsList = (list, conditions) => {
      list.editableList('addItems', conditions);
    };

    const initializeFormElements = () => {
      // Initialize SlimSelect form elements
      slimSelectElements.init();

      /**
       * 'Trigger' tab
       */

      /**
       * 'Conditions' tab
       */

      // Create and populate trigger conditions
      const triggerConditionsList = createTriggerConditionsList('node-input-triggerConditions', $('div.form-row > div#trigger-conditions-list'));
      populateTriggerConditionsList(triggerConditionsList, node.triggerConditions.conditions);

      // Create and populate additional trigger conditions
      const additionalConditionsList = createAdditionalConditionsList('node-input-additionalConditions', $('div.form-row > div#additional-conditions-list'));
      populateAdditionalConditionsList(additionalConditionsList, node.additionalConditions.conditions);

      /**
       * 'Action' tab
       */

      $('#node-input-topic').typedInput({
        types: ['str', OH_TYPED_INPUT.NOTHING_TYPE, OH_TYPED_INPUT.COMMAND_TYPE],
        value: node.topic,
        type: node.topicType,
        typeField: $('#node-input-topicType')
      });

      $('#node-input-payload').typedInput({
        types: ['flow', 'global', 'str', 'num', 'date', OH_TYPED_INPUT.PAYLOAD],
        value: node.payload,
        type: node.payloadType,
        typeField: $('#node-input-payloadType')
      });

      $('#node-input-advancedTimer').typedInput({
        types: ['flow', 'global'],
        value: node.advancedTimer,
        type: node.advancedTimerType,
        typeField: $('#node-input-advancedTimerType')
      });

      $('#node-input-topicEnd').typedInput({
        types: ['str', OH_TYPED_INPUT.NOTHING_TYPE, OH_TYPED_INPUT.COMMAND_TYPE],
        value: node.topicEnd,
        type: node.topicEndType,
        typeField: $('#node-input-topicEndType')
      });

      $('#node-input-payloadEnd').typedInput({
        types: ['flow', 'global', 'str', 'num', 'date', OH_TYPED_INPUT.PAYLOAD],
        value: node.payloadEnd,
        type: node.payloadEndType,
        typeField: $('#node-input-payloadEndType')
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
          placeholder: node._('openhab-v2.trigger.labels.placeholderLoading', { defaultValue: 'Loading...' }),
          searchText: node._('openhab-v2.trigger.labels.searchNoResults', { defaultValue: 'No results' }),
          searchPlaceholder: node._('openhab-v2.trigger.labels.searchPlaceholder', { defaultValue: 'Search' }),
          deselectLabel: '<span>&#10006;</span>',
          allowDeselect: false,
          allowDeselectOption: false,
          showOptionTooltips: true
        },
        'node-input-triggerState': {
          showSearch: false,
          selectedElement: node.triggerState,
          data: [
            { text: node._('openhab-v2.trigger.select.triggerState.armed', { defaultValue: 'Trigger starts armed' }), value: 'armed' },
            { text: node._('openhab-v2.trigger.select.triggerState.disarmed', { defaultValue: 'Trigger starts disarmed' }), value: 'disarmed' },
            { text: node._('openhab-v2.trigger.select.triggerState.item', { defaultValue: 'Use arm/disarm item' }), value: 'item' }
          ],
          onChange: ({ value }) => {
            // Hide/show trigger item SlimSelect form element depending on value
            if (value === 'item') {
              $('#node-openhab-v2-trigger-tabs-trigger-armed-item').show();
              $('#node-openhab-v2-trigger-tabs-trigger-inputArmDisarm').hide();
              $('#node-input-inputArmDisarm').prop('checked', false);
              $('#node-input-inputArmDisarm').change();
            } else {
              $('#node-openhab-v2-trigger-tabs-trigger-armed-item').hide();
              $('#node-openhab-v2-trigger-tabs-trigger-inputArmDisarm').show();
              $('#node-input-inputArmDisarm').prop('checked', node.inputArmDisarm);
              $('#node-input-inputArmDisarm').change();
            }
          }
        },
        'node-input-conditionsLogic': {
          showSearch: false,
          selectedElement: node.triggerConditions.logic,
          data: [{ text: 'OR' }, { text: 'AND' }],
          onChange: ({ value }) => {
            $('span.conditionsLogic').text(value);
          }
        },
        'node-input-additionalConditionsFrequency': {
          showSearch: false,
          selectedElement: node.additionalConditionsFrequency,
          data: [
            { text: node._('openhab-v2.trigger.select.additionalConditionsFrequency.first', { defaultValue: 'First trigger only' }), value: 'first' },
            { text: node._('openhab-v2.trigger.select.additionalConditionsFrequency.every', { defaultValue: 'Every trigger' }), value: 'every' }
          ]
        },
        'node-input-triggerStateItem': {
          placeholder: node._('openhab-v2.trigger.labels.placeholderLoading', { defaultValue: 'Loading...' }),
          searchText: node._('openhab-v2.trigger.labels.searchNoResults', { defaultValue: 'No results' }),
          searchPlaceholder: node._('openhab-v2.trigger.labels.searchPlaceholder', { defaultValue: 'Search' }),
          deselectLabel: '<span>&#10006;</span>',
          allowDeselect: false,
          allowDeselectOption: false,
          showOptionTooltips: true
        },
        'node-input-afterTrigger': {
          showSearch: false,
          selectedElement: node.afterTrigger,
          data: [
            { text: node._('openhab-v2.trigger.select.afterTrigger.nothing', { defaultValue: 'Do nothing' }), value: 'nothing' },
            { text: node._('openhab-v2.trigger.select.afterTrigger.nodelay', { defaultValue: 'No delay' }), value: 'nodelay' },
            { text: node._('openhab-v2.trigger.select.afterTrigger.timer', { defaultValue: 'Start timer' }), value: 'timer' },
            { text: node._('openhab-v2.trigger.select.afterTrigger.untrigger', { defaultValue: 'Wait until trigger condition is false' }), value: 'untrigger' }
          ],
          // onChange handler: When 'afterTrigger' on the 'action' tab changes
          onChange: ({ value: afterTrigger }) => {
            switch (afterTrigger) {
              case 'nothing': {
                $('div[id^=timer-row]').hide();
                $('div[id^=endmessage-row]').hide();
                break;
              }
              case 'timer': {
                $('div[id^=timer-row]').show();
                $('div[id^=endmessage-row]').show();
                if ($('#node-input-advancedTimerToggle').is(':checked')) {
                  $('#timer-row0').hide();
                  $('#timer-row1').show();
                } else {
                  $('#timer-row0').show();
                  $('#timer-row1').hide();
                }
                break;
              }
              case 'untrigger':
              case 'nodelay':
              default: {
                $('div[id^=timer-row]').hide();
                $('div[id^=endmessage-row]').show();
                break;
              }
            }
          }
        },
        'node-input-timerUnits': {
          showSearch: false,
          selectedElement: node.timerUnits,
          data: [
            { text: node._('openhab-v2.trigger.select.timerUnits.milliseconds', { defaultValue: 'milliseconds' }) },
            { text: node._('openhab-v2.trigger.select.timerUnits.seconds', { defaultValue: 'seconds' }) },
            { text: node._('openhab-v2.trigger.select.timerUnits.minutes', { defaultValue: 'minutes' }) }
          ],
          onChange: ({ value }) => {}
        },
        'node-input-timerExpiresAction': {
          showSearch: false,
          selectedElement: node.timerExpiresAction,
          data: [
            { text: node._('openhab-v2.trigger.select.timerExpiresAction.always_continue', { defaultValue: 'Continue' }), value: 'always_continue' },
            {
              text: node._('openhab-v2.trigger.select.timerExpiresAction.if_false_continue', {
                defaultValue: 'Restart timer IF trigger condition is still true ELSE continue'
              }),
              value: 'if_false_continue'
            }
          ],
          onChange: ({ value }) => {}
        },
        'node-input-armDisarm': {
          showSearch: false,
          selectedElement: node.armDisarm,
          data: [
            { text: node._('openhab-v2.trigger.select.armDisarm.do_not_change', { defaultValue: 'Do not change trigger state' }), value: 'do_not_change' },
            { text: node._('openhab-v2.trigger.select.armDisarm.arm', { defaultValue: 'Arm trigger' }), value: 'arm' },
            { text: node._('openhab-v2.trigger.select.armDisarm.disarm', { defaultValue: 'Disarm trigger' }), value: 'disarm' }
          ],
          onChange: ({ value }) => {}
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
          const switchItems = itemList.filter(item => ['Switch', 'Contact'].includes(item.type) || ['Switch', 'Contact'].includes(item.groupType));

          populateItemList(slimSelectElements.get('node-input-item'), allItems, node.item);
          populateItemList(slimSelectElements.get('node-input-triggerStateItem'), switchItems, node.triggerStateItem);
        })
    );

    // onChange handler: When node input is enabled/disabled to arm/disarm trigger
    $('#node-input-inputArmDisarm').change(() => {
      if ($('#node-input-inputArmDisarm').is(':checked')) {
        node.inputs = 1;
      } else {
        node.inputs = 0;
      }
    });

    // onChange handler: Enable/Disable advanced timer options
    $('#node-input-advancedTimerToggle').change(({ target }) => {
      if ($('#node-input-afterTrigger').val() === 'timer') {
        if ($(target).is(':checked')) {
          $('#timer-row0').hide();
          $('#timer-row1').show();
        } else {
          $('#timer-row0').show();
          $('#timer-row1').hide();
        }
      } else {
        $('#node-input-afterTrigger').trigger('change');
      }
    });

    // Hide payload fields if topic 'nothing' is selected
    $('input[type=text][id^=node-input-topic]').change(({ target: { id, value } }) => {
      if (value !== '') {
        switch (id) {
          case 'node-input-topic': {
            $('#message-row2').show();
            break;
          }
          case 'node-input-topicEnd': {
            if ($('#node-input-afterTrigger').val() !== 'nothing') {
              $('#endmessage-row2').show();
            }
            break;
          }
        }
      } else {
        switch (id) {
          case 'node-input-topic': {
            $('#message-row2').hide();
            break;
          }
          case 'node-input-topicEnd': {
            $('#endmessage-row2').hide();
            break;
          }
        }
      }
    });

    /**
     * Main
     */

    // Create navigation tabs
    createTabs('node-openhab-v2-trigger-tabs');

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

    // Save triggerConditions
    (function() {
      const logic = $('#node-input-conditionsLogic').val() ? $('#node-input-conditionsLogic').val() : node._def.defaults.triggerConditions.value.logic;
      const triggerConditions = { logic, conditions: [] };
      $('#node-input-triggerConditions')
        .editableList('items')
        .each((index, elem) => {
          const comparator = elem.children(`#node-input-comparator-${index}`).val();
          const type = elem.children(`#node-input-conditionType-${index}`).val();
          const value = elem.children(`#node-input-conditionValue-${index}`).val();

          triggerConditions.conditions.push({ comparator, type, value });
        });
      $('#node-input-triggerConditions').val(triggerConditions);
    })();

    // Save additionalConditions
    (function() {
      const logic = node._def.defaults.additionalConditions.value.logic;
      const additionalConditions = { logic, conditions: [] };
      $('#node-input-additionalConditions')
        .editableList('items')
        .each((index, elem) => {
          const comparator = elem.children(`#node-input-additionalConditioncomparator-${index}`).val();
          const variableType = elem.children(`#node-input-additionalConditionVariableType-${index}`).val();
          const variableValue = elem.children(`#node-input-additionalConditionVariableValue-${index}`).val();
          const type = elem.children(`#node-input-additionalConditionType-${index}`).val();
          const value = elem.children(`#node-input-additionalConditionValue-${index}`).val();

          additionalConditions.conditions.push({ comparator, variableType, variableValue, type, value });
        });
      $('#node-input-additionalConditions').val(additionalConditions);
    })();

    // Using SlimSelect and submitting no selected option results in 'null' value instead of undefined
    // This is a workaround to prevent NodeRED from not storing an undefined value
    $('#node-input-item').val($('#node-input-item').val() !== null ? $('#node-input-item').val() : undefined);
    $('#node-input-triggerStateItem').val($('#node-input-triggerStateItem').val() !== null ? $('#node-input-triggerStateItem').val() : undefined);
  },
  oneditcancel: function() {},
  oneditdelete: function() {},
  oneditresize: function() {}
});
