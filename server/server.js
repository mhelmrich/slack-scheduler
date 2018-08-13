<<<<<<< HEAD:server.js
const { WebClient, RTMClient } = require('@slack/client');
const {google} = require('googleapis')
const express = require('express')
const bodyParser = require('body-parser')
=======
const { WebClient } = require('@slack/client');
var Task = require("./models/task.js");
>>>>>>> fd3fbab00ae0b3028cf9591ccdad65c64410b3c6:server/server.js

// An access token (from your Slack app or custom integration - xoxp, xoxb, or xoxa)
const token = process.env.SLACK_TOKEN;

const web = new WebClient(token);
const rtm = new RTMClient(token)

// This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID
<<<<<<< HEAD:server.js
const conversationId = 'DC7KGLWAX';

rtm.start();
=======
const conversationId = 'DC7KL23U3';
>>>>>>> fd3fbab00ae0b3028cf9591ccdad65c64410b3c6:server/server.js

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
