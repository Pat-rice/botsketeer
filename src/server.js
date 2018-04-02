const Koa = require('koa');
const Router = require('koa-router');
const request = require('request');
const app = new Koa();
const router = new Router();

const CLIENT_ID = process.env.SLACK_CLIENT_ID;
const CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
console.log(CLIENT_ID);
router.get('/health', async (ctx, next) => {
  ctx.body = {status: 'OK'};
  ctx.status = 200;
});

router.get('/oauth/slack', async (ctx, next) => {
  ctx.redirect(`https://slack.com/oauth/authorize?client_id=${CLIENT_ID}&scope=bot,identify&redirect_uri=http://localhost:3000/oauth/slack/callback`);
  ctx.status = 302;
});

router.get('/oauth/slack/callback', async (ctx, next) => {
  console.log(ctx.request.query);
  let {code, state} = ctx.request.query;

  //ctx.redirect(`https://slack.com/app_redirect?app=${CLIENT_ID}`)
  //ctx.status = 301;
  request.get(`https://slack.com/api/oauth.access?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${code}&redirect_uri=http://localhost:3000/oauth/slack/callback`, (err, res) => {
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
    let jsonRes = JSON.parse(res.body);
    process.env.SLACK_TOKEN = jsonRes.bot.bot_access_token;
    require('./main');
  });
  ctx.status = 200;
  ctx.body = 'Thank you for installing Botsketeer';
});

//todo Cron every 24h and once a day max, call report


app
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(3000);
console.log('listening on port 3000');