/**!
 *
 * Copyright (c) 2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint-env browser: true */
/* global RTCPeerConnection, RTCSessionDescription */

import {SparkPlugin} from '@ciscospark/spark-core';
import {oneFlight, tap} from '@ciscospark/common';
import {
  eventKeys,
  USE_INCOMING,
  FETCH
} from '@ciscospark/plugin-locus';
import {defaults, find} from 'lodash';
import {
  activeParticipants,
  direction,
  isActive,
  joined,
  joinedOnThisDevice,
  participantIsJoined,
  remoteAudioMuted,
  remoteParticipant,
  remoteVideoMuted
} from './state-parsers';

import WebRTCMedia from './web-rtc-media';

/**
 * @event ringing
 * @instance
 * @memberof Call
 */

/**
 * @event connected
 * @instance
 * @memberof Call
 */

/**
 * @event disconnected
 * @instance
 * @memberof Call
 */

/**
 * @event localMediaStream:change
 * @instance
 * @memberof Call
 */

/**
 * @event remoteMediaStream:change
 * @instance
 * @memberof Call
 */

/**
 * @event error
 * @instance
 * @memberof Call
 */

/**
 * Payload for {@link Call#sendFeedback}
 * @typedef {Object} Types~Feedback
 * @property {number} userRating Number between 1 and 5 (5 being best) to let
 * the user score the call
 * @property {string} userComments Freeform feedback from the user about the
 * call
 * @property {Boolean} includeLogs set to true to submit client logs to the
 * Cisco Spark cloud. Note: at this time, all logs, not just call logs,
 * generated by the sdk will be uploaded to the Spark Cloud. Care has been taken
 * to avoid including PII in these logs, but if you've taken advantage of the
 * SDK's logger, you should make sure to avoid logging PII as well.
 */

/**
 * @class
 * @extends SparkPlugin
 */
const Call = SparkPlugin.extend({
  namespace: `Phone`,

  children: {
    media: WebRTCMedia
  },

  session: {
    locus: `object`,
    /**
     * Returns the local MediaStream for the call. May initially be `null`
     * between the time @{Phone#dial is invoked and the  media stream is
     * acquired if {@link Phone#dial} is invoked without a `localMediaStream`
     * option.
     *
     * This property can also be set mid-call in which case the streams sent to
     * the remote party are replaced by this stream. On success, the
     * {@link Call}'s {@link localMediaStream:change} event fires, notifying any
     * listeners that we are now sending media from a new source.
     * @instance
     * @memberof Call
     * @member {MediaStream}
     * @readonly
     */
    localMediaStream: `object`,
    // TODO determine if stream URLs can be deprecated; it looks like the video
    // tag may accept streams directly these days.
    /**
     * Object URL that refers to {@link Call#localMediaStream}. Will be
     * automatically deallocated when the call ends
     * @instance
     * @memberof Call
     * @member {string}
     */
    localMediaStreamUrl: `string`,
    /**
     * Object URL that refers to {@link Call#remoteMediaStream}. Will be
     * automatically deallocated when the call ends
     * @instance
     * @memberof Call
     * @member {string}
     * @readonly
     */
    remoteMediaStreamUrl: `string`
  },

  // FIXME in its current form, any derived property that is an object will emit
  // a change event everytime a locus gets replaced, even if no values change
  derived: {
    isActive: {
      deps: [`locus`],
      fn() {
        return this.locus && isActive(this.locus);
      }
    },
    activeParticipants: {
      deps: [`locus`],
      fn() {
        return activeParticipants(this.locus);
      }
    },
    activeParticipantsCount: {
      deps: [`activeParticipants`],
      fn() {
        return this.activeParticipants.length;
      }
    },
    joined: {
      deps: [`locus`],
      default: false,
      fn() {
        return this.locus && joined(this.locus);
      }
    },
    joinedOnThisDevice: {
      deps: [`locus`],
      default: false,
      fn() {
        return this.locus && joinedOnThisDevice(this.spark, this.locus);
      }
    },
    locusUrl: {
      deps: [`locus`],
      fn() {
        return this.locus.url;
      }
    },
    device: {
      deps: [`locus`],
      fn() {
        return this.locus.self && find(this.locus.self.devices, (item) => item.url === this.spark.device.url);
      }
    },
    mediaConnection: {
      deps: [`device`],
      fn() {
        return this.device && this.device.mediaConnections[0];
      }
    },
    mediaId: {
      deps: [`mediaConnection`],
      fn() {
        return this.mediaConnection && this.mediaConnection.mediaId;
      }
    },
    remoteAudioMuted: {
      deps: [`remote`],
      fn() {
        return remoteAudioMuted(this.remote);
      }
    },
    remoteVideoMuted: {
      deps: [`remote`],
      fn() {
        return remoteVideoMuted(this.remote);
      }
    },
    direction: {
      deps: [`locus`],
      fn() {
        // This seems brittle, but I can't come up with a better way. The only
        // way we should have a Call without a locus is if we just initiated a
        // call but haven't got the response from locus yet.
        if (!this.locus) {
          return `out`;
        }
        return direction(this.locus);
      }
    },
    from: {
      deps: [
        `direction`,
        `local`,
        `remote`
      ],
      fn() {
        return this.direction === `out` ? this.local : this.remote;
      }
    },
    to: {
      deps: [
        `direction`,
        `local`,
        `remote`
      ],
      fn() {
        return this.direction === `in` ? this.local : this.remote;
      }
    },
    local: {
      deps: [`locus`],
      fn() {
        return this.locus && this.locus.self;
      }
    },
    remote: {
      deps: [`locus`],
      fn() {
        return this.locus && remoteParticipant(this.locus);
      }
    },
    /**
     * <b>initiated</b> - Offer was sent to remote party but they have not yet accepted <br>
     * <b>ringing</b> - Remote party has acknowledged the call <br>
     * <b>connected</b> - At least one party is still on the call <br>
     * <b>disconnected</b> - All parties have dropped <br>
     * @instance
     * @memberof Call
     * @member {string}
     * @readonly
     */
    status: {
      deps: [
        `joinedOnThisDevice`,
        `local`,
        `remote`
      ],
      fn() {
        if (this.joinedOnThisDevice && this.remote && participantIsJoined(this.remote)) {
          return `connected`;
        }

        if (this.remote && this.local) {
          if (this.remote.state === `LEFT` || this.local.state === `LEFT`) {
            return `disconnected`;
          }

          if (this.remote.state === `DECLINED`) {
            return `disconnected`;
          }

          if (this.remote.state === `NOTIFIED`) {
            return `ringing`;
          }
        }

        return `initiated`;
      }
    },
    /**
     * Access to the remote party’s `MediaStream`.
     * @instance
     * @memberof Call
     * @member {MediaStream}
     * @readonly
     */
    remoteMediaStream: {
      deps: [`media.remoteMediaStream`],
      fn() {
        return this.media.remoteMediaStream;
      }
    },
    receivingAudio: {
      deps: [`media.receivingAudio`],
      fn() {
        return this.media.receivingAudio;
      }
    },
    receivingVideo: {
      deps: [`media.receivingVideo`],
      fn() {
        return this.media.receivingVideo;
      }
    },
    sendingAudio: {
      deps: [`media.sendingAudio`],
      fn() {
        return this.media.sendingAudio;
      }
    },
    sendingVideo: {
      deps: [`media.sendingVideo`],
      fn() {
        return this.media.sendingVideo;
      }
    }
  },

  /**
   * Initializer
   * @private
   * @param {Object} attrs
   * @param {Object} options
   * @returns {undefined}
   */
  initialize(...args) {
    Reflect.apply(SparkPlugin.prototype.initialize, this, args);

    // We can't trust the mercury event name, so we need to pipe all locus
    // events through the same handler.
    // TODO adjust plugin-mercury to emit events by namespace so we can listen
    // for incoming locus events in a single handler.
    eventKeys.forEach((key) => {
      this.listenTo(this.spark.mercury, `event:${key}`, (event) => this._onLocusEvent(event));
    });

    this.on(`disconnected`, () => {
      this.stopListening(this.spark.mercury);
      this.off();
      URL.revokeObjectURL(this.localMediaStreamUrl);
      this.localMediaStreamUrl = undefined;
      URL.revokeObjectURL(this.remoteMediaStreamUrl);
      this.remoteMediaStreamUrl = undefined;
    });

    this.on(`change:remoteMediaStream`, () => {
      if (this.remoteMediaStreamUrl) {
        URL.revokeObjectURL(this.remoteMediaStreamUrl);
      }
      this.remoteMediaStreamUrl = URL.createObjectURL(this.remoteMediaStream);
    });

    this.on(`change:remoteMediaStreamUrl`, () => {
      this.trigger(`remoteMediaStream:change`);
    });

    this.on(`change:localMediaStreamUrl`, () => {
      this.trigger(`localMediaStream:change`);
    });

    this.on(`change:remoteAudioMuted`, () => {
      this.trigger(`remoteAudioMuted:change`);
    });

    this.on(`change:remoteVideoMuted`, () => {
      this.trigger(`remoteVideoMuted:change`);
    });

    this.on(`change:isActive`, () => {
      if (!this.isActive) {
        if (this.joinedOnThisDevice) {
          this.logger.info(`call: hanging up due to locus going inactive`);
          this.hangup();
        }
      }
    });

    this.on(`change:activeParticipantsCount`, () => {
      const previousLocus = this.previousAttributes().locus;
      // TODO this logic probably goes in state-parsers
      if (this.joinedOnThisDevice && this.activeParticipantsCount === 1 && previousLocus && activeParticipants(previousLocus).length > 1) {
        this.logger.info(`call: hanging up due to last participant in call`);
        this.hangup();
      }
    });

    this.on(`change:status`, () => {
      switch (this.status) {
      case `ringing`:
        this.trigger(`ringing`);
        break;
      case `connected`:
        this.trigger(`connected`);
        break;
      case `disconnected`:
        this.trigger(`disconnected`);
        break;
      default:
        // do nothing
      }
    });
  },

  /**
   * Answers an incoming call. Only applies to incoming calls. Invoking this
   * method on an outgoing call is a noop
   * @instance
   * @memberof Call
   * @param {Object} options
   * @param {MediaStreamConstraints} options.constraints
   * @returns {Promise}
   */
  answer(options) {
    // TODO make this a noop for outbound calls
    this.logger.info(`call: answering`);
    // Locus may *think* we're connected if we e.g. reload the page mid-call. If
    // the user decides to answer the in-progress call that locus thinks they're
    // a part of, we should immediately emit the connected event.
    if (this.joinedOnThisDevice) {
      this.logger.info(`call: already joined on this device`);
    }
    return this._join(`join`, this.locus, options)
      .then(tap(() => this.logger.info(`call: answered`)));
  },

  /**
   * Use to acknowledge (without answering) an incoming call. Will cause the
   * initiator's Call instance to emit the ringing event.
   * @instance
   * @memberof Call
   * @returns {Promise}
   */
  acknowledge() {
    this.logger.info(`call: acknowledging`);
    // TODO call this method automatically unless config says otherwise
    return this.spark.locus.alert(this.locus)
      .then((locus) => this._setLocus(locus))
      .then(tap(() => this.logger.info(`call: acknowledged`)));
  },

  /**
   * Used by {@link Phone#dial} to initiate an outbound call
   * @instance
   * @memberof Call
   * @param {[type]} invitee
   * @param {[type]} options
   * @private
   * @returns {[type]}
   */
  dial(invitee, options) {
    this.logger.info(`call: dialing`);
    if (options && options.localMediaStream) {
      this.localMediaStream = options.localMediaStream;
    }
    this._join(`create`, invitee, options)
      .then(tap(() => this.logger.info(`call: dialed`)))
      .catch((reason) => {
        this.trigger(`error`, reason);
      });

    return this;
  },

  /**
   * Disconnects the active call. Applies to both incoming and outgoing calls.
   * This method may be invoked in any call state and the SDK should take care
   * to tear down the call and free up all resources regardless of the state.
   * @instance
   * @memberof Call
   * @returns {Promise}
   */
  hangup() {
    // TODO For example, hangup may be invoked immediately after invoking dial()
    // but before the “locus” has been created. In this case  invoking  hangup()
    // should short circuit the call setup process and take whatever action is
    // necessary to ensure all parties are notified that the call is
    // disconnected.
    // TODO For incoming calls, invoking hangup should be synonymous with
    // invoking reject()
    this.logger.info(`call: hanging up`);

    this.media.end();

    if (!this.locus) {
      if (this.locusJoinInFlight) {
        this.logger.info(`call: no locus, waiting for rest call to complete before hanging up`);
        return this.when(`change:locus`)
          .then(() => this.hangup());
      }

      this.stopListening(this.spark.mercury);
      this.off();
      this.logger.info(`call: hang up complete, call never created`);
      return Promise.resolve();
    }

    return this._hangup();
  },

  /**
   * Does the internal work necessary to end a call while allowing hangup() to
   * call itself without getting stuck in promise change because of oneFlight
   * @private
   * @returns {Promise}
   */
  @oneFlight
  _hangup() {
    this.locusLeaveInFlight = true;
    return this.spark.locus.leave(this.locus)
      .then((locus) => this._setLocus(locus))
      .then(() => {
        this.locusLeaveInFlight = false;
      })
      .then(tap(() => this.stopListening(this.spark.mercury)))
      .then(tap(() => this.off()))
      .then(tap(() => this.logger.info(`call: hung up`)));
  },

  /**
   * Alias of {@link Call#reject}
   * @see {@link Call#reject}
   * @instance
   * @memberof Call
   * @returns {Promise}
   */
  decline() {
    return this.reject();
  },

  /**
   * Rejects an incoming call. Only applies to incoming calls. Invoking this
   * method on an outgoing call is a no-op.
   * @instance
   * @memberof Call
   * @returns {Promise}
   */
  @oneFlight
  reject() {
    // TODO should be a noop for outgoing calls
    this.logger.info(`call: rejecting`);
    /* eslint no-invalid-this: [0] */
    return this.spark.locus.decline(this.locus)
      .then((locus) => this._setLocus(locus))
      .then(tap(() => this.stopListening(this.spark.mercury)))
      .then(tap(() => this.off()))
      .then(tap(() => this.logger.info(`call: rejected`)));
  },

  /**
   * Starts sending audio to the Cisco Spark Cloud
   * @instance
   * @memberof Call
   * @returns {Promise}
   */
  startSendingAudio() {
    return this._changeMedia({sendingAudio: true});
  },

  /**
   * Starts sending video to the Cisco Spark Cloud
   * @instance
   * @memberof Call
   * @returns {Promise}
   */
  startSendingVideo() {
    return this._changeMedia({sendingVideo: true});
  },

  startReceivingAudio() {
    return this._changeMedia({receivingAudio: true});
  },

  startReceivingVideo() {
    return this._changeMedia({receivingVideo: true});
  },

  /**
   * Toggles receiving audio to the Cisco Spark Cloud
   * @instance
   * @memberof Call
   * @returns {Promise}
   */
  toggleReceivingAudio() {
    return this.receivingAudio ? this.stopReceivingAudio() : this.startReceivingAudio();
  },

  /**
   * Toggles receiving video to the Cisco Spark Cloud
   * @instance
   * @memberof Call
   * @returns {Promise}
   */
  toggleReceivingVideo() {
    return this.receivingVideo ? this.stopReceivingVideo() : this.startReceivingVideo();
  },

  stopReceivingAudio() {
    return this._changeMedia({receivingAudio: false});
  },

  stopReceivingVideo() {
    return this._changeMedia({receivingVideo: false});
  },

  /**
   * Toggles sending audio to the Cisco Spark Cloud
   * @instance
   * @memberof Call
   * @returns {Promise}
   */
  toggleSendingAudio() {
    return this.sendingAudio ? this.stopSendingAudio() : this.startSendingAudio();
  },

  /**
   * Toggles sending video to the Cisco Spark Cloud
   * @instance
   * @memberof Call
   * @returns {Promise}
   */
  toggleSendingVideo() {
    return this.sendingVideo ? this.stopSendingVideo() : this.startSendingVideo();
  },

  /**
   * Sends feedback about the call to the Cisco Spark cloud
   * @instance
   * @memberof Call
   * @param {Types~Feedback} feedback
   * @returns {Promise}
   */
  sendFeedback(feedback) {
    return this.spark.metrics.submit(`meetup_call_user_rating`, feedback);
  },

  /**
   * Stops sending audio to the Cisco Spark Cloud. (stops broadcast immediately,
   * even if renegotiation has not completed)
   * @instance
   * @memberof Call
   * @returns {Promise}
   */
  stopSendingAudio() {
    return this._changeMedia({sendingAudio: false});
  },

  /**
   * Stops sending video to the Cisco Spark Cloud. (stops broadcast immediately,
   * even if renegotiation has not completed)
   * @instance
   * @memberof Call
   * @returns {Promise}
   */
  stopSendingVideo() {
    return this._changeMedia({sendingVideo: false});
  },

  _changeMedia(constraints) {
    return new Promise((resolve) => {

    });
  },

  _join(locusMethodName, target, options) {
    options = options || {};
    options.constraints = defaults(options.constraints, {
      audio: true,
      video: true
    });
    const recvOnly = !options.constraints.audio && !options.constraints.video;
    options.offerOptions = defaults(options.offerOptions, {
      offerToReceiveAudio: recvOnly || options.constraints.audio,
      offerToReceiveVideo: recvOnly || options.constraints.video
    });

    this.media.set({
      audio: options.constraints.audio,
      video: options.constraints.video,
      offerToReceiveAudio: options.offerOptions.offerToReceiveAudio,
      offerToReceiveVideo: options.offerOptions.offerToReceiveVideo
    });

    return this.media.createOffer()
      .then((offer) => this.spark.locus[locusMethodName](target, {
        localSdp: offer
      }))
      .then((locus) => {
        this._setLocus(locus);
        this.locusJoinInFlight = false;
        const answer = JSON.parse(this.mediaConnection.remoteSdp).sdp;
        return this.media.acceptAnswer(answer);
      });
  },

  _onLocusEvent(event) {
    if (this.locus && event.data.locus.url === this.locus.url) {
      this.logger.info(`locus event: ${event.data.eventType}`);
      this._setLocus(event.data.locus);
    }
  },

  _setLocus(incoming) {
    const current = this.locus;
    if (!current) {
      this.locus = incoming;
      return Promise.resolve();
    }
    const action = this.spark.locus.compare(current, incoming);

    switch (action) {
    case USE_INCOMING:
      this.locus = incoming;
      break;
    case FETCH:
      return this.spark.locus.get(current)
         .then((locus) => this._setLocus(locus));
    default:
      // do nothing
    }

    return Promise.resolve();
  },

  @oneFlight
  _updateMedia() {
    /* eslint max-nested-callbacks: [0] */
    return new Promise((resolve) => {
      process.nextTick(() => {
        resolve(this.media.createOffer()
          .then((offer) => this.spark.locus.updateMedia(this.locus, {
            localSdp: offer,
            mediaId: this.mediaId,
            audioMuted: !this.sendingAudio,
            videoMuted: !this.sendingVideo
          }))
          .then((locus) => {
            this._setLocus(locus);
            const sdp = JSON.parse(this.mediaConnection.remoteSdp).sdp;
            this.media.acceptAnswer(sdp);
          }));
      });
    });
  }
});

Call.make = function make(attrs, options) {
  return new Call(attrs, options);
};

export default Call;
