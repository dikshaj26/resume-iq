const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'dark'
  },
  emailNotifications: {
    type: Boolean,
    default: true
  },
  autoOptimize: {
    type: Boolean,
    default: false
  },
  defaultTargetRole: {
    type: String,
    default: 'Software Engineer'
  },
  defaultTargetCompany: {
    type: String,
    default: 'Google'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Settings', SettingsSchema);
