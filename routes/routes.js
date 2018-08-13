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
/*
      var newUser = new User ({
        googleCalendarAccount: {
          accessToken: token.access_token, 
          refreshToken: token.refresh_token
        },
        defaultSetting: {
          meetingLength: 30
        }
       slackId: String,//FINISH ADDING THESE!!!!!!!!!!
        slackUsername: String,
        slackEmail: String,
        slackDmIds: []
      });*/
//then save the user
    }
    res.send('Congratulations! You have successfully linked your Google Calendar!')
  });
});


router.post("/oauthcallback", function(req, res)
{
  console.log("req.body is: ", req.body);
});


module.exports = router;
