var operators = [
    { v: "eq", t: "==", kind: 'V' },
    { v: "neq", t: "!=", kind: 'V' },
    { v: "lt", t: "<", kind: 'V' },
    { v: "lte", t: "<=", kind: 'V' },
    { v: "gt", t: ">", kind: 'V' },
    { v: "gte", t: ">=", kind: 'V' },
    // { v: "btwn", t: "switch.rules.btwn", kind: 'V' },
    // { v: "cont", t: "switch.rules.cont", kind: 'V' },
    // { v: "regex", t: "switch.rules.regex", kind: 'V' },
    // { v: "true", t: "switch.rules.true", kind: 'V' },
    // { v: "false", t: "switch.rules.false", kind: 'V' },
    // { v: "null", t: "switch.rules.null", kind: 'V' },
    // { v: "nnull", t: "switch.rules.nnull", kind: 'V' },
    // { v: "istype", t: "switch.rules.istype", kind: 'V' },
    // { v: "empty", t: "switch.rules.empty", kind: 'V' },
    // { v: "nempty", t: "switch.rules.nempty", kind: 'V' },
    // { v: "head", t: "switch.rules.head", kind: 'S' },
    // { v: "index", t: "switch.rules.index", kind: 'S' },
    // { v: "tail", t: "switch.rules.tail", kind: 'S' },
    // { v: "jsonata_exp", t: "switch.rules.exp", kind: 'O' },
    // { v: "else", t: "switch.rules.else", kind: 'O' }
];

var OpenHABPayload = {
    value: 'oh_payload',
    label: 'OpenHAB',
    icon: 'icons/node-red-contrib-openhab-v2/node-red-contrib-openhab-v2-color.png',
    options: ['ON', 'OFF', 'OPEN', 'CLOSED', 'INCREASE', 'DECREASE', 'UP', 'DOWN', 'STOP', 'MOVE', 'PLAY', 'PAUSE', 'REWIND', 'FASTFORWARD', 'NEXT', 'PREVIOUS', 'NULL'],
};

var OpenHABItem = {
    value: 'oh_item',
    label: 'OpenHAB',
    icon: 'icons/node-red-contrib-openhab-v2/node-red-contrib-openhab-v2-color.png',
    options: ['Current trigger item']
};

var OpenHABTypes = {
    value: 'oh_cmd',
    label: 'OpenHAB',
    icon: 'icons/node-red-contrib-openhab-v2/node-red-contrib-openhab-v2-color.png',
    options: ['ItemCommand', 'ItemUpdate']
};

var NothingType = {
    value: 'nothing',
    label: 'nothing',
    hasValue: false,
};

/**
 * truncateWithEllipses
 * 
 * Utility function to truncate long strings with elipsis ('...')
 *
 */
function truncateWithEllipses(text, max = 30) {
    if (text) {
        return text.substr(0, max - 1) + (text.length > max ? '&hellip;' : '');
    } else {
        return text;
    }
}

/**
 * sortBy
 * 
 * Utility function to sort items object (e.g. by name)
 *
 */
function sortBy(sortObject, sortProperty, caseSensitive = true, sortDesc = false) {
    try {
        sortObject.sort(function (a, b) {
            a = caseSensitive ? a[sortProperty] : a[sortProperty].toLowerCase();
            b = caseSensitive ? b[sortProperty] : b[sortProperty].toLowerCase();

            if (a < b)
                return sortDesc ? 1 : -1;
            else if (a > b)
                return sortDesc ? -1 : 1;
            else
                return 0;
        });
    } catch (error) {
        // Unable to sort (i.e. unknown property?)
    }

    return sortObject;
}

/**
 * workaroundForEmptyItemsList
 * 
 * Since 'invalid' form elements do not get POSTed (an empty multiselect input element is considered 'invalid'), the NodeRED frontend
 * will not allow user to deploy the node/flow when no items are selected. To workaround this issue, an empty option will be added
 * dynamically to trick the DOM into POSTing the form with the SELECT input element. Backend needs to account for a single '' (empty string)
 * value being passed in case nothing is selected.
 *
 */
function workaroundForEmptyItemsList(node, elementName) {
    var selectedItemElement = $(elementName);
    var selectedItems = selectedItemElement.find('option').filter(':selected');

    if (selectedItems && selectedItems.length === 0) {
        var optionElement = document.createElement('option');
        selectedItemElement.append(optionElement).children().last().attr('selected', 'selected');
    }
}

/**
 * fixForTypedInputElements
 * 
 * When browser doesn't render typedInput elements (because they are hidden) and they get shown ($(elem).show()) due to an event
 * the NodeRED typedInput widget does not get rendered properly. The function fixes that by recalculating and reapplying the correct
 * width for the typedInput widget.
 *
 */
function fixForTypedInputElements() {
    $('.red-ui-typedInput-container').each((x, elem) => {
        // Find the width (including padding and margin) of the typedInput widget button
        var buttonWidth = $(elem).find(':button').outerWidth();

        // Only re-apply style to already visible elements
        if ($(elem).is(':visible')) {
            $(elem).find('.red-ui-typedInput-option-trigger').css('width', '100%').css('width', `-=${buttonWidth}px`);
            $(elem).find('.red-ui-typedInput-input').css('left', `${buttonWidth}px`);
        }
    });
}

/**
 * getItemList
 * 
 * To do...
 *
 */
function getItemList(nodeItem, selectedItemElementName, refresh = false, allowEmpty = false, itemTypeFilter = [], itemTagFilter = []) {

    function updateItemList(controller, selectedItemElement, itemName, refresh = false, itemTypeFilter = [], itemTagFilter = []) {

        // Remove all previous and/or static (if any) elements from 'select' input element
        selectedItemElement.children().remove();

        if (controller) {
            $.getJSON('/openhab2/itemlist', {
                controllerID: controller.id,
                forceRefresh: refresh
            })
                .done(function (data, textStatus, jqXHR) {
                    try {
                        var items = sortBy(data, 'name');

                        // Remove all previous and/or static (if any) elements from 'select' input element
                        selectedItemElement.children().remove();

                        if (allowEmpty) {
                            var optionElement = document.createElement('option');
                            selectedItemElement.append(optionElement).children().last().attr('value', '');
                        }

                        items.forEach(function (item) {
                            var optionElement = document.createElement('option');
                            var addItem = true;

                            if (itemTypeFilter.length > 0) {
                                if (!itemTypeFilter.includes(item.type)) {
                                    addItem = false;
                                }
                            }

                            if (itemTagFilter.length > 0) {
                                if (itemTagFilter.filter(element => item.tags.includes(element)).length === 0) {
                                    addItem = false;
                                }
                            }

                            if (addItem) {
                                selectedItemElement.append(optionElement).children().last().attr('value', item.name).html(item.name + (item.type === 'Group' ? ' [G]' : ''));
                            }
                        });

                        // Enable item selection
                        selectedItemElement.multiselect('enable');

                        // Finally, set the value of the input select to the selected value
                        selectedItemElement.val(itemName);

                        // Rebuild bootstrap multiselect form
                        selectedItemElement.multiselect('rebuild');
                        selectedItemElement.multiselect().trigger('change');

                        // Trim selected item string length with elipsis
                        var selectItemSpanElement = $(`span.multiselect-selected-text:contains("${itemName}")`);
                        var sHTML = selectItemSpanElement.html();
                        selectItemSpanElement.html(truncateWithEllipses(sHTML, 35));
                    } catch (error) {
                        console.error(`Error: ${error}`);
                    }

                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    // Disable item selection if no items were retrieved
                    selectedItemElement.multiselect('disable');
                    selectedItemElement.multiselect('refresh');

                    console.error(`Error: ${errorThrown}`);
                });
        } else {
            // Disable item selection if no (valid) controller was selected
            selectedItemElement.multiselect('disable');
            selectedItemElement.multiselect('refresh');
        }
    }

    var selectedItemElement = $(selectedItemElementName);
    var selectedItem = selectedItemElement.val();
    var openHABControllerElement = $('#node-input-controller');
    var openHABControllerValue = openHABControllerElement.val();
    var openHABController = RED.nodes.node(openHABControllerValue);
    var refreshListElement = $('#force-refresh');

    // Initialize bootstrap multiselect form
    selectedItemElement.multiselect({
        enableFiltering: true,
        enableCaseInsensitiveFiltering: true,
        filterPlaceholder: 'Filter items...',
        includeResetOption: true,
        includeResetDivider: true,
        numberDisplayed: 1,
        maxHeight: 300,
        disableIfEmpty: true,
        nSelectedText: 'selected',
        nonSelectedText: 'None selected',
        buttonWidth: '70%'
    });

    // Initial call to populate item list
    updateItemList(RED.nodes.node(openHABControllerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem, false, itemTypeFilter, itemTagFilter);

    // onChange event handler in case a new controller gets selected
    openHABControllerElement.change(function (event) {
        updateItemList(RED.nodes.node(openHABControllerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem, true, itemTypeFilter, itemTagFilter);
    });

    refreshListElement.click(function (event) {
        // Force a refresh of the item list
        updateItemList(RED.nodes.node(openHABControllerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem, true, itemTypeFilter, itemTagFilter);
    });
}


/**
 * workaroundForEmptyItemsList
 * 
 * To do...
 *
 */
function getEventTypeList(node) {

    var selectedEventsElement = $('#node-input-eventTypes');
    var selectedEvents = selectedEventsElement.val();
    var openHABControllerElement = $('#node-input-controller');
    var openHABController = RED.nodes.node(openHABControllerElement.val());

    // Initialize bootstrap multiselect form
    selectedEventsElement.multiselect({
        enableFiltering: false,
        numberDisplayed: 1,
        maxHeight: 300,
        disableIfEmpty: true,
        nSelectedText: 'selected',
        nonSelectedText: 'None selected',
        buttonWidth: '70%',
    });
}