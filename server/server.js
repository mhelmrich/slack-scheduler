const { WebClient, RTMClient, Users} = require('@slack/client');
const {google} = require('googleapis')
const express = require('express')
const bodyParser = require('body-parser')
var mongoose = require("mongoose");
var session = require("express-session");
var MongoStore = require("connect-mongo")(session);

var Task = require("./models/task.js").Task;
var InviteRequest = require("./models/inviteRequest.js").inviteRequest;
var Meeting = require("./models/meeting.js").Meeting;
var User = require("./models/user.js").User;


// MONGODB connection
mongoose.connection.on("connected", function() {
  console.log("Connected to MongoDb!");
})
mongoose.connect(process.env.MONGODB_URI);

// An access token (from your Slack app or custom integration - xoxp, xoxb, or xoxa)
const token = process.env.SLACK_TOKEN;
var app = express();

var routes = require("../routes/routes.js");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/', routes);//make something called routes!!!



const web = new WebClient(token);
const rtm = new RTMClient(token);
var user = null;
var foundUser = null;

// This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID

rtm.start();
const conversationId = 'DC7KL23U3';

// https://developers.google.com/calendar/quickstart/nodejs

function makeCalendarAPICall(token) {
  const oauth2Client = new google.auth.OAuth2 (
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL
  )
  oauth2Client.setCredentials(token);
  oauth2Client.on('tokens', (tokens) => {//access tokens should be acquired and refreshed automatically on next API call
    if (tokens.refresh_token) {
      // store the refresh_token in my database!
      console.log(tokens.refresh_token);
    }
    console.log(tokens.access_token);
  });
  const calendar = google.calendar({version: "v3", auth: oauth2Client});
  console.log("calendar: ", calendar);
  calendar.events.list({
    calendarId: 'primary', // Go to setting on your calendar to get Id
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, {data}) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = data.items;
    if (events.length) {
      console.log('Upcoming 10 events:');
      events.map((event, i) => {
        const start = event.start.dateTime || event.start.date;
        console.log(`${start} - ${event.summary}`);
      });
    } else {
      console.log('No upcoming events found.');
    }
  })
}


// ask user for access to their calendar
/*console.log('open URI:', oauth2Client.generateAuthUrl({
  access_type: 'offline',
  state: 'DEMIMAGIC_ID', // meta-data for DB
  scope: [
    'https://www.googleapis.com/auth/calendar'
  ]
}))*/





 // See: https://api.slack.com/methods/chat.postMessage
/*web.chat.postMessage({ channel: conversationId, text: 'Hello there' })
  .then((res) => {
    // `res` contains information about the posted message
    console.log('Message sent: ', res.ts);
  })
  .catch(console.error);*/

  rtm.on('message', (event) => {
    console.log("EVENT: :", event);
    if (foundUser)
    {
      console.log('Message text from user: ', event.text);
      makeCalendarAPICall(foundUser.token)
    }
    else
    {
      rtm.sendMessage('Hello there \nPlease click the following link to help me help you!\n' + oauth2Client.generateAuthUrl({
      access_type: 'offline',
      state: user, // meta-data for DB; will pass in the unique user id
      scope: [
        'https://www.googleapis.com/auth/calendar'
      ]
    }), conversationId) // channel id of the current user
    .then((res) => {
      // `res` contains information about the posted message
      //console.log(res)

      //console.log(rtm.webClient.users.list({token: token}))
      console.log('Message sent: ', res.ts);
    })
    /*      .then(() => {
             User.find({slackId: user}, function(error, foundUser){
               console.log("FOUND USER " + user)
           })
      })*/
    .catch(console.error);
    }

    // For structure of `event`, see https://api.slack.com/events/message
    //console.log(event)
    //console.log('\n')
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

  rtm.on('ready', (event) => {
    console.log("READY")
    rtm.webClient.conversations.info({token: token, channel: conversationId})//is this channel not found?
    .then((convoInfo) => {
      console.log(convoInfo);
      user = convoInfo.channel.user;
      User.findOne({slackId: user}, function(error, found) {
        console.log("found user: ", found);
        if (error)
        {
          console.log("Error in find: ", error);
        }
        else
        {
          if (found)
          {
            rtm.sendMessage("Welcome back!", conversationId);
            foundUser = found;
          }
          else
          {
            // bot sends out link that prompts user to authenticate their google account
            rtm.sendMessage('Hello there \nPlease click the following link to help me help you!\n' + oauth2Client.generateAuthUrl({
              access_type: 'offline',
              state: user, // meta-data for DB; will pass in the unique user id
              scope: [
                'https://www.googleapis.com/auth/calendar'
              ]
            }), conversationId) // channel id of the current user
            .then((res) => {
              // `res` contains information about the posted message
              //console.log(res)

              //console.log(rtm.webClient.users.list({token: token}))
              console.log('Message sent: ', res.ts);
            })
        /*      .then(() => {
                User.find({slackId: user}, function(error, foundUser){
                  console.log("FOUND USER " + user)
                })
          })*/
            .catch(console.error);
          }
        }
      });

    })
  })


const port = process.env.PORT || 1337;
app.listen(port, () => {
  console.log(`Server listening on port ${port}!`);
});

module.exports = app;
