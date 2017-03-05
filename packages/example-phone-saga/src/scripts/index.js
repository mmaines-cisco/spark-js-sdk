import 'babel-polyfill';

import {AppContainer} from 'react-hot-loader';
import React from 'react';
import ReactDOM from 'react-dom';
import {Provider} from 'react-redux';
import {createRootStore as createStore} from './store';
import App from './containers/app';
import '../styles/style.css';

if (process.env.NODE_ENV !== `production`) {
  // eslint-disable-next-line global-require
  require(`react-axe`)(React, ReactDOM, 500);
}

const store = createStore();

/**
 * @param {Component} CurrentApp
 * @returns {undefined}
 */
function render(CurrentApp) {
  ReactDOM.render(
    <AppContainer>
      <Provider store={store}>
        <CurrentApp />
      </Provider>
    </AppContainer>,
    document.getElementById(`root`)
  );
}

if (module.hot) {
  module.hot.accept(`./containers/app`, () => {
    const NextApp = require(`./containers/app`).default;
    render(NextApp);
  });
}

render(App);
