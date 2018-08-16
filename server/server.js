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
let currentUser = null;

// Google OAuth
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);

// Dialogflow
const sessionClient = new dialogflow.SessionsClient();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use('/', routes(oauth2Client));

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

function getCalendar(token) {
  oauth2Client.setCredentials(token);
  oauth2Client.on('tokens', (tokens) => {
    //access tokens should be acquired and refreshed automatically on next API call
    if (tokens.refresh_token) {
      // store the refresh_token in my database!
      console.log('Refresh token:', tokens.refresh_token);
    }
    console.log('Access token:', tokens.access_token);
  });
  return google.calendar({version: "v3", auth: oauth2Client});
}

function handleIntent(result, token, channel) {
  switch (result.intent.displayName) {
    case 'reminder:add':
      addReminder(result, getCalendar(token), channel);
      break;
    case 'calendar:events':
      listEvents(result, getCalendar(token), channel);
      break;
    case 'meeting:schedule':
      scheduleMeeting(result, getCalendar(token), channel);
      break;
  }
}

function handleButtons(conversationId, result)
{
  web.chat.postMessage({
    channel: conversationId,
    as_user: true,
    text: "Create task to " + result.parameters.fields.subject.stringValue + " " +  result.queryText + "?",
    response_url: "https://b5614342.ngrok.io/confirmationButton", //THIS CHANGES EVERY TIME NGROK IS RUN!!!!!!!!
    attachments: [
    {
      fallback: "You are unable schedule a reminder",
      callback_id: "schedule_reminder",
      color: "#3AA3E3",
      attachment_type: "default",
      actions: [
      {
        name: "decision",
        text: "Yes",
        type: "button",
        style: "primary",
        value: "yes"//,
 /*                     confirm: {
                        title: "Are you sure?",
                        text: "",
                        ok_text: "Yes",
                        dismiss_text: "No"
                      }*/
      },
      {
        name: "decision",
        text: "No",
        style: "danger",
        type: "button",
        value: "no"//,
 /*                     confirm: {
                        title: "Are you sure?",
                        text: "",
                        ok_text: "Yes",
                        dismiss_text: "No"
                      }*/
      }]
    }]
  })
  .then((res) => {
  // `res` contains information about the posted message
    console.log('Message sent: ', res.ts)
   })
   .catch(console.error)
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
              handleButtons(event.channel, result);//double check event.channel
              result.fulfillmentText = result.fulfillmentText.slice(1);
              handleIntent(result, user.calendar.token, event.channel);
            }
            else rtm.sendMessage(result.fulfillmentText, event.channel);
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


//have token, time, date, subject in makeCalendarAPICall
//save date into global array since it's not in payload
  app.post('/confirmationButton', (req, res) => {
    console.log("In the post!");
    //call makecalendarapi with arguments from payload
    console.log(">>>>PAYLOAD>>>>", JSON.parse(req.body.payload));//actions name key corresponds to yes. Only check to see if they confirm or no
 /*   ^^ find actions in payload and as above= req.body.payload.
    makeCalendarAPICall(calendarToken, calendarIntent, calendarConversationId)
*/
    res.end();
  });

const port = process.env.PORT || 1337;
app.listen(port, () => console.log(`Server listening on port ${port}!`));
