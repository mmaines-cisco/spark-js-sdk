/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

const {
  Adapter,
  TextMessage,
  CatchAllMessage
} = require(`hubot`);

const make = require(`./ciscospark`);

/**
 *
 */
class SparkAdapter extends Adapter {
  /**
   * Logout on clean shutdown
   * @returns {Promise}
   */
  close() {
    console.log(`close`);

    if (this.spark) {
      return this.spark.credentials.logout();
    }
    return Promise.resolve();
  }

  // /**
  //  * @constructs {SparkAdapter}
  //  * @param {Robot} robot
  //  */
  // constructor(robot) {
  //   super(robot);
  //   // FIXME use bot access tokens once there's a means of downscoping them
  //   // if (!process.env.HUBOT_CISCOSPARK_ACCESS_TOKEN) {
  //   //   throw new Error(`HUBOT_CISCOSPARK_ACCESS_TOKEN must be defined`);
  //   // }
  // }

  onActivity(message) {
    console.log(require(`util`).inspect(message, {depth: null}));

    const activity = message.data.activity;
    // Ignore messages created by the bot
    if (activity.actor.id === this.spark.device.userId) {
      return;
    }

    this.spark.conversation.get({
      url: (activity.target || activity.object).url
    })
      .then((conversation) => {
        const user = this.robot.brain.userForId(activity.actor.id, {
          name: activity.actor.displayName,
          room: conversation.url
        });

        let text;
        switch (activity.verb) {
        case `post`:
          text = activity.object.displayName;
          this.robot.logger.info(`Received message: ${text} in room : ${conversation.id}, from: ${user.name}`);
          // If this is a one on one with the bot, we need to prepend its name
          // to the message so the framework behaves as if it was @mentioned
          if (conversation.tags.includes(`ONE_ON_ONE`)) {
            text = `${this.robot.name} ${text}`;
          }

          this.receive(new TextMessage(user, text, activity.url));
          break;
        default:
          this.receive(new CatchAllMessage(user, activity));
        }
      })
      .catch((reason) => {
        this.robot.logger.error(`SparkAdapter#receive(): failed to process incoming message`, reason);
        console.error(`SparkAdapter#receive(): failed to process incoming message`, reason);
        this.robot.logger.error(reason.stack);
        console.error(reason.stack);
      });
  }

  /**
   * @returns {undefined}
   */
  reply(envelope, ...strings) {
    console.log(`reply`);
    return this.send(envelope, ...strings);
  }

  /**
   * @returns {undefined}
   */
  run() {
    this.robot.brain.once(`loaded`, () => {
      this.spark = make(this.robot);
      this.spark.mercury.on(`change:connected`, () => {
        if (this.spark.mercury.connected) {
          // this.spark.conversation.create({
          //   participants: [
          //     `51b9a10d-b80a-4f99-be55-10dbf19b3fac`,
          //     `f31713d8-f291-49c0-a314-862ad066ec77`
          //   ],
          //   comment: `test`
          // });
          this.send({
            room: {
              id: `402dbf77-123b-3283-8a52-5e67087c4d9e`
            }
          }, `online`);
        }
      });

      this.spark.once(`change:canAuthorize`, () => {
        if (this.spark.canAuthorize) {
          this.spark.mercury.connect();
        }
      });

      this.spark.mercury.on(`event:conversation.activity`, (activity) => this.onActivity(activity));
    });

    this.emit(`connected`);
  }

  /**
   * @param {Object} envelope
   * @returns {undefined}
   */
  send(envelope, ...strings) {
    console.log(`reply`);
    strings.reduce((promise, string) => promise.then(() => {
      return this.spark.conversation.post(envelope.room, {displayName: string})
        .catch((reason) => this.logger.error(`SparkAdapter#send(): failed to send string`, reason));
    }), Promise.resolve())
    .catch((reason) => this.logger.error(`SparkAdapter#send(): failed to send strings`, reason));
  }

  topic() {
    console.log(`topic`);
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
