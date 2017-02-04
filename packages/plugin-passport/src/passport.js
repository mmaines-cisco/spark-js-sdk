/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import {Token} from '@ciscospark/plugin-credentials';
import {exec} from 'child_process';
import {Strategy as CiscoSparkStrategy} from '@ciscospark/passport-ciscospark';
import passport from 'passport';
import express from 'express';
import url from 'url';

const Passport = SparkPlugin.extend({
  initiateLogin() {
    return new Promise((resolve, reject) => {
      const {port, path} = url.parse(this.spark.config.credentials.oauth.redirect_uri);
      const app = express();
      const strategy = new CiscoSparkStrategy(this.spark.config.credentials.oauth, (accessToken, refreshToken, profile, done) => {
        const token = new Token({
          // eslint-disable-next-line camelcase
          access_token: accessToken,
          // eslint-disable-next-line camelcase
          refresh_token: refreshToken
        }, {parent: this});
        resolve(this.spark.credentials._receiveSupertoken(token));
        done();
      });

      strategy.userProfile = function userProfile(accessToken, done) {
        done(null, this.spark);
      };

      app.use(passport.initialize());
      passport.use(strategy);
      app.get(path, passport.authenticate(`ciscospark`, (err) => {
        reject(err);
      }));

      // Set the socket timeout very low so that server.close completes quickly.
      // FIXME app.setTimeout(1000);

      app.listen(port, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.spark.logger.info(`credentials: server listening on ${port}`);

        this.spark.logger.info(`credentials: launching browser`);
        this.openBrowser();
      });
    });
  },

  openBrowser() {
    // eslint-disable-next-line camelcase
    exec(`open ${this.buildOAuthUrl({response_type: `code`})}`);
  }
});

export default Passport;
