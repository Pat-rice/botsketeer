const {WebClient, RtmClient, CLIENT_EVENTS, RTM_EVENTS, RTM_MESSAGE_SUBTYPES} = require('@slack/client');

// An access token (from your Slack app or custom integration - usually xoxb)
const token = process.env.SLACK_TOKEN;
const targetChannelName = process.env.TARGET_CHANNEL;
///////////////


const web = new WebClient(token);
let targetChannel;
let membersChannel = [];
let membersDirectory = [];
let directMessagesChannels = {};

// Cache of data
const appData = {};

// Initialize the RTM client with the recommended settings. Using the defaults for these
// settings is deprecated.
const rtm = new RtmClient(token, {
  dataStore    : false,
  useRtmConnect: true,
});

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (connectData) => {
  appData.botData = connectData.self;
  console.log(`Logged in as ${JSON.stringify(appData)} of team ${connectData.team.id}`);
});

//Subscribing all channel memebers to presence events
rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
  rtm.subscribePresence(targetChannel.members);
});

let conversations = {};

rtm.on(RTM_EVENTS.PRESENCE_CHANGE, (userPresence) => {
  let currentUser = membersChannel.find((u) => u.id === userPresence.user);
  if (currentUser && userPresence.presence === 'active' && !conversations[currentUser.id]) {
    web.chat.postMessage(directMessagesChannels[currentUser.id], `Hello ${currentUser.profile.first_name} ! It's time for our standup meeting! What did you do yesterday ?`);
  }
});

rtm.on(RTM_EVENTS.MESSAGE, (rawMessage) => {
  if (rawMessage.type === RTM_EVENTS.MESSAGE && rawMessage.subtype != RTM_MESSAGE_SUBTYPES.BOT_MESSAGE) {

    if (conversations[rawMessage.user]) {
      conversations[rawMessage.user].push(rawMessage.text);
    } else {
      conversations[rawMessage.user] = [rawMessage.text];
    }

    if (conversations[rawMessage.user].length === 3) {
      let messageText = 'Here\'s and update!';
      let messageOptions = {
        // as_user    : true,
        attachments: []
      };

      conversations[rawMessage.user].forEach((line, index) => {
        messageOptions.attachments.push({
          fallback: 'Required plain-text summary of the attachment.',
          color   : ['#36a64f', '#4996ff', '#fff000'][index],
          pretext : '*Optional text that appears above the attachment block*',
          text    : line,
        });
      });

      //todo Should post as user
      web.chat.postMessage(targetChannel.id, messageText, messageOptions);
      conversations[rawMessage.user] = [];
    }
  }
});

// Fetch all users, find the target channel, and members of this channel
web.users.list()
  .then((res) => {
    //Get users linked to the app instead
    membersDirectory = res.members.filter((u) => !u.deleted && !u.is_bot && u.name !== 'slackbot');
    return web.channels.list();
  })
  .then((res) => {
    targetChannel = res.channels.find((channel) => {
      return channel.name === targetChannelName;
    });
    membersChannel = membersDirectory.filter(u => targetChannel.members.indexOf(u.id) !== -1);

    return web.im.list();
  })
  .then((res) => {
    //Mapping user ids to direct message channels ids
    targetChannel.members.forEach((userId) => {
      directMessagesChannels[userId] = res.ims.find((im) => targetChannel.members.indexOf(im.user) !== -1).id;
    });

    rtm.start();
  })
  .catch(console.error);