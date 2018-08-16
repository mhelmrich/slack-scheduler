const {WebClient, RTMClient, Users} = require('@slack/client');
const {google} = require('googleapis');
const app = require('express')();
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const dialogflow = require('dialogflow');
const events = require('events');

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
let currentUser = null;

// Google OAuth
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  `${process.env.SERVER_URL}/oauthcallback`
);

// Dialogflow
const sessionClient = new dialogflow.SessionsClient();

// Event emitter
const eventEmitter = new events.EventEmitter();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use('/', routes(oauth2Client));
app.post('/button', (req, res) => eventEmitter.emit(req.body.payload.channel.id));

rtm.start();
rtm.on('ready', (event) => console.log("Slack RTM ready!"));

function addReminder(result, calendar, channel) {
  calendar.events.insert({
    calendarId: 'primary', // Go to setting on your calendar to get Id
    'resource': {
      'summary': result.parameters.fields.subject.stringValue,
      'location': '800 Howard St., San Francisco, CA 94103',
      'description': result.parameters.fields.subject.stringValue,
      'start': {
        'dateTime': result.parameters.fields.date.stringValue,
        'timeZone': 'America/Los_Angeles'
      },
      'end': {
        'dateTime': result.parameters.fields.date.stringValue,
        'timeZone': 'America/Los_Angeles'
      }
    }
  }, (err, {data}) => {
    if (err) return console.log('Error creating reminder event:', err);
    console.log('Reminder event created');
  });
  rtm.webClient.reminders.add({
    token:process.env.BOT_TOKEN,
    text: result.parameters.fields.subject.stringValue,
    user: currentUser.slackId,
    time: 'In 1 minute'
  }).catch(err => console.log('Error creating slack reminder', err));
  rtm.webClient.reminders.list({token:process.env.BOT_TOKEN})
  .then((reminders) => console.log(reminders));
  rtm.sendMessage(result.fulfillmentText, channel);
}

function listEvents(result, calendar, channel) {
  calendar.events.list({
    calendarId: 'primary', // Go to setting on your calendar to get Id
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) return console.log('Error getting calendar events:', err);
    const events = res.data.items;
    if (events.length) {
      events.map((event) => {
        const start = event.start.dateTime || event.start.date;
        result.fulfillmentText += `\n${start} - ${event.summary}`;
      });
      rtm.sendMessage(result.fulfillmentText, channel);
    } else rtm.sendMessage('You don\'t have any upcoming events.', channel);
  });
}

function scheduleMeeting(result, calendar, channel) {
  let invitees = result.parameters.fields.invitee.listValue.values;
  for (let i = 0; i < invitees.length; i++) invitees[i] = invitees[i].stringValue;
  if (invitees.length === 1 && invitees[0].length > 9) {
    ids = [];
    for (let i = 0; i < invitees[0].length; i++) {
      if (invitees[0][i] === '@') ids.push(invitees[0].slice(i+1, i+10));
    }
    invitees = ids;
  }
  let message = result.fulfillmentText + '\nInvitees:';
  for (let i = 0; i < invitees.length; i++) message += `\n<@${invitees[i]}>`;
  rtm.sendMessage(message, channel);
}

function getCalendar(user) {
  oauth2Client.setCredentials(user.calendarToken);
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) user.update({$set: {calendarTokens: tokens}}, () => (true);
  });
  return google.calendar({version: "v3", auth: oauth2Client});
}

function handleIntent(result, user, channel) {
  switch (result.intent.displayName) {
    case 'reminder:add':
      addReminder(result, getCalendar(user), channel);
      break;
    case 'calendar:events':
      listEvents(result, getCalendar(user), channel);
      break;
    case 'meeting:schedule':
      scheduleMeeting(result, getCalendar(user), channel);
      break;
  }
}

function handleButtons(result, channel) {
  let text = "Create reminder?"
  if (result.intent.displayName === "meeting:schedule") {
    let date = result.parameters.fields.date.listValue.values[0].stringValue.slice(0, 10);
    let time = result.parameters.fields.time.stringValue.slice(11, 16);
    text = `Schedule this meeting for ${date} at ${time}?`;
  }
  web.chat.postMessage({
    channel: channel,
    as_user: true,
    text: text,
    response_url: `${process.env.SERVER_URL}/button`,
    attachments: [
    { fallback: `Unable to ${text[1].toLowerCase()}${text.slice(1, text.length-1)}.`,
      callback_id: "schedule_reminder",
      color: "#3AA3E3",
      attachment_type: "default",
      actions: [
      { name: "decision",
        text: "Yes",
        type: "button",
        style: "primary",
        value: "yes"
      },
      { name: "decision",
        text: "No",
        style: "danger",
        type: "button",
        value: "no"
      }]
    }]
  });
}

rtm.on('message', (event) => {
  if(event.bot_id !== 'BC8N825N3') {
    User.findOne({slackId: event.user})
    .then((user) => {
      if (user) {
        currentUser = user;
        const request = {
          session: sessionClient.sessionPath(process.env.DIALOGFLOW_PROJECT_ID, user.slackId),
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
            console.log(`  Session: ${request.session.slice(48)}`);
            console.log(`  Query: ${result.queryText}`);
            console.log(`  Intent: ${result.intent.displayName}`);
            console.log(`  Fields:\n${JSON.stringify(result.parameters.fields)}`);
            console.log(`  Response: ${result.fulfillmentText}`);
            console.log('--------------');
            if (result.fulfillmentText[0] === '#') {
              result.fulfillmentText = result.fulfillmentText.slice(1);
              eventEmitter.once(event.channel, () => handleIntent(result, user, event.channel));
              if (result.intent.displayName !== 'calendar:events') handleButtons(result, event.channel);
              else eventEmitter.emit(event.channel);
            } else rtm.sendMessage(result.fulfillmentText, event.channel);
          }).catch(err => console.error('Error detecting intent:', err));
      } else {
        //slack authentication link for google calendar
        const url = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          state: event.user,
          scope: ['https://www.googleapis.com/auth/calendar']
        });
        rtm.sendMessage(`Hello there!\nPlease click this link so I can assist you!\n${url}`, event.channel)
        .then(() => console.log('User not authenticated, link sent.'))
        .catch((err) => console.log('Error sending authentication link:', err));
      }
    }).catch((err) => console.log('Error looking up user:', err));
  }
});

const port = process.env.PORT || 1337;
app.listen(port, () => console.log(`Server listening on port ${port}!`));
