import {makeSparkStore} from '@ciscospark/spark-core';
import StorageAdapterLocalStorage from '@ciscospark/storage-adapter-local-storage';
import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';
import uuid from 'uuid';
import Device from '../..';

describe(`plugin-wdm`, () => {
  describe(`shared storage`, () => {
    describe(`Device`, () => {
      let d, s1, s2;
      const mockStorage = {
        getItem() {
          return d;
        },
        setItem(key, value) {
          d = value;
        },
        clear() {
          d = undefined;
        }
      };

      beforeEach(() => {
        d = undefined;
      });

      function makeSparks(logger) {
        s1 = new MockSpark({
          children: {
            device: Device
          },
          initialize: function init() {
            if (logger) {
              this.logger = logger;
            }
            else {
              this.logger = {
                error: sinon.spy(),
                warn: sinon.spy(),
                log: sinon.spy(),
                info: sinon.spy(),
                debug: sinon.spy()
              };
            }
            this.boundedStorage = makeSparkStore(`bounded`, this);
          },
          config: {
            storage: {
              boundedAdapter: new StorageAdapterLocalStorage(`test`, mockStorage)
            },
            device: {}
          }
        });

        s2 = new MockSpark({
          children: {
            device: Device
          },
          initialize: function init() {
            if (logger) {
              this.logger = logger;
            }
            else {
              this.logger = {
                error: sinon.spy(),
                warn: sinon.spy(),
                log: sinon.spy(),
                info: sinon.spy(),
                debug: sinon.spy()
              };
            }

            this.boundedStorage = makeSparkStore(`bounded`, this);
          },
          config: {
            storage: {
              boundedAdapter: new StorageAdapterLocalStorage(`test`, mockStorage)
            },
            device: {}
          }
        });
      }

      describe(`#register()`, () => {
        it(`produces multiple registrations when called by multiple instances`, () => {
          d = undefined;
          makeSparks();

          const url1 = `http://example.com/${uuid.v4()}`;
          const url2 = `http://example.com/${uuid.v4()}`;

          s1.request.returns(Promise.resolve({
            statusCode: 201,
            body: {
              url: url1
            }
          }));

          s2.request.returns(Promise.resolve({
            statusCode: 201,
            body: {
              url: url2
            }
          }));

          return Promise.all([
            s1.device.register(),
            s1.device.when(`store:@`),
            s2.device.register(),
            s2.device.when(`store:@`)
          ])
            .then(() => {
              assert.equal(s1.device.url, url1);
              assert.equal(s2.device.url, url2);
              assert.deepEqual(JSON.parse(d), {
                Device: {
                  '@': {
                    services: {},
                    url: url2,
                    features: {
                      developer: [],
                      entitlement: [],
                      user: []
                    }
                  }
                }
              });
            });
        });
      });

      describe(`#initialize()`, () => {
        it(`always grabs the most recent entry from storage`, () => {
          const url = `http://example.com/${uuid.v4()}`;
          d = JSON.stringify({
            Device: {
              '@': {
                services: {},
                url,
                features: {
                  developer: [],
                  entitlement: [],
                  user: []
                }
              }
            }
          });
          makeSparks();

          return Promise.all([
            s1.when(`loaded`)
              .then(() => {
                assert.equal(s1.device.url, url);
              }),
            s2.when(`loaded`)
              .then(() => {
                assert.equal(s2.device.url, url);
              })
          ]);
        });
      });
    });
  });
});
