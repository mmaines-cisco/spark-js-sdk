/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

const {NotFoundError} = require(`@ciscospark/spark-core`);

module.exports = function makeBrainAdapter(robot) {
  const {brain, logger} = robot;

  return {
    bind(namespace) {
      if (!namespace) {
        return Promise.reject(new Error(`\`namespace\` is required`));
      }

      return Promise.resolve({
        del(key) {
          return new Promise((resolve) => {
            logger.info(`hubot-brain-adapter: delete \`${namespace}.${key}\``);
            brain.remove(`${namespace}.${key}`);
            brain.once(`save`, resolve);
            brain.save();
          });
        },
        get(key) {
          logger.info(`hubot-brain-adapter: reading \`${namespace}.${key}\``);
          const res = brain.get(`${namespace}.${key}`);
          if (res) {
            return Promise.resolve(res);
          }

          return Promise.reject(new NotFoundError());
        },
        put(key, value) {
          return new Promise((resolve) => {
            logger.info(`hubot-brain-adapter: writing \`${namespace}.${key}\``);
            brain.set(`${namespace}.${key}`, value);
            brain.once(`save`, resolve);
            brain.save();
          });
        }
      });
    }
  };
};
