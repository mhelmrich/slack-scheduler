const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const taskSchema = new Schema({
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

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;
