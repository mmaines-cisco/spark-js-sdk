/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '@ciscospark/plugin-credentials';
import {registerPlugin} from '@ciscospark/spark-core';
import Passport from './passport';
import config from './config';

registerPlugin(`passport`, Passport, {
  config,
  replace: true
});

export {
  default as default
} from './passport';
export {default as config} from './config';
