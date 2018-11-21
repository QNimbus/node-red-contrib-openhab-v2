RED.nodes.registerType('openhab-v2-get', {
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
            required: true,
        },
    },
    inputs: 1,
    outputs: 1,
    inputLabels: ['Item'],
    outputLabels: [],
    icon: 'node-red-contrib-openhab-v2.png',
    paletteLabel: 'get',
    label: function () {
        return (this.name || 'get');
    },
    oneditprepare: function () {
        var node = this;

        getItemList(node.item, '#node-input-item', false, false);
    }
});