/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import AmpState from 'ampersand-state';
import {oneFlight, tap} from '@ciscospark/common';
import {isObject, omit} from 'lodash';
import util from 'util';
import FeaturesModel from './features-model';
import {persist, waitForValue, SparkPlugin} from '@ciscospark/spark-core';

const Device = SparkPlugin.extend({
  // children: {
  //   features: FeaturesModel
  // },

  idAttribute: `url`,

  namespace: `Device`,

  props: {
    // deviceType doesn't have any real value, but we need to send it during
    // device refresh to make sure we don't get back an ios device url
    deviceType: `string`,
    intranetInactivityDuration: `number`,
    intranetInactivityCheckUrl: `string`,
    modificationTime: `string`,
    searchEncryptionKeyUrl: `string`,
    services: {
      // Even though @jodykstr will tell you the docs claim you don't need to
      // initialize `object` properties, the docs lie.
      default() {
        return {};
      },
      type: `object`
    },
    url: `string`,
    userId: `string`,
    webSocketUrl: `string`
  },

  derived: {
    registered: {
      deps: [`url`],
      fn() {
        return Boolean(this.url);
      }
    }
  },

  session: {
    // Fun Fact: setTimeout returns a Timer object instead of a Number in Node 6
    logoutTimer: `any`,
    lastUserActivityDate: `number`,
    features: `object`
  },

  @waitForValue(`@`)
  determineService(url) {
    for (const key of Object.keys(this.services)) {
      const serviceUrl = this.services[key];
      if (url.startsWith(serviceUrl)) {
        // "ServiceUrl" is 10 characters
        return Promise.resolve(key.substr(0, key.length - 10));
      }
    }

    return Promise.reject(new Error(`${url} does not reflect a known service`));
  },

  @waitForValue(`@`)
  getServiceUrl(service) {
    return this._getServiceUrl(this.services, service)
      .then((isServiceUrl) => isServiceUrl || this.getPreDiscoveryServiceUrl(service));
  },

  getPreDiscoveryServiceUrl(service) {
    // The Promise.resolve here is temporary. A future PR will make the
    // corresponding _ method async to allow for lazy device registration
    return Promise.resolve(this._getServiceUrl(this.config.preDiscoveryServices, service));
  },

  @persist
  initialize(...args) {
    Reflect.apply(SparkPlugin.prototype.initialize, this, args);

    this.listenToAndRun(this, `change:intranetInactivityCheckUrl`, () => this._resetLogoutTimer());
    this.listenToAndRun(this, `change:intranetInactivityDuration`, () => this._resetLogoutTimer());
    this.listenTo(this.spark, `user-activity`, () => {this.lastUserActivityDate = Date.now();});
  },

  /**
   * Don't log the features object
   * @param {number} depth
   * @returns {Object}
   */
  inspect(depth) {
    return util.inspect(omit(this.serialize(), `features`), {depth});
  },

  isPreDiscoveryService(service) {
    // The Promise.resolve here is temporary. A future PR will make the
    // corresponding _ method async to allow for lazy device registration
    return Promise.resolve(this._isService(this.config.preDiscoveryServices, service));
  },

  isPreDiscoveryServiceUrl(uri) {
    // The Promise.resolve here is temporary. A future PR will make the
    // corresponding _ method async to allow for lazy device registration
    return Promise.resolve(this._isServiceUrl(this.config.preDiscoveryServices, uri));
  },

  @waitForValue(`@`)
  isService(service) {
    return this._isService(this.services, service)
      .then((_isService) => _isService || this.isPreDiscoveryService(service));
  },

  @waitForValue(`@`)
  isServiceUrl(uri) {
    // The Promise.resolve here is temporary. A future PR will make the
    // corresponding _ method async to allow for lazy device registration
    return Promise.resolve(this._isServiceUrl(this.services, uri));
  },

  @waitForValue(`@`)
  isSpecificService(service, key) {
    if (key === service) {
      return Promise.resolve(true);
    }

    return this.getServiceUrl(service)
      .then((serviceUrl) => key.includes(serviceUrl));
  },

  _getServiceUrl(target, service) {
    /* istanbul ignore if */
    if (!target) {
      return Promise.reject(new Error(`\`target\` is a required parameter`));
    }

    if (!service) {
      return Promise.reject(new Error(`\`service\` is a required parameter`));
    }

    return Promise.resolve(target[`${service}ServiceUrl`]);
  },

  _isService(target, service) {
    return this._getServiceUrl(target, service)
      .then((url) => Boolean(url));
  },

  _isServiceUrl(target, uri) {
    if (!uri) {
      return Promise.reject(new Error(`\`uri\` is a required parameter`));
    }

    for (const key in target) {
      if (target[key] && uri.indexOf(target[key]) === 0) {
        return Promise.resolve(true);
      }
    }

    return Promise.resolve(false);
  },

  @oneFlight
  @waitForValue(`@`)
  refresh() {
    const start = window.performance.now();
    this.logger.info(`device: refreshing`);

    if (!this.registered) {
      this.logger.info(`device: device not registered, refreshing`);
      return this.register();
    }

    this.logger.info(`device: refreshing`);

    return this.request({
      method: `PUT`,
      uri: this.url,
      body: omit(this.serialize(), `features`, `mediaClusters`)
    })
      .then((res) => this._processRegistrationSuccess(res))
      .catch((reason) => {
        if (reason.statusCode === 404) {
          // If we get a 404, it means the device is no longer valid and we need
          // to register a new one.
          this.logger.info(`device: refresh failed with 404, attempting to register new device`);
          this.clear();
          return this.register();
        }
        return Promise.reject(reason);
      })
      .then(tap(() => {
        console.log(`XXX refresh time`, window.performance.now() - start);
      }));
  },

  @oneFlight
  @waitForValue(`@`)
  register() {
    const start = window.performance.now();
    /* eslint no-invalid-this: [0] */
    this.logger.info(`device: registering`);

    if (this.registered) {
      this.logger.info(`device: device already registered, refreshing`);
      return this.refresh();
    }

    return this.request({
      method: `POST`,
      service: `wdm`,
      resource: `devices`,
      body: this.config.defaults
    })
      .then((res) => this._processRegistrationSuccess(res))
      .then(tap(() => {
        console.log(`XXX register time`, window.performance.now() - start);
      }));
  },

  @oneFlight
  @waitForValue(`@`)
  unregister() {
    this.logger.info(`device: unregistering`);

    if (!this.url) {
      this.logger.warn(`device: not registered`);
      return Promise.resolve();
    }

    return this.request({
      uri: this.url,
      method: `DELETE`
    })
      .then(() => this.clear());
  },

  _processRegistrationSuccess(res) {
    this.logger.info(`device: received registration payload`);
    this.set(res.body);
  },

  _resetLogoutTimer() {
    clearTimeout(this.logoutTimer);
    this.unset(`logoutTimer`);
    if (this.config.enableInactivityEnforcement && this.intranetInactivityCheckUrl && this.intranetInactivityDuration) {
      this.on(`change:lastUserActivityDate`, () => this._resetLogoutTimer());

      const timer = setTimeout(() => {
        this.spark.request({
          method: `GET`,
          uri: this.intranetInactivityCheckUrl
        })
          .catch(() => {
            this.logger.info(`device: did not reach internal ping endpoint; logging out after inactivity on a public network`);
            return this.spark.logout();
          })
          .catch((reason) => {
            this.logger.warn(`device: logout failed`, reason);
          });
      }, this.intranetInactivityDuration * 1000);

      this.logoutTimer = timer;
    }
  },

  set(key, value, options) {
    let attrs;
    // Handle both `"key", value` and `{key: value}` -style arguments.
    // The next block is a direct copy from ampersand-state, so no need to test
    // both scenarios.
    /* istanbul ignore next */
    if (isObject(key) || key === null) {
      attrs = key;
      options = value;
    }
    else {
      attrs = {};
      attrs[key] = value;
    }

    if (attrs.features) {
      attrs.features = this.parseFeatures(attrs.features, options);
    }
    return Reflect.apply(AmpState.prototype.set, this, [attrs, options]);
  },


  parseFeatures(attrs) {
    Object.keys(attrs).forEach((type) => {
      attrs[type] = attrs[type].map(this.parseFeature);
    });
  },

  parseFeature(feature) {
    const num = Number(feature.val);
    if (feature.val && !Number.isNaN(num)) {
      // Handle numbers.
      feature.value = num;
      feature.type = `number`;
    }
    // Handle booleans.
    else if (feature.val === `true`) {
      feature.value = true;
      feature.type = `boolean`;
    }
    else if (feature.val === `false`) {
      feature.value = false;
      feature.type = `boolean`;
    }
    // It must be a string, so return it.
    else {
      feature.value = feature.val;
      feature.type = `string`;
    }

    return feature;
  }
});

export default Device;
