const { WebClient, RTMClient, Users} = require('@slack/client');
const {google} = require('googleapis')
const express = require('express')
const bodyParser = require('body-parser')
var mongoose = require("mongoose");
var session = require("express-session");
var MongoStore = require("connect-mongo")(session);

const sessionId = 'slackchat-1';
const dialogflow = require('dialogflow');
const sessionClient = new dialogflow.SessionsClient();
const sessionPath = sessionClient.sessionPath(process.env.DIALOGFLOW_PROJECT_ID, sessionId);

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

// This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID

rtm.start();
//var conversationId = 'DC7KGLWAX';

// https://developers.google.com/calendar/quickstart/nodejs

function handleIntent(calendar, intent, conversationId){
  switch (intent.intent.displayName) {
    case 'reminder:add':
      console.log(intent)
      console.log(intent.parameters.fields)

      calendar.events.insert({
        calendarId: 'primary', // Go to setting on your calendar to get Id
        'resource': {
          'summary': intent.parameters.fields.subject.stringValue,
          'location': '800 Howard St., San Francisco, CA 94103',
          'description': intent.parameters.fields.subject.stringValue,
          'start': {
            'dateTime': intent.parameters.fields.date.stringValue,
            'timeZone': 'America/Los_Angeles'
          },
          'end': {
            'dateTime': intent.parameters.fields.date.stringValue,
            'timeZone': 'America/Los_Angeles'
          },
        }
      }, (err, {data}) => {
        if (err) return console.log('The API returned an error: ' + err);
        console.log(data)
      })
      return;
      break;
    case 'meeting:schedule':
      break;
    case 'calendar:events':
    console.log('CALLED')
      calendar.events.list({
        calendarId: 'primary', // Go to setting on your calendar to get Id
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
      }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const events = res.data.items;
        console.log('=======================================')
        console.log(events)
        if (events.length) {
          var messageString = 'Upcoming 10 events: '
          console.log('Upcoming 10 events:');
          events.map((event) => {
            const start = event.start.dateTime || event.start.date;
            console.log(`${start} - ${event.summary}`);
            messageString += '\n'+ start + ' - ' + event.summary
          });
          rtm.sendMessage(messageString, conversationId)
        } else {
          console.log('No upcoming events found.');
        }
      })
      break;
    default:

  }
}

function makeCalendarAPICall(token, intent, conversationId) {
  const oauth2Client = new google.auth.OAuth2 (
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL
  )
  console.log("Token")
  console.log(token)
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

  handleIntent(calendar, intent, conversationId);
}

  rtm.on('message', (event) => {
    console.log("EVENT: :", event);
    var foundUser = null;
    var user = event.user; // possibly error
    const conversationId = event.channel

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
          //rtm.sendMessage("Welcome back!", conversationId);
          foundUser = found;

          const request = {
            session: sessionPath,
            queryInput: {
              text: {
                text: event.text,
                languageCode: 'en-US',
              },
            },
          };

          sessionClient.detectIntent(request)
            .then(responses => {
              const result = responses[0].queryResult;
              console.log('Detected intent', result.parameters.fields);
              console.log(`  Query: ${result.queryText}`);
              console.log(`  Response: ${result.fulfillmentText}`);
              rtm.sendMessage(result.fulfillmentText, conversationId)
              if (result.intent) {
                console.log(`  Intent: ${result.intent.displayName}`);
                makeCalendarAPICall(found.googleCalendarAccount.token, result, conversationId)
              } else {
                console.log(`  No intent matched.`);
              }
            })
            .catch(err => {
              console.error('ERROR:', err);
            });
        }
        else
        {

          const oauth2Client = new google.auth.OAuth2 (
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            process.env.REDIRECT_URL
          )
          // bot sends out link that prompts user to authenticate their google account
          rtm.sendMessage('Hello there \nPlease click the following link to help me help you!\n' + oauth2Client.generateAuthUrl({
            access_type: 'offline',
            state: user,
            scope: [
              'https://www.googleapis.com/auth/calendar'
            ]
          }), conversationId)
          .then((res) => {
            console.log('Message sent: ', res.ts);
          })
          .catch(console.error);
        }
      }
    });
  });

  rtm.on('ready', (event) => {
    console.log("READY")
  })


const port = process.env.PORT || 1337;
app.listen(port, () => {
  console.log(`Server listening on port ${port}!`);
});

module.exports = app;
