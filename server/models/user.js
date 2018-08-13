const mongoose = require("mongoose");
var Schema = mongoose.Schema;


var UserSchema = new Schema (
{
  googleCalendarAccount: {
    accessToken: String,
    refreshToken: String,
    googlePlusProfile: String
  },
  defaultSetting: {
    meetingLength: Number//in minutes
  },
  slackId: String,
  slackUsername: String,
  slackEmail: String,
  slackDmIds: []
});


var User = mongoose.model("User", UserSchema);


module.exports = {User: User}
