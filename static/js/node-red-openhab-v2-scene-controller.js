RED.nodes.registerType('openhab-v2-scene-controller', {
    category: 'config',
    defaults: {
        name: {
            value: '',
            required: true,
        },
        controller: {
            value: '',
            type: 'openhab-v2-controller',
            required: true,
        },
    },
    paletteLabel: 'openhab-v2-scene-controller',
    label: function () {
        return this.name;
    }
});