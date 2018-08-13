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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
//app.use('/', routes);//makes something called routes!!!



const web = new WebClient(token);
const rtm = new RTMClient(token)

// This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID

rtm.start();
const conversationId = 'DC7KL23U3';

// See: https://api.slack.com/methods/chat.postMessage
/*web.chat.postMessage({ channel: conversationId, text: 'Hello there' })
  .then((res) => {
    // `res` contains information about the posted message
    console.log('Message sent: ', res.ts);
  })
  .catch(console.error);*/

rtm.sendMessage('Hello there', conversationId)
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

