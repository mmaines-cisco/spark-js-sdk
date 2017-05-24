'use strict';

const wrapHandler = require(`../../lib/wrap-handler`);
const {inject} = require(`../../lib/openh264`);
const path = require(`path`);
const {writeFile} = require(`fs-promise`);

module.exports = {
  command: `inject`,
  desc: `Inject the openh264 firefox profile into the browsers that a given package would use`,
  builder: {},
  handler: wrapHandler(async () => {
    const file = path.resolve(`./packages/node_modules/@ciscospark/plugin-phone/browsers.js`);
    // eslint-disable-next-line global-require
    const browsers = require(file)();
    await inject(browsers);
    console.log(`${JSON.stringify(browsers, null, 2)}\n`);
    // await writeFile(file, `${JSON.stringify(browsers, null, 2)}\n`);
  })
};
