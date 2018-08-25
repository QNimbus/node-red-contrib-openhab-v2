# node-red-contrib-openhab-v2

![alt text](https://cdn.rawgit.com/QNimbus/node-red-contrib-openhab-v2/326f229a/node-red-openhab-v2.png)

## Description

Nodes facilitating automation of *OpenHAB* ( <http://www.OpenHAB.org> ) items with Node-RED ( <http://nodered.org> ).

## Installation

```
$ cd ~/.node-red
$ npm install node-red-contrib-OpenHAB-v2
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

*Messages injected in NodeRED flows (1 output channel):*

Channel 1:
- <kbd>msg.topic</kbd> : Topic of the event (e.g. *smarthome/items/MyItemName/state*)
- <kbd>msg.payload</kbd> : State of the event item
- <kbd>msg.type</kbd> : Message type (e.g. *ItemStateEvent*, *ItemStateChangeEvent*, *ItemCommandEvent*, etc)

##### - openhab-v2-in

Listens to state changes of a selected OpenHAB Item.

*Configuration:*
- Name : (Optionally) Specify a name
- Controller : OpenHAB controller to use for monitoring item(s)
- Item name : Item to monitor

*Messages injected in NodeRED flows (2 output channels):*

Channel 1:
- <kbd>msg.item</kbd> : Item name
- <kbd>msg.topic</kbd> : "StateEvent"
- <kbd>msg.payload</kbd> : New state of the selected item

Channel 2:
- <kbd>msg.item</kbd> : Item name
- <kbd>msg.topic</kbd> : "RawEvent"
- <kbd>msg.payload</kbd> :  Raw (unprocessed) event of the selected item

##### - openhab-v2-out

Output a message to the openab-v2-controller. Can use an incomming message which can be overridden by the configured parameters on the node itself.

*Configuration:*
- Name :(Optionally) Specify a name
- Controller : Select OpenHAB controller
- Item name : (Optionally) Item to send message to
- Topic : (Optionally) Topic to use for message (e.g. *ItemCommand* or *ItemUpdate*)
- Payload : (Optionally) Payload to use for message (e.g. *ON*, *OFF*, *50*, etc)

*Messages injected in NodeRED flows (1 input channel):*

Channel 1:
- <kbd>msg.item</kbd> : Item name
- <kbd>msg.topic</kbd> : (Optionally) "*ItemCommand*" or "*ItemUpdate*"
- <kbd>msg.payload</kbd> : (Optionally) State to send to the item
