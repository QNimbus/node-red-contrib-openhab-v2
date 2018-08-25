/*

  OpenHAB nodes for IBM's Node-Red
  https://github.com/QNimbus/node-red-contrib-openhab2
  (c) 2018, Bas van Wetten <bas.van.wetten@gmail.com>

  Licensed under the Apache License, Version 2.0 (the 'License');
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an 'AS IS' BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
  
*/

var request = require('request');
var util = require('util');
var EventSource = require('@joeybaker/eventsource');

/**
 * Constants
 *
 */

var NODE_PATH = '/openhab2/';
var EVENTS_PATH = '/rest/events/';
var ITEMS_PATH = '/rest/items/';

var STATE = {
    EVENT_NAME: 'state',
    CONNECTING: 1,
    CONNECTED: 2,
    DISCONNECTED: 3,
    CURRENT_STATE: 4,
    IDLE: 5,
    NO_PAYLOAD: 6,
    OK: 7,
    WARN: 98,
    ERROR: 99
};

var STATE_MSG = {
    CONNECTING: 'Connecting',
    CONNECTED: 'Connected',
    DISCONNECTED: 'Disconnected',
    IDLE: '',
    NO_PAYLOAD: 'No payload specified',
    OK: 'Ok',
    WARN: 'Warning',
    ERROR: 'Error'
}

module.exports = function (RED) {

    /**
     * httpAdmin.get
     * 
     * Enable http route to static files
     *
     */
    RED.httpAdmin.get(NODE_PATH + 'static/*', function (req, res) {
        var options = {
            root: __dirname + '/static/',
            dotfiles: 'deny'
        };
        res.sendFile(req.params[0], options);
    });

    /**
     * httpAdmin.get
     * 
     * Enable http route to OpenHAB JSON itemlist for each controller (controller id passed as GET query parameter)
     *
     */
    RED.httpAdmin.get(NODE_PATH + 'itemlist', function (req, res) {
        var config = req.query;
        var controller = RED.nodes.getNode(config.controllerID);
        var forceRefresh = config.forceRefresh ? ['1', 'yes', 'true'].includes(config.forceRefresh.toLowerCase()) : false;

        if (controller && controller instanceof OpenHABControllerNode) {
            controller.getItemsList(function (items) {
                if (items) {
                    res.json(items).end();
                } else {
                    res.status(404).end();
                }
            }, forceRefresh);
        } else {
            res.status(404).end();
        }
    });

    /**
     * updateNodeStatus
     * 
     * Function to update node status according to the STATE & STATE_MSG enums
     * Gets called by node instance method 'updateNodeStatus' (as a 'partial' construct)
     *
     */
    updateNodeStatus = function (node, state, customMessage = undefined) {
        var currentState = node.context().get('currentState');

        switch (state) {
            case STATE.CONNECTING: {
                node.status({ fill: 'green', shape: 'ring', text: customMessage ? customMessage : STATE_MSG.CONNECTING });
                break;
            }
            case STATE.CONNECTED: {
                node.status({ fill: 'green', shape: 'dot', text: customMessage ? customMessage : STATE_MSG.CONNECTED });
                break;
            }
            case STATE.DISCONNECTED: {
                node.status({ fill: 'red', shape: 'ring', text: customMessage ? customMessage : STATE_MSG.DISCONNECTED });
                break;
            }            
            case STATE.CURRENT_STATE: {
                node.status({ fill: 'green', shape: 'dot', text: customMessage ? customMessage : currentState });
                break;
            }
            case STATE.IDLE: {
                node.status({});
                break;
            }
            case STATE.NO_PAYLOAD: {
                node.status({ fill: 'red', shape: 'ring', text: customMessage ? customMessage : STATE_MSG.NO_PAYLOAD });
                break;
            }
            case STATE.OK: {
                node.status({ fill: 'green', shape: 'dot', text: customMessage ? customMessage : STATE_MSG.OK });
                break;
            }
            case STATE.ERROR: {
                node.status({ fill: 'red', shape: 'dot', text: customMessage ? customMessage : STATE_MSG.ERROR });
                break;
            }
            default: {
                node.status({ fill: 'yellow', shape: 'ring', text: customMessage ? customMessage : '?' });
                break;
            }
        }
    };

    /**
     * openhab-v2-controller
     * 
     * Holds the configuration (hostname, port, creds, etc) of the OpenHAB server
     *
     */
    function OpenHABControllerNode(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        node.name = config.name;
        node.allowRawEvents = config.allowRawEvents;
        node._eventSource = undefined;
        node._itemList = undefined;
        node._url = undefined;

        // Temporary workaround for issue #3 (https://github.com/QNimbus/node-red-contrib-openhab-v2/issues/3)
        node.setMaxListeners(50);

        /**
         * node.request
         * 
         */
        node.request = function (urlpart, options, callback) {
            options.uri = node.getURL() + urlpart;
            node.log(`Requesting URI ${options.uri} with method ${options.method}`);
            request(options, callback);
        }

        /**
         * node.send
         * 
         *
         */
        node.send = function (itemName, topic, payload) {
            var url = node.getURL() + `${ITEMS_PATH}${itemName}`;

            switch (topic) {
                case 'ItemUpdate': {
                    url += 'state';
                    method = request.put;
                    break;
                }
                case 'ItemCommand': {
                    method = request.post
                    break;
                }
                default: {
                    method = request.get;
                    break;
                }
            }

            method({ url: url, body: String(payload) }, function (error, response, body) {
                if (error) {
                    var errorMessage = `Request error: ${error} on ${url}`;

                    node.emit(STATE.EVENT_NAME, STATE.ERROR, errorMessage);
                }
                else if (!(200 <= response.statusCode && response.statusCode <= 210)) {
                    var errorMessage = `Response error: ${JSON.stringify(response)} on ${url}`;

                    node.emit(STATE.EVENT_NAME, STATE.ERROR);
                }
            });
        };

        /**
         * getConfig
         * 
         * Getter for config object
         *
         */
        node.getConfig = function () {
            return config;
        }

        /**
         * getURL
         * 
         * Getter for url string; builds url string based on config parameters such as protocol, host, port, etc.
         * e.g. http://localhost:8080 or https://user@password:myzwave.controller.example.com:8443
         *
         */
        node.getURL = function () {
            var url = node._url;

            // Sort of singleton construct - if the url has been constructed before, don't create a new one
            if (true && url === undefined || !(url.prototype === String)) {
                if (config.protocol)
                    url = config.protocol;
                else
                    url = 'http';

                url += '://';

                if ((config.username != undefined) && (config.username.trim().length != 0)) {
                    url += config.username.trim();

                    if ((config.password != undefined) && (config.password.length != 0)) {
                        url += ':' + config.password;
                    }
                    url += '@';
                }
                url += config.host;

                if ((config.port != undefined) && (config.port.trim().length != 0)) {
                    url += ':' + config.port.trim();
                }

                if ((config.path != undefined) && (config.path.trim().length != 0)) {
                    var path = config.path.trim();

                    path = path.replace(/^[\/]+/, '');
                    path = path.replace(/[\/]+$/, '');

                    url += '/' + path;
                }
            }
            node._url = url;
            return url;
        }

        /**
         * getItemsList
         * 
         * Accepts a callback function that will either receive NULL in case of error or a sorted JSON item list from OpenHAB
         *
         */
        node.getItemsList = function (callback, forceRefresh = false) {
            // Sort of singleton construct
            if (forceRefresh || node._itemList === undefined) {
                var options = {
                    method: 'GET',
                    json: true,
                    rejectUnauthorized: false,
                }
                node.request(ITEMS_PATH, options, function (error, response, body) {
                    if (error) {
                        node._itemList = undefined;
                    } else {
                        node._itemList = body;
                    }
                    console.log(`Refreshing itemlist.....`);
                    callback(node._itemList);
                });
            } else {
                console.log(`Using cached itemlist....`);
                callback(node._itemList);
            }
        }

        /**
         * getItemStates
         * 
         * Fetches all items from OpenHAB and emits events for each of them to update state of item nodes in flow
         *
         */
        node.getItemStates = function () {
            var url = node.getURL() + ITEMS_PATH;
            var options = {
                method: 'GET',
                json: true,
                rejectUnauthorized: false,
            }

            node.request(ITEMS_PATH, options, function (error, response, body) {
                if (error) {
                    var errorMessage = `Request error: ${error} on ${url}`;
                    node.warn(errorMessage);
                    node.emit(STATE.EVENT_NAME, STATE.WARN, errorMessage);
                } else {
                    switch (response.statusCode) {
                        case 503: {
                            node.warn(`Response status 503 on ${url}, trying again in a few moments...`);
                            node.emit(STATE.EVENT_NAME, STATE.WARN);
                            setTimeout(function () {
                                node.getItemStates();
                            }, 5000);
                            break;
                        }
                        case 200: {
                            body.forEach(function (item) {
                                node.emit(item.name + '/StateEvent', { type: 'ItemStateEvent', state: item.state });
                            });
                            break;
                        }
                        default: {
                            node.warn(`Response error ${response.statusCode} on ${url}: JSON.stringify(response)`);
                            node.emit(STATE.EVENT_NAME, STATE.ERROR);
                            break;
                        }
                    }
                }
            });
        }

        /* 
         * EventSource event handlers
         */

        /**
         * node.onOpen
         * 
         * onOpen event handler for eventSource watcher. Notifies all other nodes that the OpenHABControllerNode has connected succesfully
         *
         */
        node.onOpen = function () {
            node.getItemStates();
            node.emit(STATE.EVENT_NAME, STATE.CONNECTED);
        }

        /**
         * node.onError
         * 
         * onError event handler for eventSource watcher. Notifies all other nodes that the OpenHABControllerNode has experienced an error
         *
         */
        node.onError = function (error) {
            var errorMessage = `Unable to connect: ${error.type} on ${node._eventSource.url}`;

            node._eventSource.removeAllListeners();
            node._eventSource.close();            

            node.emit(STATE.EVENT_NAME, STATE.ERROR, errorMessage);
            node.error(util.inspect(error));
        }

        /**
         * node.onMessage
         * 
         * onMessage event handler for eventSource watcher. Parses event messages and emits appropriate events through the OpenHABControllerNode
         * to be listened to by the other nodes
         *
         */
        node.onMessage = function (message) {
            try {
                var parsedMessage = message;
                parsedMessage = JSON.parse(parsedMessage.data);
                parsedMessage.payload = JSON.parse(parsedMessage.payload);

                const itemStart = ('smarthome/items/').length;
                var itemName = parsedMessage.topic.substring(itemStart, parsedMessage.topic.indexOf('/', itemStart));

                if (node.allowRawEvents === true) {
                    node.emit('RawEvent', message);
                    node.emit(itemName + '/RawEvent', message);
                }

                if ((parsedMessage.type === 'ItemStateEvent') || (parsedMessage.type === 'ItemStateChangedEvent') || (parsedMessage.type === 'GroupItemStateChangedEvent')) {
                    node.emit(itemName + '/StateEvent', { type: parsedMessage.type, state: parsedMessage.payload.value });
                }
            } catch (error) {
                var errorMessage = `Error parsing message: ${error.type.Error} - ${message}`;

                node.emit(STATE.EVENT_NAME, STATE.ERROR, errorMessage);
                node.error(`Unexpected Error: ${error}`);
            }
        }

        /**
         * node.getEventSource
         * 
         * Singleton construct to get the controller eventSource for communicating with the OpenHAB eventbus
         *
         */
        node.getEventSource = function (eventSourceCallbacks) {
            var callbacks = typeof eventSourceCallbacks !== 'object' ? {} : eventSourceCallbacks;
            var eventSource = node._eventSource;

            // Sort of singleton construct - if the eventSource has been initialized before, don't create a new one
            if (eventSource !== undefined && eventSource instanceof EventSource) {
                node.log(`Controller using previously started connection: ${eventSource.url}`);

                return eventSource;
            } else {
                var eventSourceInitDict = {};
                var url = node.getURL() + EVENTS_PATH + '?topics=smarthome/items';

                node.log(`Controller attempting to connect to: ${url}`);
                eventSource = new EventSource(url, eventSourceInitDict);

                eventSource.on('open', node.onOpen);
                eventSource.on('error', node.onError);
                eventSource.on('message', node.onMessage);
            }

            // Allow for custom event handlers getting passed to eventSource object

            if (callbacks.hasOwnProperty('onOpen') && typeof callbacks.onOpen === 'function') {
                eventSource.on('open', callbacks.onOpen);
            }

            if (callbacks.hasOwnProperty('onMessage') && typeof callbacks.onMessage === 'function') {
                eventSource.on('message', callbacks.onMessage);
            }

            node._eventSource = eventSource;
            return node._eventSource;
        }

        /* 
         * Node event handlers
         */

        /**
         * OpenHABControllerNode close event handler
         * 
         * Cleanup for when the OpenHABControllerNode gets closed
         *
         */
        node.on('close', function () {
            if (node._eventSource !== undefined && node._eventSource instanceof EventSource) {
                node._eventSource.removeAllListeners();
                node._eventSource.close();
                node.log(`Controller.eventSource disconnecting...`);
            }

            node.log(`Controller disconnecting...`);
            node.emit(STATE.EVENT_NAME, STATE.DISCONNECTED);
        });
    }
    RED.nodes.registerType('openhab-v2-controller', OpenHABControllerNode);

    /**
     * openhab-v2-events
     * 
     * Monitors OpenHAB events
     *
     */
    function OpenHABEvents(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var openHABController = RED.nodes.getNode(config.controller);
        node.name = config.name;
        node.eventSource = openHABController.getEventSource();
        node.disabledNodeStates = [ STATE.CONNECTING, STATE.CONNECTED, STATE.DISCONNECTED ];

        /* 
         * Node methods
         */

        node.updateNodeStatus = function (state, customMessage = undefined) {
            if (!node.disabledNodeStates || !node.disabledNodeStates.includes(state)) {
                updateNodeStatus(node, state, customMessage);
            }            
        };

        /* 
         * Node initialization
         */

        node.updateNodeStatus(STATE.CONNECTING);
        node.context().set('currentState', undefined);

        /* 
         * Node event handlers
         */

        node.processRawEvent = function (message) {``
            try {
                message = JSON.parse(message.data);
                if (message.payload && (message.payload.constructor === String))
                    message.payload = JSON.parse(message.payload);
                node.send(message);
            } catch (error) {
                node.error('Unexpected Error : ' + error)
                node.status({ fill: 'red', shape: 'dot', text: 'Unexpected Error : ' + error });
            }
        }

        /* 
         * Attach event handlers
         */

        openHABController.addListener(STATE.EVENT_NAME, node.updateNodeStatus);
        openHABController.addListener('RawEvent', node.processRawEvent);

        node.on('close', function () {
            openHABController.removeListener('RawEvent', node.processRawEvent);
            openHABController.removeListener(STATE.EVENT_NAME, node.updateNodeStatus);
        });

    }
    RED.nodes.registerType('openhab-v2-events', OpenHABEvents);

    /**
     * openhab-v2-in
     * 
     * Monitors incomming OpenHAB item events and injects JSON message into node-red flow
     *
     */
    function OpenHABIn(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var openHABController = RED.nodes.getNode(config.controller);
        node.name = config.name;
        node.itemName = config.itemName;
        node.eventSource = openHABController.getEventSource();

        node.log('OpenHABIn, config: ' + JSON.stringify(config));

        /* 
         * Node methods
         */

        node.updateNodeStatus = function (state, customMessage = undefined) {
            if (!node.disabledNodeStates || !node.disabledNodeStates.includes(state)) {
                updateNodeStatus(node, state, customMessage);
            }            
        };

        /* 
         * Node initialization
         */

        node.updateNodeStatus(STATE.CONNECTING);
        node.context().set('currentState', undefined);


        /* 
         * Node event handlers
         */

        node.processRawEvent = function (event) {
            // Send message to node output 2
            var msgid = RED.util.generateId();
            node.send([null, { _msgid: msgid, payload: event, item: node.itemName, event: 'RawEvent' }]);
        }

        node.processStateEvent = function (event) {
            var currentState = node.context().get('currentState');

            if ((event.state != currentState) && (event.state != 'null')) {
                node.context().set('currentState', event.state);

                node.updateNodeStatus(STATE.CURRENT_STATE);
                node.emit(STATE.CURRENT_STATE, `State: ${event.state}`);

                // Send message to node output 1
                var msgid = RED.util.generateId();
                node.send([{ _msgid: msgid, payload: event.state, item: node.itemName, event: 'StateEvent' }, null]);

            }
        }

        /* 
         * Attach event handlers
         */

        openHABController.addListener(STATE.EVENT_NAME, node.updateNodeStatus);
        openHABController.addListener(node.itemName + '/RawEvent', node.processRawEvent);
        openHABController.addListener(node.itemName + '/StateEvent', node.processStateEvent);

        node.on('close', function () {
            openHABController.removeListener(node.itemName + '/StateEvent', node.processStateEvent);
            openHABController.removeListener(node.itemName + '/RawEvent', node.processRawEvent);
            openHABController.removeListener(STATE.EVENT_NAME, node.updateNodeStatus);
        });
    }
    RED.nodes.registerType('openhab-v2-in', OpenHABIn);

    /**
     * openhab-v2-out
     * 
     * Allow to send a predefind or incomming message as a command to OpenHAB
     *
     */
    function OpenHABOut(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var openHABController = RED.nodes.getNode(config.controller);
        node.name = config.name;
        node.itemName = config.itemName;
        node.disabledNodeStates = [ STATE.CONNECTING, STATE.CONNECTED, STATE.DISCONNECTED ];

        /* 
         * Node methods
         */

        node.updateNodeStatus = function (state, customMessage = undefined) {
            if (!node.disabledNodeStates || !node.disabledNodeStates.includes(state)) {
                updateNodeStatus(node, state, customMessage);
            }            
        };

        /* 
         * Node initialization
         */

        node.updateNodeStatus(STATE.IDLE);
        node.context().set('currentState', undefined);


        /* 
         * Node event handlers
         */

        /* 
         * Attach event handlers
         */

        openHABController.addListener(STATE.EVENT_NAME, node.updateNodeStatus);

        node.on('input', function (message) {
            // If the node has an item, topic and/or payload configured it will override what was sent in via incomming message
            var item = (config.itemName && config.itemName.length) ? config.itemName : message.item;
            var topic = (config.topic && config.topic.length) ? config.topic : message.topic;
            var payload = (config.payload && config.payload.length) ? config.payload : message.payload;

            if (item && topic && payload) {
                openHABController.send(item, topic, payload);
            }
            else {
                node.updateNodeStatus(STATE.NO_PAYLOAD);
            }
        });

        node.on('close', function () {
            openHABController.removeListener(STATE.EVENT_NAME, node.updateNodeStatus);
        });
    }
    RED.nodes.registerType('openhab-v2-out', OpenHABOut);
}