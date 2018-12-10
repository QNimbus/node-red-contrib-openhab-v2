RED.nodes.registerType('openhab-v2-out', {
    category: 'OpenHAB',
    color: '#ff6600',
    align: 'right',
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
        topic: {
            value: 'topic',
        },
        topicType: {
            value: 'msg',
        },
        payload: {
            value: 'payload',
        },
        payloadType: {
            value: 'msg',
        },
        storeStateInFlow: {
            value: false,
            required: true,
        },
    },
    inputs: 1,
    outputs: 0,
    inputLabels: ['OpenHAB command'],
    outputLabels: [],
    icon: 'node-red-contrib-openhab-v2.png',
    paletteLabel: 'out',
    label: function () {
        return (this.name || this.item || 'out');
    },
    oneditprepare: function () {
        var node = this;

        var OpenHABTypes = {
            value: 'oh_cmd',
            label: 'OpenHAB',
            icon: 'icons/node-red-contrib-openhab-v2/node-red-contrib-openhab-v2-color.png',
            options: ['ItemCommand', 'ItemUpdate']
        };

        $('#node-input-topic').typedInput({
            types: [OpenHABTypes, 'str', 'msg'],
            default: 'msg',
            value: 'topic',
            typeField: $('#node-input-topicType'),
        });
        $('#node-input-payload').typedInput({
            types: [OpenHABPayload, 'msg', 'flow', 'global', 'str', 'num', 'date'],
            default: 'msg',
            value: 'payload',
            typeField: $('#node-input-payloadType'),
        });
        $('#node-input-topicType').val(node.topicType);
        $('#node-input-payloadType').val(node.payloadType);

        getItemList(node.item, $('#node-input-controller'), '#node-input-item', true, false);
    },
});