/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

const {
  Message,
  TextMessage
} = require(`hubot`);

/**
 * Represents a TextMessage created from the Spark adapter
 */
class SparkTextMessage extends TextMessage {
  /**
   * @param {Object} user
   * @param {string} text
   * @param {Object} activity
   * @returns {SparkTextMessage}
   */
  constructor(user, text, activity) {
    super(user, text, activity.url);
    this.user = user;
    this.text = text;
    this.activity = activity;
  }
}

/**
 * Represents a generic Message created from the Spark adapter
 */
class SparkMessage extends Message {
  /**
   * @param {Object} user
   * @param {Object} activity
   * @returns {SparkMessage}
   */
  constructor(user, activity) {
    super(user);
    this.user = user;
    this.activity = activity;
  }
}

module.exports = {
  SparkMessage,
  SparkTextMessage
};
