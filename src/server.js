const Koa = require('koa');
const Router = require('koa-router');
const request = require('request');
const app = new Koa();
const router = new Router();

const config = require('./config');

const Reporter = require('./main.js');
const redisManager = require('./utils/redis-manager');
const slackManager = require('./utils/slack-manager');

const CLIENT_ID = process.env.SLACK_CLIENT_ID;
const CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;

router.get('/health', async (ctx, next) => {
  ctx.body = {status: 'OK'};
  ctx.status = 200;
});

router.get('/oauth/slack', async (ctx, next) => {
  ctx.redirect(`https://slack.com/oauth/authorize?client_id=${CLIENT_ID}&scope=bot,incoming-webhook&redirect_uri=${config.endpoint}/oauth/slack/callback`);
  ctx.status = 302;
});

router.get('/oauth/slack/callback', async (ctx, next) => {
  console.log(ctx.request.query);
  const {code, state} = ctx.request.query;
  request.get(`https://slack.com/api/oauth.access?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${code}&redirect_uri=${config.endpoint}/oauth/slack/callback`, async (err, res) => {
    /*
    {
  "ok": true,
  "access_token": "xoxp-3672097045-3672150503-305314866865-3a72c2facc6c2fef2f3674fe36d91ed6",
  "scope": "identify,bot,chat:write:user",
  "user_id": "U03KS4EET",
  "team_name": "On Rewind",
  "team_id": "T03KS2V1B",
  "bot": {
    "bot_user_id": "U8Z98RHA5",
    "bot_access_token": "xoxb-305314867345-YeFlIhZJpW6Ocrisp1yUXtD3"
  }
}
     */
    const jsonRes = JSON.parse(res.body);
    await redisManager.set('botAccessToken', jsonRes.bot.bot_access_token);
    await redisManager.set('targetChannelId', jsonRes.incoming_webhook.channel_id);
  });
  ctx.redirect('/oauth/finish');
  ctx.status = 302;
});

router.get('/oauth/finish', async (ctx, netx) => {
  ctx.status = 200;
  ctx.body = 'Thank you for installing Botsketeer, start a report by going to /report';
});

router.get('/report', async (ctx, next) => {
  const botAccessToken = await redisManager.get('botAccessToken');
  const targetChannelId = await redisManager.get('targetChannelId');
  slackManager.close();
  if (botAccessToken && targetChannelId) {
    slackManager.init(botAccessToken);
    Reporter.start({targetChannelId});
    ctx.status = 200;
  } else {
    ctx.status = 400;
    ctx.body = 'Missing slack credentials, bot access token or target channel id, please authentify your app, go to /oauth/slack';
  }
});

app
  .use(router.routes())
  .use(router.allowedMethods());

const port = process.env.PORT || 3000;
app.listen(port);
console.log('listening on port ' + port);
