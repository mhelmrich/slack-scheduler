const { WebClient, RTMClient, Users} = require('@slack/client');
const {google} = require('googleapis')
const express = require('express')
const bodyParser = require('body-parser')
var Task = require("./models/task.js").Task;
var InviteRequest = require("./models/inviteRequest.js").inviteRequest;
var Meeting = require("./models/meeting.js").Meeting;
var User = require("./models/user.js").User;

// An access token (from your Slack app or custom integration - xoxp, xoxb, or xoxa)
const token = process.env.SLACK_TOKEN;
var app = express();

var routes = require("../routes/routes.js");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/', routes);//make something called routes!!!



const web = new WebClient(token);
const rtm = new RTMClient(token);

// This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID

rtm.start();
const conversationId = 'DC7KGLWAX';

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

// nested loop that prints out each user and conversation id
  rtm.webClient.users.list({token: token})
  .then((res) => {
    console.log(res)
    res.members.forEach((user) => {
      console.log('User Id')
      console.log(user.id)
      rtm.webClient.conversations.open({token: token, users: user.id})
      .then((res2) => {
        console.log('Conversation ID')
        console.log(res2.channel.id)
        console.log('\n')

        // bot sends out link that prompts user to authenticate their google account
        rtm.sendMessage('Hello there \nPlease click the following link to help me help you!\n' + oauth2Client.generateAuthUrl({
          access_type: 'offline',
          state: user.id, // meta-data for DB; will pass in the unique user id
          scope: [
            'https://www.googleapis.com/auth/calendar'
          ]
        }), conversationId)
          .then((res) => {
            // `res` contains information about the posted message
            console.log(res)

            //console.log(rtm.webClient.users.list({token: token}))
            console.log('Message sent: ', res.ts);
          })
          .catch(console.error);
      })
    }
  )
  })

  rtm.on('ready', (event) => {
    console.log("READY")
  })

  rtm.on('message', (event) => {
    // For structure of `event`, see https://api.slack.com/events/message
    console.log(event)
    console.log('\n')
    /*var echo = event.text;
    if(echo === 'Marco') {
      echo = 'Polo'
    }
    rtm.sendMessage(echo, conversationId)
      .then((res) => {
        // `res` contains information about the posted message
        console.log('Message sent: ', res.ts);
      })
      .catch(console.error);*/
  });

const port = process.env.PORT || 1337;
app.listen(port, () => {
  console.log(`Server listening on port ${port}!`);
});

module.exports = app;
