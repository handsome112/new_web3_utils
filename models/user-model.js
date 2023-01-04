const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  address: String,
  nonce: String,
  loginCount: Number,
  wallet: String
});

const User = mongoose.model("user", userSchema);

module.exports = User;
