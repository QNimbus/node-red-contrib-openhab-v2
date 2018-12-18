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
var THINGS_PATH = '/rest/things/';

var STATE = {
    EVENT_NAME: 'state',
    CONNECTING: 1,
    CONNECTED: 2,
    DISCONNECTED: 3,
    CURRENT_STATE: 4,
    IDLE: 5,
    NO_PAYLOAD: 6,
    ARMED: 7,
    DISARMED: 8,
    TRIGGERED: 9,
    TRIGGERED_DISARMED: 10,
    OK: 20,
    WARN: 98,
    ERROR: 99
};

var STATE_MSG = {
    CONNECTING: 'Connecting',
    CONNECTED: 'Connected',
    DISCONNECTED: 'Disconnected',
    IDLE: '',
    NO_PAYLOAD: 'No payload specified',
    NO_TOPIC: 'No topic specified',
    ARMED: 'Armed',
    DISARMED: 'Disarmed',
    TRIGGERED: 'Triggered',
    TRIGGERED_DISARMED: 'Triggered',
    OK: 'Ok',
    WARN: 'Warning',
    ERROR: 'Error'
}

var PROXY_DIR = {
    ITEM_TO_PROXY: 1,
    PROXY_TO_ITEM: 2,
    BOTH: 3,
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

        if (controller && controller instanceof OpenHAB_controller_node) {
            controller.getItemList(function (items) {
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
            case STATE.NO_TOPIC: {
                node.status({ fill: 'red', shape: 'ring', text: customMessage ? customMessage : STATE_MSG.NO_TOPIC });
                break;
            }
            case STATE.ARMED: {
                node.status({ fill: 'blue', shape: 'dot', text: customMessage ? customMessage : STATE_MSG.ARMED });
                break;
            }
            case STATE.DISARMED: {
                node.status({ fill: 'blue', shape: 'ring', text: customMessage ? customMessage : STATE_MSG.DISARMED });
                break;
            }
            case STATE.TRIGGERED: {
                node.status({ fill: 'red', shape: 'dot', text: customMessage ? customMessage : STATE_MSG.TRIGGERED });
                break;
            }
            case STATE.TRIGGERED_DISARMED: {
                node.status({ fill: 'red', shape: 'ring', text: customMessage ? customMessage : STATE_MSG.TRIGGERED_DISARMED });
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
            case STATE.WARN: {
                node.status({ fill: 'yellow', shape: 'dot', text: customMessage ? customMessage : STATE_MSG.WARN });
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
    /**
     *
     *
     * @param {*} config
     */
    function OpenHAB_controller_node(config) {
        RED.nodes.createNode(this, config);

        var globalContext = this.context().global;
        var node = this;
        var itemList = globalContext.get('openhab-v2-itemlist');
        node.name = config.name;
        node.allowRawEvents = config.allowRawEvents;
        node._eventSource = undefined;
        node.itemList = itemList ? itemList : undefined;
        node._thingList = undefined;
        node._url = undefined;

        // Temporary workaround for issue #3 (https://github.com/QNimbus/node-red-contrib-openhab-v2/issues/3)
        node.setMaxListeners(50);

        /**
         * node.request
         * 
         */
        node.request = function (urlpart, options, callback) {
            options.uri = node.getURL() + urlpart;
            options.rejectUnauthorized = false;
            node.log(`Requesting URI ${options.uri} with method ${options.method}`);
            request(options, callback);
        }

        /**
         * node.send
         * 
         *
         */
        node.send = function (itemName, topic, payload, successCallback = undefined, failCallback = undefined) {
            var url = node.getURL() + `${ITEMS_PATH}${itemName}`;

            switch (topic) {
                case 'ItemUpdate': {
                    url += '/state';
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

            method({ url: url, body: String(payload), strictSSL: false }, function (error, response, body) {
                if (error) {
                    var errorMessage = `Error occurred, check NodeRED log for details`;

                    node.emit(STATE.EVENT_NAME, STATE.ERROR, errorMessage);
                    if (failCallback && typeof failCallback === 'function') {
                        failCallback({ 'message': errorMessage, 'error': error, 'url': url });
                    }
                }
                else if (!(200 <= response.statusCode && response.statusCode <= 210)) {
                    var body = JSON.parse(response.body);

                    node.emit(STATE.EVENT_NAME, STATE.ERROR, body.error.message);
                    if (failCallback && typeof failCallback === 'function') {
                        failCallback({ 'message': errorMessage, 'error': response, 'url': url });
                    }
                } else {
                    if (successCallback && typeof successCallback === 'function') {
                        successCallback(JSON.parse(body));
                    }
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
            if (url === undefined || url.prototype !== String) {
                if (config.protocol)
                    url = config.protocol;
                else
                    url = 'http';

                url += '://';

                if (config.username != undefined && (config.username.trim().length != 0)) {
                    url += config.username.trim();

                    if ((config.password != undefined) && (config.password.length != 0)) {
                        url += ':' + config.password;
                    }
                    url += '@';
                }
                url += config.host;

                if (config.port != undefined && (config.port.trim().length != 0)) {
                    url += ':' + config.port.trim();
                }

                if (config.path != undefined && (config.path.trim().length != 0)) {
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
         * getItemList
         * 
         * Accepts a callback function that will either receive NULL in case of error or a sorted JSON item list from OpenHAB
         *
         */
        node.getItemList = function (callback, forceRefresh = false) {
            // Sort of singleton construct
            if (forceRefresh || node.itemList === undefined) {
                var options = {
                    method: 'GET',
                    json: true,
                }

                node.request(ITEMS_PATH, options, function (error, response, body) {
                    if (error) {
                        node.itemList = undefined;
                    } else {
                        node.itemList = body;
                        globalContext.set('openhab-v2-itemlist', body);
                    }
                    node.log(`Refreshing itemlist.....`);
                    callback(node.itemList);
                });
            } else {
                node.log(`Using cached itemlist....`);
                callback(node.itemList);
            }
        }

        /**
         * getSceneItemList
         * 
         * Accepts a callback function that will either receive NULL in case of error or a sorted JSON scene item list from OpenHAB
         *
         */
        node.getSceneItemList = function (callback, forceRefresh = false) {
            var filterSceneItems = function (itemList) {

                // Create regex expressions to filter out item tags specific to Scene items
                var tagFilterItem = new RegExp('openhab-v2-scene\:item(?:$|\:(.*)$)');
                var tagFilterIncludeItem = new RegExp('openhab-v2-scene\:include\:(.*)$');
                var tagFilterTopic = new RegExp('openhab-v2-scene\:topic\:(.*)$');

                // Perform actual filtering
                var sceneItems = itemList.filter((item) => {
                    try {
                        var tags = item.tags.filter((tag) => tag.match(tagFilterItem));
                        return (tags.length === 1);
                    } catch (e) {
                        // If array element is not a valid OpenHAB item just filter the item out.
                        return false;
                    }

                });

                // Add properties to items using item tags
                for (var i = 0; i < sceneItems.length; i++) {
                    for (var j = 0; j < sceneItems[i].tags.length; j++) {
                        var matchTagFilterItem = sceneItems[i].tags[j].match(tagFilterItem);
                        var matchTagFilterIncludeItem = sceneItems[i].tags[j].match(tagFilterIncludeItem);
                        var matchTagFilterTopic = sceneItems[i].tags[j].match(tagFilterTopic);

                        !sceneItems[i].sceneItem && matchTagFilterItem && 1 in matchTagFilterItem && matchTagFilterItem[1] != '' && (sceneItems[i].sceneItem = matchTagFilterItem[1]);
                        !sceneItems[i].sceneIncludeItem && matchTagFilterIncludeItem && 1 in matchTagFilterIncludeItem && matchTagFilterIncludeItem[1] != '' && (sceneItems[i].sceneIncludeItem = matchTagFilterIncludeItem[1]);
                        !sceneItems[i].sceneItemTopic && matchTagFilterTopic && 1 in matchTagFilterTopic && matchTagFilterTopic[1] != '' && (sceneItems[i].sceneItemTopic = matchTagFilterTopic[1]);
                    };
                };

                // Convert to JSON object
                var sceneItemsObject = {};
                sceneItems.forEach((value, index, array) => {
                    if (!sceneItemsObject[value.name]) {
                        sceneItemsObject[value.name] = value;
                    }
                });

                return sceneItemsObject;
            }

            // Sort of singleton construct
            if (forceRefresh || node.itemList === undefined) {
                var options = {
                    method: 'GET',
                    json: true,
                }

                node.request(ITEMS_PATH, options, function (error, response, body) {
                    if (error) {
                        node.itemList = undefined;
                    } else {
                        node.itemList = body;
                        globalContext.set('openhab-v2-itemlist', body);
                    }
                    node.log(`Refreshing itemlist.....`);
                    callback(filterSceneItems(node.itemList));
                });
            } else {
                node.log(`Using cached itemlist....`);
                callback(filterSceneItems(node.itemList));
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
                            }, 10000);
                            break;
                        }
                        case 200: {
                            body.forEach(function (item) {
                                node.emit(item.name + '/ItemStateEvent', { item: item.name, type: 'ItemStateEvent', state: item.state });
                            });
                            break;
                        }
                        default: {
                            node.emit(STATE.EVENT_NAME, STATE.ERROR);
                            node.warn(`Response error ${response.statusCode} on ${url}: JSON.stringify(response)`);
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
         * onOpen event handler for eventSource watcher. Notifies all other nodes that the OpenHAB_controller_node has connected succesfully
         *
         */
        node.onOpen = function () {
            node.emit(STATE.EVENT_NAME, STATE.CONNECTED);
            node.getItemStates();
        }

        /**
         * node.onError
         * 
         * onError event handler for eventSource watcher. Notifies all other nodes that the OpenHAB_controller_node has experienced an error
         *
         */
        node.onError = function (error) {
            try {
                var errorMessage = `Unable to connect: ${error.type} on ${node._eventSource.url}`;

                node.log(util.inspect(error));

                node._eventSource.removeAllListeners();
                node._eventSource.close();

                node.emit(STATE.EVENT_NAME, STATE.ERROR, errorMessage);
                delete node._eventSource;

                setTimeout(function () {
                    node.getEventSource();
                }, 30000);
            } catch (error) {
                var errorMessage = `Unable to connect: ${JSON.stringify(error)} on ${node._eventSource.url}`;

                node._eventSource.removeAllListeners();
                node._eventSource.close();

                node.emit(STATE.EVENT_NAME, STATE.ERROR, errorMessage);
                delete node._eventSource;
                node.error(util.inspect(error));
            }
        }

        /**
         * node.onMessage
         * 
         * onMessage event handler for eventSource watcher. Parses event messages and emits appropriate events through the OpenHAB_controller_node
         * to be listened to by the other nodes
         *
         */
        node.onMessage = function (message) {
            try {
                var parsedMessage = message;
                var itemStart = 16; // 'smarthome/items/';
                parsedMessage = JSON.parse(parsedMessage.data);
                parsedMessage.payload = JSON.parse(parsedMessage.payload);

                var itemName = parsedMessage.topic.substring(itemStart, parsedMessage.topic.indexOf('/', itemStart));

                if (node.allowRawEvents === true) {
                    node.emit('RawEvent', message);
                    node.emit(itemName + '/RawEvent', message);
                }
                node.emit(itemName + `/${parsedMessage.type}`, { item: itemName, type: parsedMessage.type, state: parsedMessage.payload.value, payload: parsedMessage.payload });
            } catch (error) {
                var errorMessage = `Error parsing message: ${error} - ${util.inspect(message)}`;

                node.log(`event: ${itemName + `/${parsedMessage.type}`}`);
                node.log(`message: ${util.inspect({ item: itemName, type: parsedMessage.type, state: parsedMessage.payload.value, payload: parsedMessage.payload })}`);

                node.emit(STATE.EVENT_NAME, STATE.ERROR, errorMessage);
                node.error(`Unexpected Error: ${errorMessage}`);
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
            if (!eventSource || !(eventSource instanceof EventSource)) {
                var eventSourceInitDict = { rejectUnauthorized: false, https: { checkServerIdentity: false, rejectUnauthorized: false } };
                var url = node.getURL() + EVENTS_PATH + '?topics=smarthome/items';

                node.log(`Controller attempting to connect to: ${url}`);
                eventSource = new EventSource(url, eventSourceInitDict);

                // Temporary workaround for issue #3 (https://github.com/QNimbus/node-red-contrib-openhab-v2/issues/3)
                eventSource.setMaxListeners(50);

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

            if (callbacks.hasOwnProperty('onError') && typeof callbacks.onError === 'function') {
                eventSource.on('error', callbacks.onError);
            }

            node._eventSource = eventSource;
            return node._eventSource;
        }

        /* 
         * Node event handlers
         */

        /**
         * OpenHAB_controller_node close event handler
         * 
         * Cleanup for when the OpenHAB_controller_node gets closed
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
    RED.nodes.registerType('openhab-v2-controller', OpenHAB_controller_node);

    /**
     * openhab-v2-events
     * 
     * Monitors OpenHAB events
     *
     */
    function OpenHAB_events(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var openHABController = RED.nodes.getNode(config.controller);

        if (!openHABController) {
            return;
        }

        node.name = config.name;
        node.eventSource = openHABController.getEventSource();
        node.items = config.items.filter(String);
        node.disabledNodeStates = [STATE.CONNECTING, STATE.CONNECTED, STATE.DISCONNECTED];

        /* 
         * Node methods
         */

        node.updateNodeStatus = function (state, customMessage = undefined) {
            if (!node.disabledNodeStates || !node.disabledNodeStates.includes(state)) {
                updateNodeStatus(node, state, customMessage);
            } else {
                node.status({});
            }
        };

        /* 
         * Node initialization
         */

        node.updateNodeStatus(STATE.CONNECTING);
        node.context().set('currentState', undefined);
        node.tzOffset = (new Date()).getTimezoneOffset() * 60000;

        /* 
         * Node event handlers
         */

        node.processRawEvent = function (event) {
            try {
                var sendevent = true;
                var topicRegex = new RegExp('^smarthome\/(?:items|things)\/([^\/]+).*$');

                event = JSON.parse(event.data);
                event.timestamp = config.ohCompatibleTimestamp === true ? (new Date(Date.now() - node.tzOffset)).toISOString().slice(0, -1) : Date.now();

                if (event.payload && (event.payload.constructor === String))
                    event.payload = JSON.parse(event.payload);

                if (node.items !== null && node.items.length > 0) {
                    var matches = topicRegex.exec(event.topic);

                    if (matches === null || (matches.length > 0 && node.items.indexOf(matches[1])) < 0) {
                        sendevent = false;
                    }
                }

                if (sendevent) {
                    node.send(event);
                }
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
            node.log(`closing`);
        });

    }
    RED.nodes.registerType('openhab-v2-events', OpenHAB_events);

    /**
     * openhab-v2-in
     * 
     * Monitors incomming OpenHAB item events and injects JSON message into node-red flow
     *
     */
    function OpenHAB_in(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var openHABController = RED.nodes.getNode(config.controller);
        var firstMessage = true;

        if (!openHABController) {
            return;
        }

        node.name = config.name;
        node.item = config.item;
        node.outputAtStartup = config.outputAtStartup;
        node.storeStateInFlow = config.storeStateInFlow;
        node.eventTypes = config.eventTypes.filter(String);
        node.eventSource = openHABController.getEventSource();
        node.disabledNodeStates = [STATE.CONNECTING, STATE.CONNECTED, STATE.DISCONNECTED];

        /* 
         * Node methods
         */

        node.updateNodeStatus = function (state, customMessage = undefined) {
            if (!node.disabledNodeStates || !node.disabledNodeStates.includes(state)) {
                updateNodeStatus(node, state, customMessage);
            } else {
                node.status({});
            }
        };

        /* 
         * Node initialization
         */

        node.updateNodeStatus(STATE.CONNECTING);
        node.context().set('currentState', undefined);
        node.tzOffset = (new Date()).getTimezoneOffset() * 60000;

        /* 
         * Node event handlers
         */

        node.processRawEvent = function (event) {
            // Send message to node output 2
            var msgid = RED.util.generateId();
            node.send([null, { _msgid: msgid, payload: event, item: node.item, event: 'RawEvent' }]);
        }

        node.processStateEvent = function (event) {
            try {
                var currentState = node.context().get('currentState');
                var sendMessage = true;

                if (event.state != 'null') {
                    if (node.eventTypes.indexOf(event.type) < 0) {
                        sendMessage = false;
                    }

                    if (sendMessage || (firstMessage && node.outputAtStartup && event.type === 'ItemStateEvent')) {
                        // Send message to node output 1
                        var msgid = RED.util.generateId();
                        var timestamp = config.ohCompatibleTimestamp === true ? (new Date(Date.now() - node.tzOffset)).toISOString().slice(0, -1) : Date.now();
                        var message = { _msgid: msgid, payload: event.state, data: event.payload, item: node.item, event: event.type, timestamp: timestamp };

                        node.send([message, null]);
                    }

                    firstMessage = false;

                    node.context().set('currentState', event.state);
                    node.updateNodeStatus(STATE.CURRENT_STATE, `State: ${event.state}`);

                    if (node.storeStateInFlow === true) {
                        node.context().flow.set(`${node.item}_state`, event.state)
                    }
                }
            } catch (error) {
                node.error('Unexpected Error : ' + error)
                node.status({ fill: 'red', shape: 'dot', text: 'Unexpected Error : ' + error });
            }
        }

        /* 
         * Attach event handlers
         */

        openHABController.addListener(STATE.EVENT_NAME, node.updateNodeStatus);
        openHABController.addListener(node.item + '/RawEvent', node.processRawEvent);
        ['ItemCommandEvent', 'ItemStateEvent', 'ItemStateChangedEvent', 'GroupItemStateChangedEvent'].forEach(function (eventType) {
            openHABController.addListener(node.item + `/${eventType}`, node.processStateEvent);
        });

        node.on('close', function () {
            ['ItemCommandEvent', 'ItemStateEvent', 'ItemStateChangedEvent', 'GroupItemStateChangedEvent'].forEach(function (eventType) {
                openHABController.removeListener(node.item + `/${eventType}`, node.processStateEvent);
            });
            openHABController.removeListener(node.item + '/RawEvent', node.processRawEvent);
            openHABController.removeListener(STATE.EVENT_NAME, node.updateNodeStatus);
            node.log(`closing`);
        });
    }
    RED.nodes.registerType('openhab-v2-in', OpenHAB_in);

    /**
     * openhab-v2-out
     * 
     * Allow to send a predefind or incomming message as a command to OpenHAB
     *
     */
    function OpenHAB_out(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var openHABController = RED.nodes.getNode(config.controller);

        if (!openHABController) {
            return;
        }

        node.name = config.name;
        node.item = config.item;
        node.storeStateInFlow = config.storeStateInFlow;
        node.eventSource = openHABController.getEventSource();
        node.disabledNodeStates = [STATE.CONNECTING, STATE.CONNECTED, STATE.DISCONNECTED];

        /* 
         * Node methods
         */

        node.updateNodeStatus = function (state, customMessage = undefined) {
            if (!node.disabledNodeStates || !node.disabledNodeStates.includes(state)) {
                updateNodeStatus(node, state, customMessage);
            } else {
                node.status({});
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

        node.on('input', function (message) {
            // If the node has an item, topic and/or payload configured it will override what was sent in via incomming message
            var item = config.item ? config.item : message.item;
            var topic = config.topic;
            var topicType = config.topicType;
            var payload = config.payload;
            var payloadType = config.payloadType;

            switch (topicType) {
                case 'msg': {
                    topic = message[topic];
                    break;
                }
                case 'str':
                case 'oh_cmd':
                default: {
                    // Keep selected topic
                    break;
                }
            }

            switch (payloadType) {
                case 'msg': {
                    payload = message[payload];
                    break;
                }
                case 'flow':
                case 'global': {
                    RED.util.evaluateNodeProperty(payload, payloadType, this, message, function (error, result) {
                        if (error) {
                            node.error(error, message);
                        } else {
                            payload = result;
                        }

                    });
                    break;
                }
                case 'date': {
                    payload = Date.now();
                    break;
                }
                case 'num':
                case 'str':
                default: {
                    // Keep selected payload
                    break;
                }
            }

            if (item && topic) {
                if (payload !== undefined) {
                    openHABController.send(item, topic, payload, null, null);
                } else {
                    node.updateNodeStatus(STATE.NO_PAYLOAD);
                }
            }
            else {
                node.updateNodeStatus(STATE.NO_TOPIC);
            }
        });

        node.processStateEvent = function (event) {
            node.context().set('currentState', event.state);
            node.updateNodeStatus(STATE.CURRENT_STATE, `State: ${event.state}`);

            if (node.storeStateInFlow === true) {
                node.context().flow.set(`${node.item}_state`, event.state)
            }
        }

        /* 
         * Attach event handlers
         */

        openHABController.addListener(STATE.EVENT_NAME, node.updateNodeStatus);
        openHABController.addListener(`${node.item}/ItemStateEvent`, node.processStateEvent);

        node.on('close', function () {
            openHABController.removeListener(`${node.item}/ItemStateEvent`, node.processStateEvent);
            openHABController.removeListener(STATE.EVENT_NAME, node.updateNodeStatus);
            node.log(`closing`);
        });
    }
    RED.nodes.registerType('openhab-v2-out', OpenHAB_out);

    /**
     * openhab-v2-get
     * 
     * Allow to send a predefind or incomming message as a command to OpenHAB
     *
     */
    function OpenHAB_get(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var openHABController = RED.nodes.getNode(config.controller);

        if (!openHABController) {
            return;
        }

        node.name = config.name;
        node.item = config.item;
        node.disabledNodeStates = [STATE.CONNECTING, STATE.CONNECTED, STATE.DISCONNECTED];

        /* 
         * Node methods
         */

        node.updateNodeStatus = function (state, customMessage = undefined) {
            if (!node.disabledNodeStates || !node.disabledNodeStates.includes(state)) {
                updateNodeStatus(node, state, customMessage);
            } else {
                node.status({});
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

        node.on('input', function (message) {
            var item = config.item ? config.item : message.item;

            function success(body) {
                try {
                    var outMessage = RED.util.cloneMessage(message);
                    outMessage.payload_in = message.payload;
                    outMessage.payload = body;
                    node.send(outMessage);
                    node.updateNodeStatus(STATE.CURRENT_STATE, `State: ${outMessage.payload.state}`);
                } catch (e) {
                    // Unable to parse message
                }
            }

            function fail(errorMessage) {
                node.warn(errorMessage);
            }

            openHABController.send(item, null, null, success, fail);
        });

        openHABController.addListener(STATE.EVENT_NAME, node.updateNodeStatus);

        node.on('close', function () {
            openHABController.removeListener(STATE.EVENT_NAME, node.updateNodeStatus);
            node.log(`closing`);
        });
    }
    RED.nodes.registerType('openhab-v2-get', OpenHAB_get);

    /**
     * openhab-v2-proxy
     * 
     * Description
     *
     */
    function OpenHAB_proxy(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var openHABController = RED.nodes.getNode(config.controller);
        var firstMessage = true;

        if (!openHABController) {
            return;
        }

        node.name = config.name;
        node.item = config.item;
        node.itemPostfix = config.itemPostfix;
        node.proxyItem = config.proxyItem;
        node.proxyDirection = config.proxyDirection;
        node.storeStateInFlow = config.storeStateInFlow;
        node.eventSource = openHABController.getEventSource();
        node.disabledNodeStates = [STATE.CONNECTING, STATE.CONNECTED, STATE.DISCONNECTED];

        /* 
         * Node methods
         */

        node.updateNodeStatus = function (state, customMessage = undefined) {
            if (!node.disabledNodeStates || !node.disabledNodeStates.includes(state)) {
                updateNodeStatus(node, state, customMessage);
            } else {
                node.status({});
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

        node.on('input', function (message) {
            var item = node.proxyItem;
            var topic = config.topic;
            var topicType = config.topicType;
            var payload = config.payload;
            var payloadType = config.payloadType;

            switch (topicType) {
                case 'msg': {
                    topic = message[topic];
                    break;
                }
                case 'str':
                case 'oh_cmd':
                default: {
                    // Keep selected topic
                    break;
                }
            }

            switch (payloadType) {
                case 'msg': {
                    payload = message[payload];
                    break;
                }
                case 'flow':
                case 'global': {
                    RED.util.evaluateNodeProperty(payload, payloadType, this, message, function (error, result) {
                        if (error) {
                            node.error(error, message);
                        } else {
                            payload = result;
                        }

                    });
                    break;
                }
                case 'date': {
                    payload = Date.now();
                    break;
                }
                case 'num':
                case 'str':
                default: {
                    // Keep selected payload
                    break;
                }
            }

            if (item && topic) {
                if (payload !== undefined) {
                    openHABController.send(item, topic, payload, null, null);
                } else {
                    node.updateNodeStatus(STATE.NO_PAYLOAD);
                }
            }
            else {
                node.updateNodeStatus(STATE.NO_TOPIC);
            }
        });

        node.processStateEvent = function (event) {
            node.context().set(`currentState_${event.item}`, event.state);

            if (event.item === node.proxyItem) {
                node.updateNodeStatus(STATE.CURRENT_STATE, `State: ${event.state}`);

                if (node.storeStateInFlow === true) {
                    node.context().flow.set(`${node.proxyItem}_state`, event.state)
                }
            }
        }

        node.itemUpdate = function (event) {
            var item = node.proxyItem;
            var topic = 'ItemUpdate';
            var payload = event.state;

            if (item && topic && payload) {
                if (node.context().get(`currentState_${item}`) !== payload) {
                    node.context().set(`currentState_${item}`, payload);
                    node.log(`Sending ${topic}:${payload} to ${item}`);
                    openHABController.send(item, topic, payload, null, null);
                }
            }
            else {
                node.updateNodeStatus(STATE.NO_PAYLOAD);
            }
        }

        node.proxyUpdate = function (event) {
            var topic = 'ItemCommand';
            var payload = event.state;

            if (topic && payload) {
                if (node.context().get(`currentState_${node.item}`) !== payload) {
                    openHABController.send(node.item, topic, payload, null, null);
                }
            }
            else {
                node.updateNodeStatus(STATE.NO_PAYLOAD);
            }
        }

        /* 
         * Attach event handlers
         */

        if (node.proxyDirection & PROXY_DIR.ITEM_TO_PROXY) {
            if (node.proxyDirection & PROXY_DIR.BOTH) {
                // Item -> Proxy item
                openHABController.addListener(`${node.item}${node.itemPostfix}/ItemStateChangedEvent`, node.itemUpdate);
            } else {
                // Item -> Proxy item
                openHABController.addListener(`${node.item}/ItemStateChangedEvent`, node.itemUpdate);
            }
        }

        if (node.proxyDirection & PROXY_DIR.PROXY_TO_ITEM) {
            // Item <- Proxy item
            openHABController.addListener(`${node.proxyItem}/ItemCommandEvent`, node.proxyUpdate);
        }

        openHABController.addListener(STATE.EVENT_NAME, node.updateNodeStatus);
        openHABController.addListener(`${node.proxyItem}/ItemStateEvent`, node.processStateEvent);
        openHABController.addListener(`${node.item}/ItemStateEvent`, node.processStateEvent);

        node.on('close', function () {
            if (node.proxyDirection & PROXY_DIR.ITEM_TO_PROXY) {
                if (node.proxyDirection & PROXY_DIR.BOTH) {
                    // Item -> Proxy item
                    openHABController.removeListener(`${node.item}${node.itemPostfix}/ItemStateChangedEvent`, node.itemUpdate);
                } else {
                    // Item -> Proxy item
                    openHABController.removeListener(`${node.item}/ItemStateChangedEvent`, node.itemUpdate);
                }
            }

            if (node.proxyDirection & PROXY_DIR.PROXY_TO_ITEM) {
                // Item <- Proxy item
                openHABController.removeListener(`${node.proxyItem}/ItemCommandEvent`, node.proxyUpdate);
            }

            openHABController.removeListener(`${node.item}/ItemStateEvent`, node.processStateEvent);
            openHABController.removeListener(`${node.proxyItem}/ItemStateEvent`, node.processStateEvent);
            openHABController.removeListener(STATE.EVENT_NAME, node.updateNodeStatus);
            node.log(`closing`);
        });
    }
    RED.nodes.registerType('openhab-v2-proxy', OpenHAB_proxy);

    /**
     * openhab-v2-trigger
     * 
     * ...
     *
     */
    function OpenHAB_trigger(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var openHABController = RED.nodes.getNode(config.controller);

        node.triggerItems = config.triggerItems.filter(String);                                 // Trigger item(s) that will trigger the node
        node.eventSource = openHABController ? openHABController.getEventSource() : undefined;  // Evensource object for connecting to the OpenHAB instance
        node.triggered = false;                                                                 // Keep track of trigger state

        // Disable node if no controller or no trigger items were defined
        if (!openHABController || !node.eventSource || node.triggerItems.length === 0) {
            return;
        }

        // Comparator functions for trigger condition
        node.comparators = {
            'eq': function (a, b) {
                return a == b;
            },
            'neq': function (a, b) {
                return a != b;
            },
            'lt': function (a, b) {
                return a < b;
            },
            'lte': function (a, b) {
                return a <= b;
            },
            'gt': function (a, b) {
                return a > b;
            },
            'gte': function (a, b) {
                return a >= b;
            },
        };

        // Node statuses that will not be displayed
        node.disabledNodeStates = [STATE.CONNECTING, STATE.CONNECTED, STATE.DISCONNECTED];

        /* 
         * Node methods
         */

        node.triggerItemsTriggered = function (excludeItem = undefined) {
            return node.triggerItems.some((triggerItem) => {
                if (excludeItem !== undefined && excludeItem === triggerItem) {
                    return false;
                } else {
                    return node.context().get(triggerItem) ? true : false;
                }
            })
        }

        // Compile additional conditions
        node.additionalConditions = function () {
            return config.conditions.every((condition) => {
                var comparator = node.comparators[condition.type];
                var value1 = node.getTypeInputValue(condition.typeValue1, condition.value1);
                var value2 = node.getTypeInputValue(condition.typeValue2, condition.value2);

                return comparator(value1, value2);
            });
        }

        node.triggerItemsConditions = function (triggerItem, state) {
            var triggerItemCondition = config.triggerItemsConditions.find(x => x.triggerItem === triggerItem);
            var comparator = node.comparators[triggerItemCondition.type];
            var value = node.getTypeInputValue(triggerItemCondition.valueType, triggerItemCondition.value);

            return comparator(value, state);
        }

        node.getTypeInputValue = function (type, value) {
            switch (type) {
                case 'flow': {
                    value = node.context().flow.get(value);
                    break;
                }
                case 'global': {
                    value = node.context().global.get(value);
                    break;
                }
                case 'date': {
                    value = Date.now();
                    break;
                }
                case 'num': {
                    value = parseFloat(value);
                    break;
                }
                case 'nothing': {
                    value = undefined;
                    break;
                }
                case 'oh_payload':
                case 'str':
                default: {
                    value = String(value);
                    break;
                }
            };
            return value;
        }

        node.updateNodeStatus = function (state, customMessage = undefined) {
            if (!node.disabledNodeStates || !node.disabledNodeStates.includes(state)) {
                updateNodeStatus(node, state, customMessage);
            } else {
                node.status({});
            }
        };

        node.getTimerValue = function () {
            if (config.advancedTimerToggle === true) {
                return node.getTypeInputValue(config.advancedTimerType, config.advancedTimer);
            } else {
                switch (config.timerUnits) {
                    case 'milliseconds': {
                        return config.timer;
                    }
                    case 'minutes': {
                        return config.timer * (60 * 1000);
                    }
                    case 'hours': {
                        return config.timer * (60 * 60 * 1000);
                    }
                    default: {
                        return config.timer * (1000);
                    }
                }
            }
        }

        /* 
         * Node initialization
         */

        node.triggerArmedState = config.triggerArmedState !== 'item' ? config.triggerArmedState === 'armed' : false;

        node.updateNodeStatus(STATE.CONNECTING);
        node.context().set('triggered', false);
        node.context().set('currentState', false);
        node.context().set('armed', node.triggerArmedState);

        node.tzOffset = (new Date()).getTimezoneOffset() * 60000;

        // Initialize armed status on node
        node.eventSource.on('open', () => {
            node.updateNodeStatus(node.context().get('armed') ? STATE.ARMED : STATE.DISARMED);
        })

        /* 
         * Node event handlers
         */

        node.armDisarm = function (message) {
            var armed = !['OFF', 0, '0', 'CLOSED', 'NULL'].includes(message.state);
            var changed = armed !== node.context().get('armed');

            // If armed state has not changed, return immediately
            if (!changed) {
                return;
            }

            if (!armed) {
                // Reset trigger
                node.context().set('triggered', false);
                node.context().set('currentState', false);
                if (config.cancelTimerWhenDisarmed) {
                    clearTimeout(node.timerObject);
                    delete node.timerObject;
                }
            }

            // Persist armed state
            node.context().set('armed', armed);

            // Update node status
            node.updateNodeStatus(armed ? STATE.ARMED : STATE.DISARMED);
        }

        config.enableInput && node.on('input', function (message) {
            if (message.payload === 'RESET') {
                setImmediate(() => {
                    var armed = node.context().get('armed');

                    // Set arm/disarm state
                    if (node.armDisarmTrigger !== false) {
                        node.armDisarm(node.armDisarmTrigger === 'arm' ? { state: 'ON' } : { state: 'OFF' });
                    } else {
                        node.updateNodeStatus(armed ? STATE.ARMED : STATE.DISARMED);
                    }

                    // Reset trigger
                    node.context().set('triggered', false);
                    node.context().set('currentState', false);
                    if (config.cancelTimerWhenDisarmed) {
                        clearTimeout(node.timerObject);
                        delete node.timerObject;
                    }
                });
            } else {
                message.state = message.payload;
                node.armDisarm(message);
            }
        });

        node.processStateChangedEvent = function (message) {
            var armed = node.context().get('armed');
            var triggerCondition = node.triggerItemsConditions(message.item, message.state);

            var sendMessage = function (topic, topicType, payload, payloadType) {
                topic = node.getTypeInputValue(topicType, topic);
                payload = node.getTypeInputValue(payloadType, payload);

                if (topic) {
                    var msgid = RED.util.generateId();
                    var timestamp = config.ohCompatibleTimestamp === true ? (new Date(Date.now() - node.tzOffset)).toISOString().slice(0, -1) : Date.now();
                    var message = { _msgid: msgid, payload: payload, topic: topic, timestamp: timestamp };

                    if (config.outputs > 1) {
                        node.send([armed ? message : null, message]);
                    } else {
                        node.send([armed ? message : null]);
                    }
                }
            };

            // Determine if arm/disarm status needs to be changed after trigger has fired (config option)
            node.armDisarmTrigger = config.armDisarm === 'arm' || config.armDisarm === 'disarm' ? config.armDisarm : false;

            // Test for trigger condition and additional conditions
            node.triggerCondition = triggerCondition;
            node.context().set(message.item, node.triggerCondition);

            // Optionally store trigger item and current state in flow variable
            if (config.storeStateInFlow === true) {
                node.context().flow.set(`${message.item}_state`, message.state)
            }

            // If trigger is not armed and we're not using a second output, return immediately
            if (!armed && config.outputs < 2) {
                return;
            }

            if (node.triggerCondition) {
                var additionalConditions = node.additionalConditions();
                // If trigger condition is true
                if (node.context().get('currentState') || additionalConditions) {
                    // Send message only after initial trigger
                    if (!node.context().get('currentState')) {
                        sendMessage(config.topic, config.topicType, config.payload, config.payloadType);
                    }

                    // Set/Reset triggered state (recheck additionalConditions when config option was selected)
                    if (config.triggerAdditionalConditions === 'every' ? additionalConditions : true) {
                        node.context().set('triggered', true);
                        node.context().set('currentState', true);
                        node.updateNodeStatus(armed ? STATE.TRIGGERED : STATE.TRIGGERED_DISARMED);
                    } else {
                        // Otherwise, reset trigger and return to armed/disarmed state according to config
                        node.context().set('triggered', false);

                        // Set arm/disarm state
                        if (node.armDisarmTrigger !== false) {
                            node.armDisarm(node.armDisarmTrigger === 'arm' ? { state: 'ON' } : { state: 'OFF' });
                        } else {
                            node.updateNodeStatus(armed ? STATE.ARMED : STATE.DISARMED);
                        }

                        // Stop further execution
                        return;
                    }
                } else {
                    // Stop further execution
                    return;
                }
            } else {
                // If trigger condition is false
                if (node.context().get('currentState')) {
                    // If trigger condition was previously true....
                    if (node.context().get('triggered') && !node.triggerItemsTriggered(message.item)) {
                        // Reset trigger
                        node.context().set('triggered', false);

                        // Set arm/disarm state
                        if (node.armDisarmTrigger !== false) {
                            node.armDisarm(node.armDisarmTrigger === 'arm' ? { state: 'ON' } : { state: 'OFF' });
                        } else {
                            node.updateNodeStatus(armed ? STATE.ARMED : STATE.DISARMED);
                        }
                    }
                } else {
                    // Stop further execution
                    return;
                }
            }

            // Then
            switch (config.afterTrigger) {
                case 'nodelay':
                case 'timer': {
                    var timerValue = node.getTimerValue() || 1000;
                    var delayFunction = function () {
                        var armed = node.context().get('armed');
                        var triggered = node.context().get('triggered');

                        clearTimeout(node.timerObject);
                        delete node.timerObject;

                        if (config.afterTrigger === 'timer' && config.timerExpiresAction === 'if_false_reset' && triggered && armed) {
                            node.timerObject = setTimeout(delayFunction, timerValue);
                        } else {
                            sendMessage(config.topicEnd, config.topicEndType, config.payloadEnd, config.payloadEndType);

                            // Reset trigger
                            node.context().set('currentState', false);

                            // Set arm/disarm state
                            if (node.armDisarmTrigger !== false) {
                                node.armDisarm(node.armDisarmTrigger === 'arm' ? { state: 'ON' } : { state: 'OFF' });
                            } else {
                                node.updateNodeStatus(armed ? STATE.ARMED : STATE.DISARMED);
                            }
                        }
                    }

                    if (node.context().get('triggered') && (config.timerExpiresAction === 'if_false_reset' || !node.timerObject)) {
                        clearTimeout(node.timerObject);
                        delete node.timerObject;
                        node.timerObject = config.afterTrigger === 'nodelay' ? setImmediate(delayFunction) : setTimeout(delayFunction, timerValue);
                    }
                    break;
                }
                case 'untrigger': {
                    if (node.context().get('currentState') && !node.context().get('triggered')) {
                        node.context().set('currentState', false);
                        sendMessage(config.topicEnd, config.topicEndType, config.payloadEnd, config.payloadEndType);
                    }
                    break;
                }
                default:
                case 'nothing': {
                    // Reset trigger
                    node.context().set('currentState', false);

                    // Set arm/disarm state
                    if (node.armDisarmTrigger !== false) {
                        node.armDisarm(node.armDisarmTrigger === 'arm' ? { state: 'ON' } : { state: 'OFF' });
                    } else {
                        node.updateNodeStatus(armed ? STATE.ARMED : STATE.DISARMED);
                    }
                    break;
                }
            }
        }

        /* 
         * Attach event handlers
         */

        openHABController.addListener(STATE.EVENT_NAME, node.updateNodeStatus);
        config.triggerArmedState === 'item' && openHABController.addListener(`${config.triggerArmedItem}/ItemStateEvent`, node.armDisarm);
        node.triggerItems.forEach(function (triggerItem) {
            openHABController.addListener(triggerItem + `/ItemStateChangedEvent`, node.processStateChangedEvent);
            openHABController.addListener(triggerItem + `/GroupItemStateChangedEvent`, node.processStateChangedEvent);
        });

        node.on('close', function () {
            node.triggerItems.forEach(function (triggerItem) {
                openHABController.removeListener(triggerItem + `/ItemStateChangedEvent`, node.processStateChangedEvent);
                openHABController.removeListener(triggerItem + `/GroupItemStateChangedEvent`, node.processStateChangedEvent);
            });
            config.triggerArmedState === 'item' && openHABController.removeListener(`${config.triggerArmedItem}/ItemStateEvent`, node.armDisarm);
            openHABController.removeListener(STATE.EVENT_NAME, node.updateNodeStatus);

            node.log(`closing`);
        });
    }
    RED.nodes.registerType('openhab-v2-trigger', OpenHAB_trigger);

    /**
     * openhab-v2-scene
     * 
     * To do....
     *
     */
    function OpenHAB_scene(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var openHABController = RED.nodes.getNode(config.controller);

        if (!openHABController) {
            return;
        }

        /**
         *
         *
         * @param {*} state
         * @param {*} [customMessage=undefined]
         */
        node.updateNodeStatus = function (state, customMessage = undefined) {
            if (!node.disabledNodeStates || !node.disabledNodeStates.includes(state)) {
                updateNodeStatus(node, state, customMessage);
            } else {
                node.status({});
            }
        };

        /**
         * Calls a callback function with the retrieved sceneConfig as parameter
         *
         * @param {*} sceneItem
         * @param {*} callback
         */
        node.getSceneConfig = function (sceneItem, callback) {
            function success(body) {
                var message, state;

                message = body;

                try {
                    state = JSON.parse(message.state);
                } catch (e) {
                    state = {};
                }

                // If scene has no name, revert to item label or sceneItem name
                state.name = body.name || message.label || sceneItem.label;

                // Call callback function if possible
                if (callback && typeof callback === 'function') {
                    callback(state);
                }
            }

            function fail(errorMessage) {
                node.warn(JSON.stringify(errorMessage, null, 2));
            }

            openHABController.send(sceneItem.name, null, null, success, fail);
        }

        // To configure a scene in a sitemap to the following:
        //
        // - For every item that you can/want to configure in a scene, create a new item of the same type and tag it with 'openhab-v2-scene:item:[Item Name]'
        //   e.g. If you have a switch called GF_Living_Dimmer_Spotlights_TableLights, you use the tag 'node-red-openhab-v2-scene:item:GF_Living_Dimmer_Spotlights_TableLights'
        //   on the scene config item.
        //
        //  Switch      SceneConf_GF_Living_Dimmer_Spotlights_TableLights   [openhab-v2-scene:item:GF_Living_Dimmer_Spotlights_TableLights]
        //
        // - A scene item is a JSON object with an 'items' array which contain all the items that are part of the scene. The 'execute' boolean property determines
        //   if an item will be updated/executed when the scene is activated. This will be false for items that are not part of the scene but determine which group of
        //   items will be included in the scene. (So called Scene Include Items, e.g. 'SceneConf_Include_GF')
        // 
        // {
        //     "items": [
        //          {
        //             "name": "GF_Living_Dimmer_Spotlights_TableLights",
        //             "configItem": "SceneConf_GF_Living_Dimmer_Spotlights_TableLights",
        //             "payload": "25",
        //             "topic": "ItemCommand",
        //             "execute": true,
        //          },
        //      ],
        //   }
        //

        /**
         * Executes a scene passed in function argument. Expects a JSON object with an 'items' array containing the scene items.
         *
         * @param {*} sceneConfig
         * @returns
         */
        node.execute = function (sceneConfig) {
            if (!sceneConfig || !sceneConfig.hasOwnProperty('items') || !Array.isArray(sceneConfig.items)) return false;

            for (const [index, item] of sceneConfig.items.entries()) {
                if (!item.execute || !item.name || !item.payload) continue;
                node.log(`Sending ${item.topic || 'ItemCommand'} '${item.payload}' to item ${item.name}}`)
                openHABController.send(item.name, item.topic || 'ItemCommand', item.payload);
            }
            return true;
        }

        /**
         * Loads a scene config
         *
         * @param {*} sceneConfig
         * @returns
         */
        node.clear = function (sceneItemList, fullReset = false) {
            if (fullReset) {
                ['SceneConf_Action', 'SceneConf_EditScene', 'SceneConf_CloneScene', 'SceneConf_ExecuteScene', 'SceneConf_StatusMessage'].forEach((itemName) => {
                    openHABController.send(itemName, 'ItemUpdate', '');
                });
            }

            Object.keys(sceneItemList).forEach((sceneItemKey) => {
                var sceneItem = sceneItemList[sceneItemKey];
                var type = sceneItem.hasOwnProperty('groupType') ? sceneItem.groupType : sceneItem.type;
                var payload = 'NULL';

                //console.log(JSON.stringify(sceneItemList[sceneItemKey], null, 2));
                switch (type.toUpperCase()) {
                    case 'SWITCH': {
                        payload = 'OFF';
                        break;
                    }
                    case 'DIMMER': {
                        payload = '0';
                    }
                    default: {
                        break;
                    }
                }
                openHABController.send(sceneItem.name, 'ItemUpdate', payload);
            });
        };

        /**
         * Loads a scene config
         *
         * @param {*} sceneConfig
         * @returns
         */
        node.load = function (sceneConfig) {
            if (!sceneConfig || !sceneConfig.hasOwnProperty('items') || !Array.isArray(sceneConfig.items)) return false;

            sceneConfig.items.forEach((item) => {
                // Ignore items without payload (or NULL/UNDEF) and items where configItem is not defined
                if (!item.configItem || !item.payload || ['NULL', 'UNDEF'].includes(item.payload)) return;

                openHABController.send(item.configItem, 'ItemUpdate', item.payload);
            });
            return true;
        }

        /**
         * Saves a scene config
         *
         * @param {*} sceneConfig
         * @param {*} sceneItem
         * @returns
         */
        node.save = function (sceneConfig, sceneItem) {
            if (!sceneConfig || !sceneConfig.hasOwnProperty('items') || !Array.isArray(sceneConfig.items)) return false;

            openHABController.send(sceneItem.name, 'ItemUpdate', JSON.stringify(sceneConfig), null, null);
            return true;
        }

        /**
         * Learns a scene config
         *
         * @param {*} sceneConfig
         * @returns
         */
        node.learn = function (sceneConfig) {
            openHABController.getItemList((itemList) => {
                sceneConfig.items.forEach((sceneItem) => {
                    if (!sceneItem.configItem) return;

                    var item = itemList.find(obj => {
                        return obj.name === sceneItem.name;
                    });

                    if (item) {
                        openHABController.send(sceneItem.configItem, 'ItemUpdate', item.state);
                    }
                });
            });
        }

        /**
         * Fetches all scene config items and generates a JSON object with an items array to store the scene. Calls a callback function with the newly
         * constructed JSON object as it's parameter.
         *
         * @param {*} callback
         * @param {*} [filter=undefined]
         */
        node.generateSceneConfig = function (sceneItem, callback, getAll = false, filter = undefined) {
            openHABController.getSceneItemList((itemList) => {
                var sceneConfig = {};

                sceneConfig.items = new Array();

                sceneConfig.name = sceneItem.label;

                Object.keys(itemList).forEach((itemName) => {
                    if (filter === undefined || filter(itemList[itemName])) {
                        var item = itemList[itemName];

                        // Ignore group items and items that have an includeItem that is switched OFF
                        if (item.type !== 'Group' && (getAll || !item.sceneIncludeItem || itemList[item.sceneIncludeItem].state === 'ON')) {
                            sceneConfig.items.push({ 'name': item.sceneItem || item.name, 'configItem': item.name, 'topic': item.sceneItemTopic, 'payload': item.state, 'execute': item.sceneItem ? true : false });
                        }
                    }
                });
                callback(sceneConfig);
            }, true);
        }

        /* 
         * Node initialisation
         */

        openHABController.getSceneItemList(node.clear);

        /* 
         * Node event handlers
         */

        node.on('input', function (message) {
            // Action is required
            if (!message.hasOwnProperty('action')) {
                // Update node status
                node.updateNodeStatus(STATE.WARN, `No action specified...`);

                // Reset node status message after 2 seconds
                setTimeout(node.updateNodeStatus, 2000, STATE.IDLE);
                return;
            }
            if (!message.hasOwnProperty('sceneItem')) {
                // Update node status
                node.updateNodeStatus(STATE.WARN, `No scene specified...`);

                // Reset node status message after 2 seconds
                setTimeout(node.updateNodeStatus, 2000, STATE.IDLE);
                return;
            }

            var performAction = function (sceneItem) {
                switch (message.action.toUpperCase()) {
                    // Execute stored scene
                    case 'EXECUTE':
                    case 'EXEC': {
                        // Callback that gets called with sceneConfig object fetched by 'node.getSceneConfig'
                        var executeCallback = function (sceneConfig) {
                            var success = typeof sceneConfig.name === 'string' && sceneConfig.name.length > 0 && node.execute(sceneConfig);

                            // Update node status
                            success && node.updateNodeStatus(STATE.OK, `Executed scene '${sceneConfig.name}'`);

                            // Reset node status message after 2 seconds
                            success && setTimeout(node.updateNodeStatus, 2000, STATE.IDLE);
                        }

                        node.getSceneConfig(sceneItem, executeCallback);

                        break;
                    }
                    // Load a stored scene
                    case 'LOAD': {
                        // Callback that gets called with sceneConfig object fetched by 'node.getSceneConfig'
                        var loadCallback = function (sceneConfig) {
                            var success = typeof sceneConfig.name === 'string' && sceneConfig.name.length > 0 && node.load(sceneConfig);

                            // Update node status
                            success && node.updateNodeStatus(STATE.OK, `Loaded scene '${sceneConfig.name}'`);

                            // Reset node status message after 2 seconds
                            success && setTimeout(node.updateNodeStatus, 2000, STATE.IDLE);
                        }
                        node.getSceneConfig(sceneItem, loadCallback);

                        break;
                    }
                    case 'RESET': {
                        var clearCallback = function (sceneItemList) {
                            node.clear(sceneItemList);

                            // Update node status
                            node.updateNodeStatus(STATE.OK, `Resetting scene items`);

                            // Reset node status message after 2 seconds
                            setTimeout(node.updateNodeStatus, 2000, STATE.IDLE);
                        }
                        openHABController.getSceneItemList(clearCallback);

                        break;
                    }
                    case 'STORE':
                    case 'SAVE': {
                        var saveCallback = function (sceneConfig) {
                            var success = typeof sceneConfig.name === 'string' && sceneConfig.name.length > 0 && node.save(sceneConfig, sceneItem);

                            // Update node status
                            success && node.updateNodeStatus(STATE.OK, `Saved scene '${sceneConfig.name}'`);

                            // Reset node status message after 2 seconds
                            success && setTimeout(node.updateNodeStatus, 2000, STATE.IDLE);
                        }
                        node.generateSceneConfig(sceneItem, saveCallback);

                        break;
                    }
                    case 'LEARN': {
                        // Callback that gets called with sceneConfig object fetched by 'node.getSceneConfig'
                        var learnCallback = function (sceneConfig) {
                            node.learn(sceneConfig);

                            // Update node status
                            node.updateNodeStatus(STATE.OK, `Get current item states into scene config`);

                            // Reset node status message after 2 seconds
                            setTimeout(node.updateNodeStatus, 2000, STATE.IDLE);
                        }
                        node.generateSceneConfig(sceneItem, learnCallback, true);

                        break;
                    }
                    case 'TEST': {
                        // Callback that gets called with sceneConfig object fetched by 'node.getSceneConfig'
                        var testCallback = function (sceneConfig) {
                            // node.test(sceneConfig);

                            // Update node status
                            node.updateNodeStatus(STATE.OK, `Testing scene '${sceneConfig.name}'`);

                            // Reset node status message after 2 seconds
                            setTimeout(node.updateNodeStatus, 2000, STATE.IDLE);
                        }

                        node.getSceneConfig(sceneItem, testCallback);

                        break;
                    }
                    default: {
                        // Update node status
                        node.updateNodeStatus(STATE.WARN, `Unknown action specified...`);

                        // Reset node status message after 2 seconds
                        setTimeout(node.updateNodeStatus, 2000, STATE.IDLE);
                        break;
                    }
                }
            }

            var failed = function () {

            }

            openHABController.send(message.sceneItem, undefined, undefined, performAction, failed);
        });

        openHABController.addListener(STATE.EVENT_NAME, node.updateNodeStatus);
        // node.sceneItem && openHABController.addListener(node.sceneItem + '/ItemStateChangedEvent', node.saveNewSceneConfig);

        node.on('close', function () {
            // node.sceneItem && openHABController.removeListener(node.sceneItem + 'ItemStateChangedEvent', node.saveNewSceneConfig);
            openHABController.removeListener(STATE.EVENT_NAME, node.updateNodeStatus);
            node.log(`closing`);
        });
    }
    RED.nodes.registerType('openhab-v2-scene', OpenHAB_scene);

}