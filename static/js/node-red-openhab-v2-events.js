RED.nodes.registerType('openhab-v2-events', {
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
        items: {
            value: [],
            required: true,
        },
        ohCompatibleTimestamp: {
            value: false,
        },
    },
    inputs: 0,
    outputs: 1,
    inputLabels: [],
    outputLabels: ['RawEvents'],
    icon: 'node-red-contrib-openhab-v2.png',
    paletteLabel: 'events',
    label: function () {
        return (this.name || 'events');
    },
    oneditprepare: function () {
        var node = this;

        getItemList(node.items, $('#node-input-controller'), '#node-input-items', true, false);

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
        workaroundForEmptyItemsList(this, '#node-input-items');
    }
});