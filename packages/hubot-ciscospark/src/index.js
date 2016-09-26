/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

process.on(`error`, (...args) => console.log(require(`util`).inspect(args, {depth: null})));

const {
  Adapter,
  Robot,
  TextMessage,
  User
} = require(`hubot`);

const make = require(`./ciscospark`);

/**
 *
 */
class SparkAdapter extends Adapter {
  /**
   * @constructs {SparkAdapter}
   * @param {Robot} robot
   */
  constructor(robot) {
    super(robot);
    // if (!process.env.HUBOT_CISCOSPARK_ACCESS_TOKEN) {
    //   throw new Error(`HUBOT_CISCOSPARK_ACCESS_TOKEN must be defined`);
    // }

    this.robot.brain.once(`loaded`, () => this.onLoaded());
  }

  /**
   * Invoked when the brain has finished loading. We need to avoid connecting to
   * the Spark cloud until after we have access to the cached data.
   * @returns {undefined}
   */
  onLoaded() {
    this.spark = make(this.robot);
    this.spark.mercury.on(`change:connected`, () => {
      if (this.spark.mercury.connected) {
        this.emit(`online`);
      }
      else {
        this.emit(`offline`);
      }
    });

    this.spark.once(`change:canAuthorize`, () => {
      if (this.spark.canAuthorize) {
        this.spark.mercury.connect();
      }
    });
  }

  /**
   * @returns {undefined}
   */
  reply() {
    this.robot.logger.info(`Reply`);
  }

  /**
   * @returns {undefined}
   */
  run() {
    this.emit(`connected`);


    // const user = new User(1001, {
    //   name: `Sample User`
    // });
    // const message = new TextMessage(user, `Some Sample Message`, `MSG-001`);
    // this.robot.receive(message);
  }

  /**
   * @returns {undefined}
   */
  send() {
    this.robot.logger.info(`Send`);
  }

  /**
   * @param {Robot} robot
   * @returns {SparkAdapter}
   */
  static use(robot) {
    return new SparkAdapter(robot);
  }
}

module.exports = SparkAdapter;
