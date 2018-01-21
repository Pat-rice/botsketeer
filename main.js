const {WebClient, RtmClient, CLIENT_EVENTS, RTM_EVENTS, RTM_MESSAGE_SUBTYPES} = require('@slack/client');

// An access token (from your Slack app or custom integration - usually xoxb)
const token = process.env.SLACK_TOKEN;

///////////////


const web = new WebClient(token);
let testBotChannel;

// See: https://api.slack.com/methods/chat.postMessage
web.channels.list()
  .then((res) => {
    testBotChannel = res.channels.find((channel) => {
      return channel.name === 'test-bot';
    });
    console.log('gotChannel', JSON.stringify(testBotChannel));
  })
  .catch(console.error);

////////////


// Cache of data
const appData = {};

// Initialize the RTM client with the recommended settings. Using the defaults for these
// settings is deprecated.
const rtm = new RtmClient(token, {
  dataStore    : false,
  useRtmConnect: true,
});

// The client will emit an RTM.AUTHENTICATED event on when the connection data is avaiable
// (before the connection is open)
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (connectData) => {
  // Cache the data necessary for this app in memory
  appData.botData = connectData.self;
  console.log(`Logged in as ${JSON.stringify(appData)} of team ${connectData.team.id}`);
});

let conversations = {};

rtm.on(RTM_EVENTS.MESSAGE, (rawMessage) => {
  console.log(rawMessage);

  if (rawMessage.type === 'message' && rawMessage.subtype != RTM_MESSAGE_SUBTYPES.BOT_MESSAGE) {

    if (rawMessage.text === 'report') {

    }

    if (conversations[rawMessage.user]) {
      conversations[rawMessage.user].push(rawMessage.text);
    } else {
      conversations[rawMessage.user] = [rawMessage.text];
    }


    console.log('posting back message');
    web.chat.postMessage(rawMessage.channel, 'AHAHAH ' + rawMessage.text);
    if (conversations[rawMessage.user].length === 3) {
      let messageText = 'Here\'s and update!';
      let messageOptions = {
        "attachments": []
      };

      conversations[rawMessage.user].forEach((line, index) => {
        messageOptions.attachments.push({
          "fallback": "Required plain-text summary of the attachment.",
          "color"   : ["#36a64f", '#4996ff', '#fff000'][index],
          "pretext" : "*Optional text that appears above the attachment block*",
          "text"    : line,
        });
      });

      //todo Should post as user
      web.chat.postMessage(testBotChannel.id, messageText, messageOptions);
      conversations[rawMessage.user] = [];
    }
  }
});

// Start the connecting process
rtm.start();