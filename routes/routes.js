var express = require('express');
var bodyParser = require('body-parser');
const {google} = require('googleapis')
var router = express.Router();
var User = require("../server/models/user.js").User;

const oauth2Client = new google.auth.OAuth2 (
 process.env.CLIENT_ID,
 process.env.CLIENT_SECRET,
 process.env.REDIRECT_URL
)

router.get("/oauthcallback", function(req, res)
{
  oauth2Client.getToken(req.query.code, function (err, token) {
    if (err) return console.error(err.message)
    {
      console.log('token', token);
      console.log('\n');
      console.log('req.query:', req.query) // req.query.state <- meta-data

      console.log('--------------------------\n')
      var newUser = new User ({
      slackId: req.query.state
/*
        googleCalendarAccount: {
          accessToken: token.access_token,
          refreshToken: token.refresh_token
        },
        defaultSetting: {
          meetingLength: 30
        }
        slackUsername: String,
        slackEmail: String,
        slackDmIds: []
      });*/
//then save the user
      });
      newUser.save(function(error) {
        if (error)
        {
          console.log("Rekt...");
        }
        else
        {
          console.log("SUCCESSFULLY SAVED USER WHOOOOOOOOOOOOOOOOOOOOOOO!");
        }
      })
      res.send('Congratulations! You have successfully linked your Google Calendar!')
    }
  });
});


router.post("/oauthcallback", function(req, res)
{
  console.log("req.body is: ", req.body);
});


module.exports = router;
