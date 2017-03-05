import ciscospark from 'ciscospark';
import {eventChannel, END} from 'redux-saga';
import {call, put, select, take} from 'redux-saga/effects';

window.ciscospark = ciscospark;

export const DIAL = `DIAL`;
export const HANGUP = `HANGUP`;
export const DIALED = `DIALED`;
export const RINGING = `RINGING`;
export const CONNECTED = `CONNECTED`;
export const DISCONNECTED = `DISCONNECTED`;
export const LOCAL_MEDIA_CHANGE = `LOCAL_MEDIA_CHANGE`;
export const ERROR = `ERROR`;

function createCallChannel(c) {
  return eventChannel((emit) => {
    c.on(`ringing`, () => emit({type: RINGING, payload: {call: c}}));
    c.on(`connected`, () => emit({type: CONNECTED, payload: {call: c}}));
    c.on(`disconnected`, () => {
      // FIXME there's a bug where a declined call won't turn off the camera
      emit({type: DISCONNECTED, payload: {call: c}});
      emit(END);
    });
    c.on(`error`, () => {
      emit({type: ERROR, payload: {call: c}});
      emit(END);
    });
    c.on(`localMediaStream:change`, () => emit({type: LOCAL_MEDIA_CHANGE, payload: {call: c}}));

    // Reminder: if you don't return a function here, you'll end up with a
    // silent failure
    return () => {
      c.off();
    };
  });
}

function dial(recipient) {
  const c = ciscospark.phone.dial(recipient);
  return c;
}

export function* saga() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const {payload} = yield take(DIAL);
      const c = yield call(dial, payload.recipient);
      const chan = yield call(createCallChannel, c);
      yield put({type: DIALED, payload: {call: c}});

      // TODO how do we get out of the channel when it ends?
      while (true) {
        const event = yield take(chan);
        yield put(event);
      }

    }
    catch (reason) {
      yield put({type: ERROR, payload: reason});
    }
  }
}

export function* hangupSaga() {
  while (true) {
    yield take(HANGUP);
    const c = yield select((state) => state.get(`activeCall`).toJS().call);
    c.hangup(); ß;
  }
}
