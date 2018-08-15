const {WebClient, RTMClient, Users} = require('@slack/client');
const {google} = require('googleapis');
const app = require('express')();
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const dialogflow = require('dialogflow');

const User = require("./models/user.js");
const Task = require("./models/task.js");
//const InviteRequest = require("./models/inviteRequest.js").inviteRequest;
//const Meeting = require("./models/meeting.js").Meeting;
const routes = require("./routes/routes.js");

// MongoDB
mongoose.connection.on("connected", () => console.log("Connected to MongoDB!"));
mongoose.connect(process.env.MONGODB_URI);

// Slack
const slackToken = process.env.SLACK_TOKEN;
const web = new WebClient(slackToken);
const rtm = new RTMClient(slackToken);

// Google OAuth
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);

// Dialogflow
const sessionId = 'slackchat-1';
const sessionClient = new dialogflow.SessionsClient();
const sessionPath = sessionClient.sessionPath(process.env.DIALOGFLOW_PROJECT_ID, sessionId);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use('/', routes(oauth2Client));

rtm.start();
rtm.on('ready', (event) => console.log("Slack RTM ready!"));

function handleIntent(calendar, intent, conversationId){
  switch (intent.intent.displayName) {
    case 'reminder:add':
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
          }
        }
      }, (err, {data}) => {
        if (err) return console.log('The API returned an error: ' + err);
        console.log(data);
      });
      rtm.webClient.reminders.add({
        token: slackToken,
        text: intent.parameters.fields.subject.stringValue,
        time: "in 1 minute"});
      console.log(rtm.webClient.reminders.list({token: slackToken}))
      break;
    case 'calendar:events':
      calendar.events.list({
        calendarId: 'primary', // Go to setting on your calendar to get Id
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
      }, (err, res) => {
        if (err) return console.log('Error with calendar API: ' + err);
        const events = res.data.items;
        if (events.length) {
          let message = 'Upcoming 10 events: ';
          events.map((event) => {
            const start = event.start.dateTime || event.start.date;
            message += '\n'+ start + ' - ' + event.summary;
          });
          rtm.sendMessage(message, conversationId);
        } else rtm.sendMessage("You don't have any upcoming events.", conversationId);
      });
  }
}

function makeCalendarAPICall(token, intent, conversationId) {
  oauth2Client.setCredentials(token);
  oauth2Client.on('tokens', (tokens) => {
    //access tokens should be acquired and refreshed automatically on next API call
    if (tokens.refresh_token) {
      // store the refresh_token in my database!
      console.log(tokens.refresh_token);
    }
    console.log(tokens.access_token);
  });
  const calendar = google.calendar({version: "v3", auth: oauth2Client});
  handleIntent(calendar, intent, conversationId);
}

rtm.on('message', (event) => {
  console.log('RTM received a message');
  User.findOne({slackId: event.user})
  .then((user) => {
    if (user) {
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
          console.log('--DIALOGFLOW--');
          console.log(`  Query: ${result.queryText}`);
          console.log(`  Intent: ${result.intent.displayName}`);
          //console.log(`  Fields:\n${JSON.stringify(result.parameters.fields)}`);
          console.log(`  Response: ${result.fulfillmentText}`);
          console.log('--------------');
          rtm.sendMessage(result.fulfillmentText, event.channel)
          if (result.intent) makeCalendarAPICall(user.googleCalendarAccount.token, result, event.channel);
        })
        .catch(err => console.error('Error detecting intent:', err));
    } else {
      //slack authentication link for google calendar
      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        state: user,
        scope: ['https://www.googleapis.com/auth/calendar']
      });
      rtm.sendMessage(`Hello there!\nPlease click this link so I can assist you!\n${url}`, event.channel)
      .then(() => console.log('User not authenticated, link sent.'))
      .catch((err) => console.log(err));
    }
  }).catch((err) => console.log('Error looking up user:', err));
});

const port = process.env.PORT || 1337;
app.listen(port, () => console.log(`Server listening on port ${port}!`));
