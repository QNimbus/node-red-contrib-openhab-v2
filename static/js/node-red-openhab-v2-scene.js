RED.nodes.registerType('openhab-v2-scene', {
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
        sceneItem: {
            value: undefined,
            required: false,
        }
    },
    inputs: 1,
    outputs: 1,
    inputLabels: [],
    outputLabels: [],
    icon: 'node-red-contrib-openhab-v2.png',
    paletteLabel: 'scene',
    label: function () {
        return (this.name || 'scene');
    },
    oneditprepare: function () {
        var node = this;

        getItemList(node.sceneItem, $('#node-input-controller'), '#node-input-sceneItem', true, true, ['String'], ['openhab-v2-scene']);
    },
    oneditsave: function () {
        var node = this;
    }
});