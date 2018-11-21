RED.nodes.registerType('openhab-v2-controller', {
    category: 'config',
    defaults: {
        name: {
            value: '',
            required: true,
        },
        protocol: {
            value: 'http',
            required: true,
        },
        host: {
            value: 'localhost',
            required: true,
        },
        port: {
            value: 8080,
            validate: RED.validators.number(),
            required: false,
        },
        path: {
            value: '',
        },
        username: {
            value: '',
            required: false,
        },
        password: {
            value: '',
            required: false,
        },
        allowRawEvents: {
            value: true,
            required: true,
        }
    },
    paletteLabel: 'openhab-v2-controller',
    label: function () {
        return this.name;
    }
});