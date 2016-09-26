/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

require(`@ciscospark/plugin-conversation`);
require(`@ciscospark/plugin-credentials`);

const CiscoSpark = require(`@ciscospark/spark-core`).default;
const makeBrainAdapter = require(`./brain-adapter`);

module.exports = function make(robot) {
  const spark = new CiscoSpark({
    // Ideally, we'd be able to use a bot token, but since we don't have the
    // access token for it, we don't have the ability to downscope it for the
    // KMS; as such, we need to stick with the saml machine account flow
    // credentials: {
    //   access_token: process.env.HUBOT_CISCOSPARK_ACCESS_TOKEN
    // },
    config: {
      storage: {
        boundedAdapter: makeBrainAdapter(robot),
        unboundedAdapter: makeBrainAdapter(robot)
      }
    }
  });

  robot.logger.warn = robot.logger.error;
  spark.logger = robot.logger;

  // FIXME This should wait for a spark.storage.loaded event
  robot.logger.info(`ciscospark: delaying 1000 ms to wait for storage layer`);
  setTimeout(() => {
    if (spark.canAuthorize) {
      robot.logger.info(`ciscospark: found cached credentials, not authorizing again`);
      return;
    }

    spark.credentials.requestSamlExtensionGrant({
      name: process.env.HUBOT_CISCOSPARK_NAME,
      orgId: process.env.HUBOT_CISCOSPARK_ORGID,
      password: process.env.HUBOT_CISCOSPARK_PASSWORD
    })
      .then(() => {
        robot.logger.info(`ciscospark: authorized successfully`);
      })
      .catch((reason) => {
        robot.logger.error(`ciscospark: failed to authorize`);
        robot.logger.error(reason.stack);
      });
  }, 1000);


  return spark;
};
