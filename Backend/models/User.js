const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, enum: ['brand','creator'], required: true },
  verified: { type: Boolean, default: false }, // KYC / authenticity
  profile: {
    niche: String,
    platform: String,
    followers: Number,
    engagement: Number,
    ageDistribution: Object, // e.g. { '13-18':12, '19-24':55 }
    location: String,
    bio: String
  },
  createdAt: { type: Date, default: Date.now },
  firstPaidCollabDone: { type: Boolean, default: false } // for fee-on-first-collab
});

module.exports = mongoose.model('User', UserSchema);
