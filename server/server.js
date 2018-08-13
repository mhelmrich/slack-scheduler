const { WebClient, RTMClient } = require('@slack/client');
const {google} = require('googleapis')
const express = require('express')
const bodyParser = require('body-parser')
var Task = require("./models/task.js");
var InviteRequest = require("./models/task.js");
var Meeting = require("./models/task.js");
var User = require("./models/task.js");

// An access token (from your Slack app or custom integration - xoxp, xoxb, or xoxa)
const token = process.env.SLACK_TOKEN;
var app = express();

var routes = require("../routes/routes.js");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/', routes);//make something called routes!!!



const web = new WebClient(token);
const rtm = new RTMClient(token)

// This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID

rtm.start();
const conversationId = 'DC7KL23U3';

// https://developers.google.com/calendar/quickstart/nodejs
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
)

// ask user for access to their calendar
console.log('open URI:',oauth2Client.generateAuthUrl({
  access_type: 'offline',
  state: 'DEMIMAGIC_ID', // meta-data for DB
  scope: [
    'https://www.googleapis.com/auth/calendar'
  ]
}))

// See: https://api.slack.com/methods/chat.postMessage
/*web.chat.postMessage({ channel: conversationId, text: 'Hello there' })
  .then((res) => {
    // `res` contains information about the posted message
    console.log('Message sent: ', res.ts);
  })
  .catch(console.error);*/

rtm.sendMessage('Hello there \nPlease click the following link to help me help you!\n' + oauth2Client.generateAuthUrl({
  access_type: 'offline',
  state: 'DEMIMAGIC_ID', // meta-data for DB
  scope: [
    'https://www.googleapis.com/auth/calendar'
  ]
}), conversationId)
  .then((res) => {
    // `res` contains information about the posted message
    console.log('Message sent: ', res.ts);
  })
  .catch(console.error);

  rtm.on('message', (event) => {
    // For structure of `event`, see https://api.slack.com/events/message
    console.log(event.text)
    var echo = event.text;
    if(echo === 'Marco') {
      echo = 'Polo'
    }
    rtm.sendMessage(echo, conversationId)
      .then((res) => {
        // `res` contains information about the posted message
        console.log('Message sent: ', res.ts);
      })
      .catch(console.error);
  });

const port = process.env.PORT || 1337;
app.listen(port, () => {
  console.log(`Server listening on port ${port}!`);
});

module.exports = app;
