const mongoose = require("mongoose");
var Schema = mongoose.Schema;


var TaskSchema = new Schema (
{
  subject: {
    type: String,
    required: true
  },
  day: {
    type: String,
    required: true
  },
  calendarEventId: String,
  requesterId: String
});


var Task = mongoose.model("Task", TaskSchema);

module.exports = {Task: Task};
