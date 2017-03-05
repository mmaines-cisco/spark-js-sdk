import {Map as ImmutableMap} from 'immutable';
import {applyMiddleware, createStore} from 'redux';
import createLogger from 'redux-logger';
import createSagaMiddleware from 'redux-saga';
import rootSaga from './sagas';
import rootReducer from './reducers';

export function createRootStore() {
  const logger = createLogger({
    stateTransformer: (state) => state.toJS()
  });

  const initialState = ImmutableMap({});

  const sagaMiddleware = createSagaMiddleware();

  const middlewares = [logger, sagaMiddleware];
  const store = createStore(rootReducer, initialState, applyMiddleware(...middlewares));
  sagaMiddleware.run(rootSaga);

  return store;
}
