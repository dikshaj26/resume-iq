const mongoose = require('mongoose');

const JobMatchSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resume: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
    required: true
  },
  jobTitle: {
    type: String,
    required: true
  },
  company: {
    type: String,
    default: 'Unknown'
  },
  jobDescriptionText: {
    type: String,
    required: true
  },
  matchPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  roleFit: {
    type: String,
    default: ''
  },
  missingKeywords: [{ type: String }],
  missingSkills: [{ type: String }],
  atsSuggestions: {
    type: String,
    default: ''
  },
  learningRoadmap: {
    steps: [{ type: String }],
    skillsToLearn: [{ type: String }],
    timeline: { type: String, default: '4-6 weeks' }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('JobMatch', JobMatchSchema);
