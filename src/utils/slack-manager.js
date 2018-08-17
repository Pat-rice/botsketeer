const {WebClient, RtmClient, CLIENT_EVENTS, RTM_EVENTS, RTM_MESSAGE_SUBTYPES} = require('@slack/client');

class SlackManager {

  constructor() {
    this._web;
    this._rtm;
  }

  get web() {
    return this._web;
  }

  get rtm() {
    return this._rtm;
  }

  init(token) {
    this._web = new WebClient(token);
    this._rtm = new RtmClient(token, {
      dataStore    : false,
      useRtmConnect: true,
    });
  }

  close() {
    this._rtm.disconnect();
  }

}

module.exports = new SlackManager();
