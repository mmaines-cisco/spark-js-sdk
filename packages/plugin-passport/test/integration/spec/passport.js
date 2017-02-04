import '../..';
import Spark from '@ciscospark/spark-core';
import {request} from '@ciscospark/http-core';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`plugin-passport`, () => {
  let spark, user;
  before(`create user`, () => testUsers.create({
    config: {
      authCodeOnly: true
    }
  })
    .then((users) => {
      user = users[0];
    }));

  beforeEach(`create spark`, () => {
    spark = new Spark();
    sinon.stub(spark.passport, `openBrowser`).returns(Promise.resolve());
  });

  describe(`#initiateLogin()`, () => {
    it(`initiatates the OAuth login flow`, () => {
      const promise = spark.passport.initiateLogin();
      // eslint-disable-next-line camelcase
      const url = `${spark.config.credentials.oauth.redirect_uri}?code=${user.token.auth_code}`;
      request(url);
      return promise.then(() => assert.isTrue(spark.canAuthorize || spark.isAuthenticated));
    });
  });
});
