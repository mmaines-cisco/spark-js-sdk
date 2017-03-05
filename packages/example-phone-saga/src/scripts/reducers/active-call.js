import {fromJS} from 'immutable';
import {CONNECTED, DIALED, DISCONNECTED, LOCAL_MEDIA_CHANGE} from '../sagas/dial';

const initialState = fromJS({
  connected: false
});
function activeCallReducer(state = initialState, action) {
  switch (action.type) {
  case DIALED:
    return state.merge({
      localMediaStreamUrl: action.payload.call.localMediaStreamUrl,
      call: action.payload.call
    });
  case CONNECTED:
    return state.merge({
      connected: true,
      remoteMediaStreamUrl: action.payload.call.remoteMediaStreamUrl
    });
  case LOCAL_MEDIA_CHANGE:
    return state.merge({
      localMediaStreamUrl: action.payload.call.localMediaStreamUrl
    });
  case DISCONNECTED:
    return state.merge({
      connected: false,
      localMediaStreamUrl: null,
      remoteMediaStreamUrl: null
    });
  default:
    return state;
  }
}
export default activeCallReducer;
