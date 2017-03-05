import {combineReducers} from 'redux-immutable';
import {reducer as formReducer} from 'redux-form/immutable';
import activeCallReducer from './reducers/active-call';

export default combineReducers({
  activeCall: activeCallReducer,
  form: formReducer
});
