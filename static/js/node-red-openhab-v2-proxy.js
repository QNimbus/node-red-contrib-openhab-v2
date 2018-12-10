RED.nodes.registerType('openhab-v2-proxy', {
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
        proxyDirection: {
            value: 2,
            required: true,
            validate: RED.validators.number(),
        },
        item: {
            value: '',
            required: true,
        },
        itemPostfix: {
            value: '_Updates',
            required: false,
        },
        proxyItem: {
            value: '',
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
    paletteLabel: 'proxy',
    label: function () {
        return (this.name || this.proxyItem || 'proxy');
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
            types: ['msg', 'flow', 'global', 'str', 'num', 'date'],
            default: 'msg',
            value: 'payload',
            typeField: $('#node-input-payloadType'),
        });
        $('#node-input-topicType').val(node.topicType);
        $('#node-input-payloadType').val(node.payloadType);

        getItemList(node.item, $('#node-input-controller'), '#node-input-item', true);
        getItemList(node.proxyItem, $('#node-input-controller'), '#node-input-proxyItem', true);

        // Hide Item postfix field by default; only if both directions are enabled
        $('#itemPostfix_div').hide();
        $('#node-input-proxyDirection').change(function (event) {
            if ($('#node-input-proxyDirection').val() == 3) {
                $('#itemPostfix_div').show();
            } else {
                $('#itemPostfix_div').hide();
            }
        })
    }
});