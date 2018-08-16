const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  calendar: {
    token: {},
    googlePlusProfile: String
  },
  defaultSetting: {
    meetingLength: Number//in minutes
  },
  slackId: String,
  slackUsername: String,
  slackEmail: String,
  slackDmIds: String
});

const User = mongoose.model("User", userSchema);

module.exports = User;
