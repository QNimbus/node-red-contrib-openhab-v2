# node-red-contrib-openhab-v2

![alt text](https://raw.githubusercontent.com/QNimbus/node-red-contrib-openhab-v2/master/node-red-openhab-v2.png)

## Description

Nodes facilitating automation of *OpenHAB* ( <http://www.openhab.org> ) items with Node-RED ( <http://nodered.org> ).

## Installation

```
$ cd ~/.node-red
$ npm install node-red-contrib-openhab-v2
```

## Nodes

##### - openhab-v2-controller

Configuration node for communication with an OpenHAB controller.

*Configuration:*
- Name : Specify a name for the configuration node
- Protocol : "http" or "https"
- Host : Specify the hostname or ip address
- Port : (Optionally) Specify the ip port
- Path : (Optionally) Specify the additional base path
- Username : (Optionally) Specify the username to authenticate
- Password : (Optionally) Specify the password to authenticate
- Raw events : Enables/disabled the emitting of raw events (currently disabled, see [issue #1](https://github.com/QNimbus/node-red-contrib-openhab-v2/issues/1))

##### - openhab-v2-events

Listens to events on the OpenHAB eventbus.

*Configuration:*
- Name : (Optionally) Specify a name
- Controller : OpenHAB controller to use for monitoring events
- Item(s): (Optionally) Specify items to watch

*Messages injected in NodeRED flows (1 output channel):*

Output:
- <kbd>msg.topic</kbd> : Topic of the event (e.g. *smarthome/items/MyItemName/state*)
- <kbd>msg.payload</kbd> : State of the event item
- <kbd>msg.type</kbd> : Message type (e.g. *ItemStateEvent*, *ItemStateChangeEvent*, *ItemCommandEvent*, etc)

##### - openhab-v2-in

Listens to state changes of a selected OpenHAB Item. Will only watch for selected event types for the 1st output channel. The 2nd channel (Raw events) are all passed into the flow without filtering for specific event types.

*Configuration:*
- Name : (Optionally) Specify a name
- Controller : OpenHAB controller to use for monitoring item(s)
- Item name : Item to monitor
- Even types : Listen to the selected event types.
- Startup output : Whether or not to emit state at start of flow.
- Store state : Store the item state in the flow context

*Messages injected in NodeRED flows (2 output channels):*

Output 1 (StateEvent):
- <kbd>msg.item</kbd> : Item name
- <kbd>msg.topic</kbd> : "StateEvent"
- <kbd>msg.payload</kbd> : New state of the selected item

Output 2 (RawEvent):
- <kbd>msg.item</kbd> : Item name
- <kbd>msg.topic</kbd> : "RawEvent"
- <kbd>msg.payload</kbd> :  Raw (unprocessed) event of the selected item

##### - openhab-v2-out

Output a message to the openab-v2-controller. Can use an incomming message which can be overridden by the configured parameters on the node itself.

*Configuration:*
- Name : (Optionally) Specify a name
- Controller : Select OpenHAB controller
- Item name : (Optionally) Item to send message to
- Topic : (Optionally) Topic to use for message (e.g. *ItemCommand* or *ItemUpdate*)
- Payload : (Optionally) Payload to use for message (e.g. *ON*, *OFF*, *50*, etc)

*Messages injected in NodeRED flows (1 input channel):*

Input:
- <kbd>msg.item</kbd> : Item name
- <kbd>msg.topic</kbd> : (Optionally) "*ItemCommand*" or "*ItemUpdate*"
- <kbd>msg.payload</kbd> : (Optionally) State to send to the item

##### - openhab-v2-get

Fetch item state information based on incomming message payload. Can be overriden by the configured item on the node itself.

*Configuration:*
- Name : (Optionally) Specify a name
- Controller : Select OpenHAB controller
- Item name : (Optionally) Item to send message to

*Messages injected in NodeRED flows (1 input, 1 output channel):*

Input:
- <kbd>msg.item</kbd> : (Optionally) Item name (can be overriden by node config)

Output:
- <kbd>msg.payload</kbd> : State information of the item
- <kbd>msg.payload_in</kbd> : Copy of the incomming message

##### - openhab-v2-proxy

A common technique in OpenHAB is to use a proxy item to switch/operate a single or multiple real items with some added logic. This node facilitates that desgin
pattern by allowing the user to specify a single proxy item and one or more linked items. The user can configure the node to update both the proxy item and the linked items
in case either one of them receives a command. It's also possible to update in a single direction. (e.g. update proxy in case items receive a command or the other way around)

*Configuration:*
- Name : (Optionally) Specify a name
- Controller : Select OpenHAB controller
- Direction : Select the direction to send updates (item(s) to proxy, proxy to item(s) or both ways)
- Item(s): Specify item(s) to link to proxy item
- Proxy item : Specify the proxy item
- Store state : Store the proxy item state in the flow context