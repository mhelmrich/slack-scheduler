const router = require('express').Router();
const bodyParser = require('body-parser');

const User = require("../models/user.js");

module.exports = (oauth2Client) => {

  router.get("/oauthcallback", (req, res) => {
    oauth2Client.getToken(req.query.code, (err, token) => {
      if (err) return console.error('Error receiving calendar token:', err);
      (new User ({
        slackId: req.query.state,
        googleCalendarAccount: {
          token: token
        }
        //additional user info from schema
      })).save()
      .then(() => (res.send('Congratulations! You have successfully linked your Google Calendar!')))
      .catch((err) => ('Error saving user:', err));
    });
  });

  return router;
}
