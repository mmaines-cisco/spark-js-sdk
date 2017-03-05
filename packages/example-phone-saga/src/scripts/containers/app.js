import React from 'react';
import {connect} from 'react-redux';
import {DIAL, HANGUP} from '../sagas/dial';
import DialerForm from './dialer';

function App({handleDial, handleHangup, localMediaStreamUrl, remoteMediaStreamUrl}) {
  const videos = [];
  if (localMediaStreamUrl) {
    videos.push(
      <div className="video-container">
        <video autoPlay muted src={localMediaStreamUrl} />
      </div>
    );
  }

  if (remoteMediaStreamUrl) {
    videos.push(
      <div className="video-container">
        <video autoPlay src={remoteMediaStreamUrl} />
      </div>
    );
  }

  if (videos.length) {
    return (
      <div className="call-container">
        <div className="media-container">
          {videos}
        </div>
        <div className="call-controls">
          <button onClick={handleHangup}>Hangup</button>
        </div>
      </div>
    );
  }

  return (
    <DialerForm onSubmit={handleDial} />
  );
}

App.propTypes = {
  handleDial: React.PropTypes.func.isRequired,
  handleHangup: React.PropTypes.func.isRequired,
  localMediaStreamUrl: React.PropTypes.string,
  remoteMediaStreamUrl: React.PropTypes.string
};

export default connect((state) => state.get(`activeCall`).toJS(), (dispatch) => ({
  handleDial: (formData) => dispatch({
    type: DIAL,
    payload: formData.toJS()
  }),
  handleHangup: () => dispatch({
    type: HANGUP
  })
}))(App);
