const {CLIENT_EVENTS, RTM_EVENTS, RTM_MESSAGE_SUBTYPES} = require('@slack/client');
const redisManager = require('./utils/redis-manager');
const slackManager = require('./utils/slack-manager');

module.exports = {
  start: async function ({targetChannelId}) {

    const webBot = slackManager.web;
    const QUESTIONS = [
      `What did you do yesterday ?`,
      `What will you do today ?`,
      `Anything you want to add ?`,
      `What obstacles are impeding your progress ?`
    ];
    let targetChannel;
    let membersChannel = [];
    let membersDirectory = [];
    let directMessagesChannels = {};

// Cache of data
    const appData = {};

// Initialize the RTM client with the recommended settings. Using the defaults for these
// settings is deprecated.
    const rtm = slackManager.rtm;

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
        webBot.chat.postMessage(directMessagesChannels[currentUser.id], `Hello ${currentUser.profile.first_name} ! It's time for our standup meeting!\n ${QUESTIONS[0]}`);
      }
    });

    rtm.on(RTM_EVENTS.MESSAGE, async (rawMessage) => {
      if (rawMessage.type === RTM_EVENTS.MESSAGE && rawMessage.subtype !== RTM_MESSAGE_SUBTYPES.BOT_MESSAGE) {

        const todayMidnight = new Date().setUTCHours(0, 0, 0, 0);
        const hasDoneTodayReport = await redisManager.get(`${todayMidnight}_${rawMessage.user}`);

        if (hasDoneTodayReport) {
          webBot.chat.postMessage(rawMessage.channel, `Thanks but you've done your report already`);
        } else {
          if (conversations[rawMessage.user]) {
            conversations[rawMessage.user].push(rawMessage.text);
          } else {
            conversations[rawMessage.user] = [rawMessage.text];
          }

          let conversationLength = conversations[rawMessage.user].length;
          if (conversationLength === 1) {
            webBot.chat.postMessage(rawMessage.channel, QUESTIONS[1]);
          } else if (conversationLength === 2) {
            webBot.chat.postMessage(rawMessage.channel, QUESTIONS[2]);
          } else if (conversationLength === 3) {
            webBot.chat.postMessage(rawMessage.channel, QUESTIONS[3]);
          } else if (conversations[rawMessage.user].length === 4) {
            let currentUser = membersChannel.find(m => m.id === rawMessage.user);
            let messageText = `*${currentUser.real_name}* posted an update for *daily standup*`;
            let messageOptions = {
              as_user    : false, //Wants the tag "app" displayed
              username   : currentUser.name,
              icon_url   : currentUser.profile && currentUser.profile.image_48,
              attachments: []
            };

            conversations[rawMessage.user].forEach((line, index) => {
              if (
                line.toLowerCase() !== 'no'
                && line.toLowerCase() !== 'nope'
                && line.toLowerCase() !== 'not'
                && line.toLowerCase() !== '-'
                && line.toLowerCase() !== 'none'
              ) {
                messageOptions.attachments.push({
                  fallback: 'Required plain-text summary of the attachment.',
                  color   : ['#36a64f', '#4996ff', '#fff000', '#a91113'][index],
                  pretext : `*${QUESTIONS[index]}*`,
                  text    : line,
                });
              }
            });
            webBot.chat.postMessage(targetChannel.id, messageText, messageOptions)
              .catch((err) => {
                console.log(err);
              });
            conversations[rawMessage.user] = [];
            await redisManager.set(`${todayMidnight}_${rawMessage.user}`, true, 24 * 3600);
            webBot.chat.postMessage(rawMessage.channel, `Great ! Thanks !`);
          }
        }
      }
    });

    // Fetch all users, find the target channel, and members of this channel
    webBot.users.list()
      .then((res) => {
        //Get users linked to the app instead
        console.log('got users list', JSON.stringify(res.members));
        membersDirectory = res.members.filter((u) => !u.deleted && !u.is_bot && u.name !== 'slackbot');
        return webBot.channels.list();
      })
      .then((res) => {
        targetChannel = res.channels.find((channel) => {
          return channel.id === targetChannelId;
        });
        membersChannel = membersDirectory.filter(u => targetChannel.members.indexOf(u.id) !== -1);

        return webBot.im.list();
      })
      .then((res) => {
        //Mapping user ids to direct message channels ids
        res.ims.forEach((im) => {
          if (targetChannel.members.indexOf(im.user) !== -1) {
            directMessagesChannels[im.user] = im.id;
          }
        });

        rtm.start();
      })
      .catch(console.error);
  }
};
