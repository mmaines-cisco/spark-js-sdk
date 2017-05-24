'use strict';

const debug = require(`debug`)(`tooling:openh264`);
const denodeify = require(`denodeify`);
const {rimraf} = require(`./async`);
const spawn = require(`../util/spawn`);
const FirefoxProfile = require(`firefox-profile`);
const os = require(`os`);
const path = require(`path`);

const copy = denodeify(FirefoxProfile.copy);
/**
 * denodeifies FirefoxProfile.encode, which is not a nodeback and must be done
 * manually
 * @param {FirefoxProfile} fp
 * @returns {Promise<string>}
 */
function encode(fp) {
  return new Promise((resolve) => {
    fp.encode((err, encoded) => {
      resolve(encoded);
    });
  });
}

exports.download = async function download() {
  await rimraf(`./.tmp/selenium/mac`);
  await spawn(`${__dirname}/openh264.sh`, []);
};

exports.inject = async function inject(browsers) {
  for (const key of Object.keys(browsers)) {
    const def = browsers[key];
    if (def.base === `SauceLabs`) {
      await injectSauce(def);
    }
    else {
      await injectLocal(def);
    }

  }
};

function platformToShortName(platform) {
  if (platform.toLowerCase().includes(`os x`) || platform === `darwin`) {
    return `mac`;
  }

  return undefined;
}

async function injectLocal(def) {
  debug(`checking ${def.base} for firefox`);
  if (def.base.toLowerCase().includes(`firefox`)) {
    debug(`def is a firefox def`);
    const platform = platformToShortName(os.platform());
    if (platform !== `mac`) {
      throw new Error(`No tooling implemented for injecting h264 into ${platform} (${def.platform})`);
    }
    debug(`injecting ${platform} profile into ${def.base}`);
    // TODO copy this somewhere safe
    def.profile = path.resolve(`./.tmp/selenium/${platform}`);
    debug(`injected ${platform} profile into ${def.base}`);
  }
}

async function injectSauce(def) {
  debug(`checking ${def.base} for firefox`);
  if (def.browserName.toLowerCase().includes(`firefox`)) {
    debug(`def is a firefox def`);
    const platform = platformToShortName(def.platform);
    if (platform !== `mac`) {
      throw new Error(`No tooling implemented for injecting h264 into ${platform} (${def.platform})`);
    }

    debug(`injecting ${platform} profile into ${def.base}`);
    const dir = path.resolve(process.cwd(), `./.tmp/selenium/${platform}`);
    debug(`profile is at ${dir}`);
    const profile = await copy(dir);
    require(`assert`)(profile, `profile should be defined`);
    const encoded = await encode(profile);
    require(`assert`)(encoded, `encoded profile should be defined`);
    // eslint-disable-next-line camelcase
    def.firefox_profile = encoded;
    require(`assert`)(def.firefox_profile, `firefox_profile should be defined`)
    debug(`injected ${platform} profile into def`);
  }
}
