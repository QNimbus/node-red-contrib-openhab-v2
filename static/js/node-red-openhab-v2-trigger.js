RED.nodes.registerType('openhab-v2-trigger', {
    category: 'OpenHAB',
    color: '#ff6600',
    align: 'left',
    defaults: {
        name: {
            value: '',
        },
        controller: {
            value: '',
            type: 'openhab-v2-controller',
            required: true,
        },
        inputs: {
            value: 0,
        },
        outputs: {
            value: 1,
        },
        triggerItems: {
            value: [],
            required: true,
            validate: function (value) {
                // Make sure at least 1 item is selected
                if (value && value.length === 1 && value[0] === '') {
                    return false;
                }
                return true;
            }
        },
        triggerItemsConditions: {
            value: [],
        },
        enableSecondOutput: {
            value: false,
        },
        ohCompatibleTimestamp: {
            value: false,
        },
        enableInput: {
            value: false,
        },
        triggerArmedState: {
            value: 'armed',
        },
        triggerArmedItem: {
            value: undefined,
        },
        conditions: {
            value: [],
        },
        triggerAdditionalConditions: {
            value: 'every',
        },
        topic: {
            value: 'topic',
        },
        topicType: {
            value: 'oh_cmd',
        },
        payload: {
            value: 'ON',
        },
        payloadType: {
            value: 'oh_payload',
        },
        topicEnd: {
            value: 'topic',
        },
        topicEndType: {
            value: 'oh_cmd',
        },
        payloadEnd: {
            value: 'OFF',
        },
        payloadEndType: {
            value: 'oh_payload',
        },
        afterTrigger: {
            value: 'untrigger',
        },
        timer: {
            value: 10,
            validate: function (v) { return RED.validators.number(v) && (v >= 0); },
        },
        timerUnits: {
            value: 'seconds',
        },
        advancedTimerToggle: {
            value: false,
        },
        advancedTimer: {
            value: 10000,
        },
        advancedTimerType: {
            value: 'num',
        },
        cancelTimerWhenDisarmed: {
            value: false,
        },
        timerExpiresAction: {
            value: 'if_false_reset',
        },
        armDisarm: {
            value: '',
        },
        storeStateInFlow: {
            value: false,
            required: true,
        },
    },
    inputs: 0,
    outputs: 1,
    inputLabels: [],
    outputLabels: [],
    icon: 'node-red-contrib-openhab-v2.png',
    paletteLabel: 'trigger',
    label: function () {
        return (this.name || this.triggerItems[0] || 'trigger');
    },
    oneditprepare: function () {
        var node = this;
        var inputCount = $('#node-input-inputs').val('');
        var outputCount = $('#node-input-outputs').val('');

        // Initial values
        inputCount.val(JSON.stringify(node.enableInput === true ? 1 : 0));
        outputCount.val(JSON.stringify(node.enableSecondOutput === true ? 2 : 1));
        node.inputs = inputCount.val();
        node.outputs = outputCount.val();

        // Populate item lists
        getItemList(node.triggerItems, '#node-input-triggerItems');
        getItemList(node.triggerArmedItem, '#node-input-triggerArmedItem', false, false, ['Switch', 'Contact']);

        //***************//
        // Create events //
        //***************//

        // Enable/Disable input
        $('#node-input-enableInput').change(() => {
            if ($('#node-input-enableInput').is(':checked')) {
                inputCount.val(JSON.stringify(1));
            } else {
                inputCount.val(JSON.stringify(0));
            }
            node.inputs = parseInt(inputCount.val());
        });

        // Enable/Disable 2nd output
        $('#node-input-enableSecondOutput').change(() => {
            if ($('#node-input-enableSecondOutput').is(':checked')) {
                outputCount.val(JSON.stringify(2));
            } else {
                outputCount.val(JSON.stringify(1));
            }
        });

        // Enable/Disable OpenHAB compatible timestamp
        $('#node-input-ohCompatibleTimestamp').change(() => {
            if ($('#node-input-ohCompatibleTimestamp').is(':checked')) {
                node.ohCompatibleTimestamp = true;
            } else {
                node.ohCompatibleTimestamp = false;
            }
        });

        // Arming and disarming of trigger
        $('#node-input-triggerItems').multiselect().change(() => {
            var triggerItems = $('#node-input-triggerItems').multiselect().val();
            if (triggerItems === null) {
                $('#notrigger').hide();
            } else {
                // Clear list before adding rows...
                $('#node-input-triggerItemsConditions-container').empty();

                // Populate trigger condition list
                for (var i = 0; i < triggerItems.length; i++) {
                    var triggerItem = triggerItems[i];
                    var triggerItemCondition = node.triggerItemsConditions.find(i => i.triggerItem === triggerItem);
                    if (triggerItemCondition) {
                        $('#node-input-triggerItemsConditions-container').editableList('addItem', { triggerItem: triggerItemCondition.triggerItem, type: triggerItemCondition.type, value: triggerItemCondition.value, valueType: triggerItemCondition.valueType });
                    } else {
                        $('#node-input-triggerItemsConditions-container').editableList('addItem', { triggerItem: triggerItem });
                    }
                };
                $('#notrigger').show();

                fixForTypedInputElements();
            }
        });

        // Arming and disarming of trigger
        $('#node-input-triggerArmedState').change(() => {
            if ($('#node-input-triggerArmedState').val() === 'item') {
                $('#triggerArmedItemRow').show();
            } else {
                $('#triggerArmedItemRow').hide();
            }
        });

        // Hide payload fields if topic 'nothing' is selected
        $('input[type=text]').filter((index, element) => {
            return element.id.match(/^node-input-topic(End)?$/);
        }).change((event) => {
            var element = $(event.target);
            var value = element.val();
            var elementId = element.attr('id');

            if (value !== '') {
                switch (elementId) {
                    case 'node-input-topic': {
                        $('#message-row3').show();
                        break;
                    }
                    case 'node-input-topicEnd': {
                        if ($('#node-input-afterTrigger').val() !== 'nothing') {
                            $('#endmessage-row3').show();
                        }
                        break;
                    }
                }
            } else {
                switch (elementId) {
                    case 'node-input-topic': {
                        $('#message-row3').hide();
                        break;
                    }
                    case 'node-input-topicEnd': {
                        $('#endmessage-row3').hide();
                        break;
                    }
                }
            }
        });

        // Enable/Disable advanced timer options
        $('#node-input-advancedTimerToggle').change(() => {
            if ($('#node-input-afterTrigger').val() === 'timer') {
                if ($('#node-input-advancedTimerToggle').is(':checked')) {
                    $('#timer-row0').hide();
                    $('#timer-row1').show();
                } else {
                    $('#timer-row0').show();
                    $('#timer-row1').hide();
                }
            } else {
                $('#node-input-afterTrigger').trigger('change');
            }
            fixForTypedInputElements();
        });

        // After trigger action
        $('#node-input-afterTrigger').change(() => {
            switch ($('#node-input-afterTrigger').val()) {
                case 'nothing': {
                    $('div[id^=timer-row]').hide();
                    $('div[id^=endmessage-row]').hide();
                    break;
                };
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
                    if ($('#node-input-topicEndType').val() !== 'nothing') {
                        $('div[id^=endmessage-row3]').show();
                    } else {
                        $('div[id^=endmessage-row3]').hide();
                    }
                    break;
                };
                default: {
                    $('div[id^=timer-row]').hide();
                    $('div[id^=endmessage-row]').show();
                    if ($('#node-input-topicEndType').val() !== 'nothing') {
                        $('div[id^=endmessage-row3]').show();
                    } else {
                        $('div[id^=endmessage-row3]').hide();
                    }

                    break;
                }
            }
            fixForTypedInputElements();
        });

        //**********************//
        // Create editablelists //
        //**********************//

        // Condition container list
        $('#node-input-triggerItemsConditions-container').css('min-width', '400px').editableList({
            removable: false,
            addButton: false,
            height: 'auto',
            addItem: function (container, index, data) {
                var triggerItemCondition = data || {};
                var triggerItem = triggerItemCondition.triggerItem;

                // Set default values if not supplied via function 'data' parameter
                if (!triggerItemCondition.hasOwnProperty('type')) {
                    triggerItemCondition.type = 'eq';
                    triggerItemCondition.value = 'ON';
                    triggerItemCondition.valueType = 'oh_payload';
                }

                // Build row
                var row = $('<div/>').appendTo(container);
                var innerRow1 = $('<div/>').attr({ style: 'width: 100%; overflow: hidden; margin-bottom: 5px; font-size: 10px' }).appendTo(row);
                var innerRow2 = $('<div/>').appendTo(row);
                var clearRow = $('<div/>', { style: 'clear: both;' }).appendTo(row);

                // Build comparator list
                var selectField = $('<select/>').attr({ style: 'width: 80px; float: left; text-align: center; margin-right: 10px;' });
                $('<optgroup/>', { label: 'value rules' }).appendTo(selectField);
                for (var d in operators) {
                    if (operators[d].kind === 'V') {
                        selectField.append($('<option></option>').val(operators[d].v).text(/^switch/.test(operators[d].t) ? node._(operators[d].t) : operators[d].t));
                    }
                };

                // Input fields
                var valueField = $('<input/>').attr({ class: 'node-input-triggerItemsConditions-value', style: 'max-width: 50%; float: right;' });

                innerRow1.append($('<label/>'));
                innerRow1.append($('<strong/>').html(`${triggerItem}`));
                innerRow2.append($('<label/>', { style: 'float: left; text-align: center;' }).html(`<span class="badge badge-secondary">Trigger ${index + 1}</span>`));
                innerRow2.append(selectField);
                innerRow2.append(valueField);

                valueField.typedInput(
                    {
                        types: [OpenHABPayload, 'global', 'flow', 'str', 'num'],
                        default: 'oh_payload',
                    }
                );

                // Populate value fields
                switch (triggerItemCondition.type) {
                    case 'eq':
                    case 'neq':
                    case 'lt':
                    case 'lte':
                    case 'gt':
                    case 'gte':
                    default: {
                        // Set values
                        valueField.typedInput('value', triggerItemCondition.value);

                        // Set types
                        valueField.typedInput('type', triggerItemCondition.valueType);
                    }
                }

                // Call change event handler for select field to correctly display the typedInput fields
                selectField.val(triggerItemCondition.type);
                selectField.change();
            },
        });

        // Condition container list
        $('#node-input-condition-container').css('min-width', '400px').editableList({
            removable: true,
            height: 'auto',
            // When an item is added, add a new row
            addItem: function (container, index, data) {
                var condition = data['condition'] || {};

                // Set default values if not supplied via function 'data' parameter
                if (!condition.hasOwnProperty('type')) {
                    condition.type = 'eq';
                    condition.value1 = 'triggerVariable';
                    condition.value1Type = 'global';
                    condition.value2 = 'ON';
                    condition.value2Type = 'oh_payload';
                }

                // Build row
                var row = $('<div/>').append($('<label/>', { style: 'float: left; padding: 5px 0px;' })).appendTo(container);
                var innerRow1 = $('<div/>', { style: 'padding: 5px 0px; float: right; width: calc(100% - 100px); margin-right: 0px; margin-left: 0px;' }).appendTo(row);
                var selectField = $('<select/>', { style: 'padding: 5px 0px; float: right; width: calc(100% - 100px); margin-right: 0px; margin-left: 0px; text-align-last: center;' }).appendTo(row);
                var innerRow2 = $('<div/>', { style: 'padding: 5px 0px; float: right; width: calc(100% - 100px); margin-right: 0px; margin-left: 0px;' }).appendTo(row);
                var clearRow = $('<div/>', { style: 'clear: both;' }).appendTo(row);

                // Input fields
                var value1Field = $('<input/>', { class: 'node-input-condition-value1', width: '100%' }).appendTo(innerRow1);
                value1Field.typedInput(
                    {
                        default: 'global',
                        types: ['global', 'flow'],
                    }
                );
                var value2Field = $('<input/>', { class: 'node-input-condition-value2', width: '100%' }).appendTo(innerRow2);
                value2Field.typedInput(
                    {
                        default: 'str',
                        types: [OpenHABPayload, 'global', 'flow', 'str', 'num'],
                    }
                );

                // Build comparator list
                var group0 = $('<optgroup/>', { label: 'value rules' }).appendTo(selectField);
                for (var d in operators) {
                    if (operators[d].kind === 'V') {
                        group0.append($('<option></option>').val(operators[d].v).text(/^switch/.test(operators[d].t) ? node._(operators[d].t) : operators[d].t));
                    }
                };

                innerRow1.css('padding-bottom', '5px');

                selectField.change(() => {
                    var type = selectField.val();

                    switch (type) {
                        case 'eq':
                        case 'neq':
                        case 'lt':
                        case 'lte':
                        case 'gt':
                        case 'gte': {
                            // Show values
                            value1Field.typedInput('show');
                            value2Field.typedInput('show');
                            break;
                        }
                        default: {
                            value1Field.typedInput('hide');
                            value2Field.typedInput('hide');
                            break;
                        }
                    }
                });

                // Populate value fields
                switch (condition.type) {
                    case 'eq':
                    case 'neq':
                    case 'lt':
                    case 'lte':
                    case 'gt':
                    case 'gte':
                    default: {
                        // Set values
                        value1Field.typedInput('value', condition.value1);
                        value2Field.typedInput('value', condition.value2);

                        // Set types
                        value1Field.typedInput('type', condition.typeValue1);
                        value2Field.typedInput('type', condition.typeValue2);
                    }
                }

                // Call change event handler for select field to correctly display the typedInput fields
                selectField.val(condition.type);
                selectField.change();

                // Make sure that long strings do not overflow
                $('ol#node-input-condition-container').find('div.red-ui-typedInput-container').css('overflow', 'hidden');
            },
        });

        // Populate container list
        for (var i = 0; i < node.conditions.length; i++) {
            var condition = node.conditions[i];
            $('#node-input-condition-container').editableList('addItem', { condition: condition, index: i });
        };

        //********************//
        // Create typedinputs //
        //********************//

        // Advanced timer
        $('#node-input-advancedTimer').typedInput({
            types: ['global', 'flow', 'num'],
            default: 'num',
            value: '10000',
            typeField: $('#node-input-advancedTimerType'),
        });

        // Send when triggered
        $('#node-input-topic').typedInput({
            types: [OpenHABTypes, 'str', NothingType],
            default: 'oh_cmd',
            value: 'topic',
            typeField: $('#node-input-topicType'),
        });
        $('#node-input-payload').typedInput({
            types: [OpenHABPayload, 'flow', 'global', 'str', 'num', 'date'],
            default: 'str',
            value: 'payload',
            typeField: $('#node-input-payloadType'),
        });

        // Enable typedInputs for topic & payload 'end' message
        $('#node-input-topicEnd').typedInput({
            types: [OpenHABTypes, 'str', NothingType],
            default: 'oh_cmd',
            value: 'topic',
            typeField: $('#node-input-topicEndType'),
        });
        $('#node-input-payloadEnd').typedInput({
            types: [OpenHABPayload, 'flow', 'global', 'str', 'num', 'date'],
            default: 'str',
            value: 'payload',
            typeField: $('#node-input-payloadEndType'),
        });

        // Enable spinner for timer selection
        $('#node-input-timer').spinner({ min: 1 });
    },
    oneditsave: function () {
        var node = this;

        workaroundForEmptyItemsList(node, '#node-input-triggerItems');

        var rules = $('#node-input-condition-container').editableList('items');
        var triggers = $('#node-input-triggerItems').multiselect().val();
        var triggerConditions = $('#node-input-triggerItemsConditions-container').editableList('items');

        node.conditions = [];
        node.triggerItemsConditions = [];

        // Save trigger conditions in node config
        triggerConditions.each(function (index, triggerConditionElement) {
            var triggerCondition = triggerConditionElement.data('data');
            if (triggers.find(x => x === triggerCondition.triggerItem)) {
                var conditionElement = $(this);
                var conditionData = triggerCondition;
                var type = conditionElement.find('select').val();

                conditionData.type = type;

                switch (type) {
                    case 'eq':
                    case 'neq':
                    case 'lt':
                    case 'lte':
                    case 'gt':
                    case 'gte': {
                        // Save types
                        conditionData.valueType = conditionElement.find('.node-input-triggerItemsConditions-value').typedInput('type');

                        // Save values
                        conditionData.value = conditionElement.find('.node-input-triggerItemsConditions-value').typedInput('value');
                        break;
                    }
                    default: {
                        break;
                    }
                }
                node.triggerItemsConditions.push(conditionData);
            }
        });

        // Save additional conditions in node config
        rules.each(function (i) {
            var ruleData = $(this).data('data');
            var rule = $(this);
            var type = rule.find('select').val();
            var ruleData = { type: type };

            switch (type) {
                case 'eq':
                case 'neq':
                case 'lt':
                case 'lte':
                case 'gt':
                case 'gte': {
                    // Save types
                    ruleData.typeValue1 = rule.find('.node-input-condition-value1').typedInput('type');
                    ruleData.typeValue2 = rule.find('.node-input-condition-value2').typedInput('type');

                    // Save values
                    ruleData.value1 = rule.find('.node-input-condition-value1').typedInput('value');
                    ruleData.value2 = rule.find('.node-input-condition-value2').typedInput('value');
                    break;
                }
                default: {
                    break;
                }
            }

            node.conditions.push(ruleData);
        });
    }
});