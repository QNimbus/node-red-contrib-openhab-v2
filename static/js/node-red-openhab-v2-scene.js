RED.nodes.registerType('openhab-v2-scene', {
    category: 'OpenHAB',
    color: '#ff6600',
    align: 'left',
    defaults: {
        name: {
            value: '',
        },
        sceneController: {
            value: '',
            type: 'openhab-v2-scene-controller',
            required: true,
        },
    },
    inputs: 0,
    outputs: 0,
    inputLabels: [],
    outputLabels: [],
    icon: 'node-red-contrib-openhab-v2.png',
    paletteLabel: 'scene',
    label: function () {
        return (this.name || 'scene');
    },
    oneditprepare: function () {
        var node = this;
    },
    oneditsave: function () {
        var node = this;
    }
});