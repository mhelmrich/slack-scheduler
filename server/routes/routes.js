const router = require('express').Router();
const bodyParser = require('body-parser');
const axios = require('axios');

const User = require("../models/user.js");

module.exports = (oauth2Client) => {

  router.get("/oauthcallback", (req, res) => {
    oauth2Client.getToken(req.query.code, (err, token) => {
      if (err) return console.error('Error receiving calendar token:', err);
      console.log(req.query);

      axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token.access_token}`)
      .then((response) => {
        (new User ({
          slackId: req.query.state,
          calendarTokens: token,
          email: response.data.email
          //additional user info from schema
        })).save()
        .then(() => (res.send('Congratulations! You have successfully linked your Google Calendar!')))
        .catch((err) => ('Error saving user:', err));
      })
      .catch((err) => {
        console.log(err)
      })

      /*(new User ({
        slackId: req.query.state,
        calendarTokens: token,
        //additional user info from schema
      })).save()
      .then(() => (res.send('Congratulations! You have successfully linked your Google Calendar!')))
      .catch((err) => ('Error saving user:', err));*/
    });
  });

  return router;
}
