/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {proxyEvents, retry, transferEvents} from '@ciscospark/common';
import {HttpStatusInterceptor, defaults as requestDefaults} from '@ciscospark/http-core';
import {defaults, get, has, isFunction, isString, last, merge, omit} from 'lodash';
import AmpState from 'ampersand-state';
import NetworkTimingInterceptor from './interceptors/network-timing';
import PayloadTransformerInterceptor from './interceptors/payload-transformer';
import RedirectInterceptor from './interceptors/redirect';
import RequestLoggerInterceptor from './interceptors/request-logger';
import RequestTimingInterceptor from './interceptors/request-timing';
import ResponseLoggerInterceptor from './interceptors/response-logger';
import SparkHttpError from './lib/spark-http-error';
import SparkTrackingIdInterceptor from './interceptors/spark-tracking-id';
import config from './config';
import {makeSparkStore} from './lib/storage';
import uuid from 'uuid';
import {EventEmitter} from 'events';

let constructorCalled = false;
const derived = {};
export const children = {};

let Spark;

const interceptors = {
  SparkTrackingIdInterceptor: SparkTrackingIdInterceptor.create,
  /* eslint no-extra-parens: [0] */
  RequestLoggerInterceptor: (process.env.ENABLE_NETWORK_LOGGING || process.env.ENABLE_VERBOSE_NETWORK_LOGGING) ? RequestLoggerInterceptor.create : undefined,
  ResponseLoggerInterceptor: (process.env.ENABLE_NETWORK_LOGGING || process.env.ENABLE_VERBOSE_NETWORK_LOGGING) ? ResponseLoggerInterceptor.create : undefined,
  RequestTimingInterceptor: RequestTimingInterceptor.create,
  UrlInterceptor: undefined,
  AuthInterceptor: undefined,
  PayloadTransformerInterceptor: PayloadTransformerInterceptor.create,
  ConversationInterceptor: undefined,
  RedirectInterceptor: RedirectInterceptor.create,
  HttpStatusInterceptor() {
    return HttpStatusInterceptor.create({
      error: SparkHttpError
    });
  },
  NetworkTimingInterceptor: NetworkTimingInterceptor.create
};

const preInterceptors = [
  `ResponseLoggerInterceptor`,
  `RequestTimingInterceptor`,
  `SparkTrackingIdInterceptor`
];

const postInterceptors = [
  `HttpStatusInterceptor`,
  `NetworkTimingInterceptor`,
  `RequestLoggerInterceptor`
];

/**
 * @class
 * @name SparkCore
 */
const SparkCore = AmpState.extend({
  derived: {
    /**
     * @instance
     * @memberof SparkCore
     * @type {StorageAdapter}
     */
    boundedStorage: {
      deps: [],
      fn() {
        return makeSparkStore(`bounded`, this);
      }
    },
    /**
      * @instance
     * @memberof SparkCore
     * @type {StorageAdapter}
     */
    unboundedStorage: {
      deps: [],
      fn() {
        return makeSparkStore(`unbounded`, this);
      }
    }
  },

  session: {
    /**
     * graph of config data used by SparkCore and its plugins
     * @instance
     * @memberof SparkCore
     * @type {Object}
     */
    config: {
      type: `object`
    },
    /**
     * Entrypoint for making http requests
     * @instance
     * @memberof SparkCore
     * @type {function}
     */
    request: {
      setOnce: true,
      // It's supposed to be a function, but that's not a type defined in
      // Ampersand
      type: `any`
    },
    /**
     * Base token used to assmeble tracking ids for each network requests.
     * Concatenation of config.trackingIdPrefix and a uuid.
     * @instance
     * @memberof SparkCore
     * @readonly
     * @type {Object}
     */
    sessionId: {
      setOnce: true,
      type: `string`
    }
  },

  /**
   * Delegates to the credentials plugin's `authenticate()` method
   * @instance
   * @memberof SparkCore
   * @returns {Promise}
   */
  authenticate(...args) {
    return this.credentials.authenticate(...args);
  },

  /**
   * Delegates to the credentials plugin's `authorize()` method
   * token.
   * @instance
   * @memberof SparkCore
   * @returns {Promise}
   */
  authorize(...args) {
    return this.credentials.authorize(...args);
  },

  /**
   * Delegates to the credentials plugin's `refresh()` method
   * @instance
   * @memberof SparkCore
   * @returns {Promise}
   */
  refresh(...args) {
    return this.credentials.refresh(...args);
  },

  /**
   * Applies the directionally appropriate transforms to the specified object
   * @instance
   * @memberof SparkCore
   * @param {string} direction
   * @param {Object} object
   * @returns {Promise}
   */
  transform(direction, object) {
    const predicates = this.config.payloadTransformer.predicates.filter((p) => !p.direction || p.direction === direction);
    const ctx = {
      spark: this
    };
    return Promise.all(predicates.map((p) => p.test(ctx, object)
      .then((shouldTransform) => {
        if (!shouldTransform) {
          return undefined;
        }
        return p.extract(object)
          // eslint-disable-next-line max-nested-callbacks
          .then((target) => ({
            name: p.name,
            target
          }));
      })))
      .then((data) => data
        .filter((d) => Boolean(d))
        // eslint-disable-next-line max-nested-callbacks
        .reduce((promise, {name, target, alias}) => promise.then(() => {
          if (alias) {
            return this.applyNamedTransform(direction, alias, target);
          }
          return this.applyNamedTransform(direction, name, target);
        }), Promise.resolve()))
      .then(() => object);
  },

  /**
   * Applies the directionally appropriate transform to the specified parameters
   * @instance
   * @memberof SparkCore
   * @param {string} direction
   * @param {Object} ctx
   * @param {string} name
   * @private
   * @returns {Promise}
   */
  applyNamedTransform(direction, ctx, name, ...rest) {
    if (isString(ctx)) {
      rest.unshift(name);
      name = ctx;
      ctx = {
        spark: this,
        transform: (...args) => this.applyNamedTransform(direction, ctx, ...args)
      };
    }

    const transforms = ctx.spark.config.payloadTransformer.transforms.filter((tx) => tx.name === name && (!tx.direction || tx.direction === direction));
    // too many implicit returns on the same line is difficult to interpret
    // eslint-disable-next-line arrow-body-style
    return transforms.reduce((promise, tx) => promise.then(() => {
      if (tx.alias) {
        return ctx.transform(tx.alias, ...rest);
      }
      return Promise.resolve(tx.fn(ctx, ...rest));
    }), Promise.resolve())
      .then(() => last(rest));
  },

  /**
   * @see AmpersandState#initialize
   * @instance
   * @memberof SparkCore
   * @private
   * @returns {SparkCore}
   */
  initialize() {
    this.config = merge({}, config, this.config);

    // Make nested events propagate in a consistent manner
    Object.keys(children).forEach((key) => {
      this.listenTo(this[key], `change`, (...args) => {
        args.unshift(`change:${key}`);
        this.trigger(...args);
      });
    });

    const addInterceptor = (ints, key) => {
      const interceptor = interceptors[key];

      if (!isFunction(interceptor)) {
        return ints;
      }

      ints.push(Reflect.apply(interceptor, this, []));

      return ints;
    };

    let ints = [];
    ints = preInterceptors.reduce(addInterceptor, ints);
    ints = Object.keys(interceptors).filter((key) => !(preInterceptors.includes(key) || postInterceptors.includes(key))).reduce(addInterceptor, ints);
    ints = postInterceptors.reduce(addInterceptor, ints);

    this.request = requestDefaults({
      json: true,
      interceptors: ints
    });

    this.sessionId = `${get(this, `config.trackingIdPrefix`, `spark-js-sdk`)}_${get(this, `config.trackingIdBase`, uuid.v4())}`;
  },

  /**
   * Delegates to the credentials plugin's `refresh()` method
   * @instance
   * @memberof SparkCore
   * @returns {Promise}
   */
  logout(...args) {
    return this.credentials.logout(...args);
  },

  /**
   * General purpose wrapper to submit metrics via the metrics plugin (if the
   * metrics plugin is installed)
   * @instance
   * @memberof SparkCore
   * @returns {Promise}
   */
  measure(...args) {
    if (this.metrics) {
      return this.metrics.sendUnstructured(...args);
    }

    return Promise.resolve();
  },

  /**
   * Uploads a file to using a three-step upload progress. Primarily an internal
   * method to be used by more specific plugin methods.
   * @instance
   * @memberof SparkCore
   * @param {Object} options Similar in syntax to {@link SparkCore#request} but
   * with subtly different semantics. Most options are treated as defaults for
   * each phase and the `phases` property can be used to override properties for
   * each.
   * @param {Object} options.phases Each phase is a hash that overrides
   * top-level options for the specific phase. Keys that begin with a `$` are
   * functions that can be used to compute their value. They receive the session
   * object returned by the initialize phase.
   * @param {Object} options.phases.initialize
   * @param {Object} options.phases.upload
   * @param {Object} options.phases.finalize
   * @private
   * @returns {Promise}
   */
  upload(options) {
    if (!options.file) {
      return Promise.reject(new Error(`\`options.file\` is required`));
    }

    options.phases = options.phases || {};
    options.phases.initialize = options.phases.initialize || {};
    options.phases.upload = options.phases.upload || {};
    options.phases.finalize = options.phases.finalize || {};

    defaults(options.phases.initialize, {
      method: `POST`
    }, omit(options, `file`, `phases`));

    defaults(options.phases.upload, {
      method: `PUT`,
      json: false,
      withCredentials: false,
      body: options.file,
      headers: {
        'x-trans-id': uuid.v4(),
        authorization: undefined
      }
    });

    defaults(options.phases.finalize, {
      method: `POST`
    }, omit(options, `file`, `phases`));

    const shunt = new EventEmitter();

    const promise = this._uploadPhaseInitialize(options)
      .then(() => {
        const p = this._uploadPhaseUpload(options);
        transferEvents(`progress`, p, shunt);
        return p;
      })
      .then((...args) => this._uploadPhaseFinalize(options, ...args))
      .then((res) => res.body);

    proxyEvents(shunt, promise);

    return promise;
  },

  /**
   * @see {@link SparkCore#upload()}
   * @instance
   * @memberof SparkCore
   * @param {Object} options
   * @private
   * @returns {Promise<HttpResponse>}
   */
  _uploadPhaseInitialize: function _uploadPhaseInitialize(options) {
    this.logger.debug(`client: initiating upload session`);

    return this.request(options.phases.initialize)
      .then((...args) => this._uploadApplySession(options, ...args))
      .then((res) => {
        this.logger.debug(`client: initiated upload session`);
        return res;
      });
  },

  /**
   * @see {@link SparkCore#upload()}
   * @instance
   * @memberof SparkCore
   * @param {Object} options
   * @param {HttpResponse} res
   * @private
   * @returns {Promise<HttpResponse>}
   */
  _uploadApplySession(options, res) {
    const session = res.body;
    [`upload`, `finalize`].reduce((opts, key) => {
      opts[key] = Object.keys(opts[key]).reduce((phaseOptions, phaseKey) => {
        if (phaseKey.startsWith(`$`)) {
          phaseOptions[phaseKey.substr(1)] = phaseOptions[phaseKey](session);
          Reflect.deleteProperty(phaseOptions, phaseKey);
        }

        return phaseOptions;
      }, opts[key]);

      return opts;
    }, options.phases);
  },

  /**
   * @see {@link SparkCore#upload()}
   * @instance
   * @memberof SparkCore
   * @param {Object} options
   * @private
   * @returns {Promise<HttpResponse>}
   */
  @retry
  _uploadPhaseUpload(options) {
    this.logger.debug(`client: uploading file`);

    const promise = this.request(options.phases.upload)
      .then((res) => {
        this.logger.debug(`client: uploaded file`);
        return res;
      });

    proxyEvents(options.phases.upload.upload, promise);

    /* istanbul ignore else */
    if (process.env.NODE_ENV === `test`) {
      promise.on(`progress`, (event) => {
        this.logger.log(`upload progress`, event.loaded, event.total);
      });
    }

    return promise;
  },

  /**
   * @see {@link SparkCore#upload()}
   * @instance
   * @memberof SparkCore
   * @param {Object} options
   * @private
   * @returns {Promise<HttpResponse>}
   */
  _uploadPhaseFinalize: function _uploadPhaseFinalize(options) {
    this.logger.debug(`client: finalizing upload session`);

    return this.request(options.phases.finalize)
      .then((res) => {
        this.logger.debug(`client: finalized upload session`);
        return res;
      });
  }
});

/**
 * Part of the plugin system. Creates a SparkCore constructor based on the
 * currently registered plugins.
 * @returns {undefined}
 * @private
 */
function makeSparkConstructor() {
  Spark = SparkCore.extend({
    children,
    derived
  });
}

/**
 * Constructor that returns a SparkCore instance derived from the currently
 * loaded plugins
 * @param {Object} attrs
 * @param {Object} attrs.credentials
 * @param {Object} attrs.config
 * @returns {Spark}
 */
export default function ProxySpark(...args) {
  if (!Spark) {
    makeSparkConstructor();
  }

  constructorCalled = true;

  const spark = new Spark(...args);
  return spark;
}

/**
 * Entrypoint for plugins to register themselves with SparkCore.
 * @method registerPlugin
 * @param {string} name property on spark at which the plugin will be accessed
 * @param {SparkPlugin} Plugin
 * @param {Object} options
 * @param {Array<string>} options.proxies Set of properties on the plugin
 * instance that should be mirrored on the Spark instance
 * @param {Object} options.payloadTransformer
 * @param {Array<Object>} options.payloadTransformer.predicates Predicates used
 * by the {@link PayloadTransformerInterceptor} to detect if a given object
 * should should be transformed and with which transforms
 * @param {Array<Object>} options.payloadTransformer.transforms Transforms used
 * by the {@link PayloadTransformerInterceptor} to transform a given object
 * @param {Object} options.interceptors
 * @param {boolean} options.replace Set to true if this plugin is replacing a
 * plugin of the same name. By default, the first plugin to register with a
 * given name is the plugin that gets that name.
 * @returns {null}
 */
export function registerPlugin(name, Plugin, options) {
  /* eslint complexity: [0] */
  if (constructorCalled) {
    const message = `registerPlugin() should not be called after instantiating a Spark instance`;
    // eslint-disable-next-line no-console
    console.warn(message);
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== `production`) {
      throw new Error(message);
    }
  }

  options = options || {};

  if (!children[name] || options.replace) {
    children[name] = Plugin;

    if (options.proxies) {
      options.proxies.forEach((key) => {
        derived[key] = {
          deps: [`${name}.${key}`],
          fn() {
            return this[name][key];
          }
        };
      });
    }

    if (options.interceptors) {
      Object.keys(options.interceptors).forEach((key) => {
        interceptors[key] = options.interceptors[key];
      });
    }

    if (options.config) {
      merge(config, options.config);
    }

    if (has(options, `payloadTransformer.predicates`)) {
      config.payloadTransformer.predicates = config.payloadTransformer.predicates.concat(get(options, `payloadTransformer.predicates`));
    }

    if (has(options, `payloadTransformer.transforms`)) {
      config.payloadTransformer.transforms = config.payloadTransformer.transforms.concat(get(options, `payloadTransformer.transforms`));
    }

    makeSparkConstructor();
  }
}
