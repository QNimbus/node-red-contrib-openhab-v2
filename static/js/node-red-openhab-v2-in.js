RED.nodes.registerType('openhab-v2-in', {
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
        item: {
            value: '',
            required: false,
        },
        ohCompatibleTimestamp: {
            value: false,
        },
        eventTypes: {
            value: [],
            required: true,
        },
        outputAtStartup: {
            value: true,
            required: true,
        },
        storeStateInFlow: {
            value: false,
            required: true,
        },
    },
    inputs: 0,
    outputs: 2,
    inputLabels: [],
    outputLabels: ['StateEvent', 'RawEvent'],
    icon: 'node-red-contrib-openhab-v2.png',
    paletteLabel: 'in',
    label: function () {
        return (this.name || this.item || 'in');
    },
    oneditprepare: function () {
        var node = this;

        getItemList(node.item, '#node-input-item');
        getEventTypeList(node);

        // Enable/Disable OpenHAB compatible timestamp
        $('#node-input-ohCompatibleTimestamp').change(() => {
            if ($('#node-input-ohCompatibleTimestamp').is(':checked')) {
                node.ohCompatibleTimestamp = true;
            } else {
                node.ohCompatibleTimestamp = false;
            }
        });
    },
    oneditsave: function () {
        var node = this;

        workaroundForEmptyItemsList(node, '#node-input-eventTypes');
    }
});