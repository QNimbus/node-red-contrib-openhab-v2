/*

OpenHAB nodes for IBM's Node-Red
https://github.com/QNimbus/node-red-contrib-openhab2
(c) 2020, Bas van Wetten <bas.van.wetten@gmail.com>

MIT License

Copyright (c) 2020 B. van Wetten

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

/* eslint-env mocha */

/**
 * Imports
 */

const helper = require('node-red-node-test-helper');
const nock = require('nock');
const sinon = require('sinon');
const OpenHABNodeController = require('../../nodes/openhab-v2-controller.js');

/**
 * Local imports
 */

const STATES = require('../../nodes/includes/states');

/**
 * Initialize and configure
 */

const scope = 'https://localhost/rest';

const name = 'Test';
const host = 'localhost';
const port = 443;
const protocol = 'https';
const username = 'test';
const password = 'test';

const credentials = { controllerNode: { username, password } };

const controllerNode = {
  id: 'controllerNode',
  type: 'openhab-v2-controller',
  checkCertificate: true,
  name,
  protocol,
  host,
  port
};

nock.disableNetConnect();
helper.init(require.resolve('node-red'));

describe('OpenHAB Controller Node', function() {
  before(function(done) {
    helper.startServer(done);
  });

  beforeEach(function() {
    nock(scope)
      .get('/events')
      .reply(200);
  });

  after(function(done) {
    helper.stopServer(done);
    nock.cleanAll();
  });

  afterEach(function() {
    helper.unload();
  });

  /**
   * Tests
   */

  it('should be loaded', function(done) {
    const flow = [{ ...controllerNode }];

    helper.load(OpenHABNodeController, flow, function() {
      const controllerNode = helper.getNode('controllerNode');

      try {
        controllerNode.should.have.property('name', name);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  it('should have credentials', function(done) {
    const flow = [{ ...controllerNode }];

    helper.load(OpenHABNodeController, flow, credentials, function() {
      const controllerNode = helper.getNode('controllerNode');

      try {
        controllerNode.credentials.should.have.property('username', username);
        controllerNode.credentials.should.have.property('password', password);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  // it("should emit 'CONNECTED' event", function(done) {
  //   const flow = [{ ...controllerNode }];

  //   this.timeout(5000);

  //   setTimeout(() => {
  //     done(new Error('connection failed'));
  //   }, 2000);

  //   helper.load(OpenHABNodeController, flow, function() {
  //     const controllerNode = helper.getNode('controllerNode');
  //     controllerNode.on('EVENTSOURCE_STATE', state => {
  //       if (state === STATES.EVENTSOURCE_STATE_TYPE.CONNECTED) {
  //         done();
  //       }
  //     });
  //   });
  // });
});
