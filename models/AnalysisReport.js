const mongoose = require('mongoose');

const AnalysisReportSchema = new mongoose.Schema({
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
  targetRole: {
    type: String,
    required: true
  },
  targetCompany: {
    type: String,
    default: 'Any'
  },
  overallScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  scores: {
    formatting: { type: Number, default: 0 },
    skills: { type: Number, default: 0 },
    experience: { type: Number, default: 0 },
    education: { type: Number, default: 0 },
    keyword: { type: Number, default: 0 },
    readability: { type: Number, default: 0 }
  },
  professionalSummary: {
    type: String,
    default: ''
  },
  atsFeedback: {
    type: String,
    default: ''
  },
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  skillsMatch: {
    matched: [{ type: String }],
    missing: [{ type: String }]
  },
  keywords: {
    matched: [{ type: String }],
    missing: [{ type: String }]
  },
  formattingReview: {
    type: String,
    default: ''
  },
  grammarReview: {
    type: String,
    default: ''
  },
  projectAnalysis: {
    type: String,
    default: ''
  },
  certificationSuggestions: [{ type: String }],
  careerSuggestions: [{ type: String }],
  priorityImprovements: [{ type: String }],
  socialAnalysis: {
    github: {
      score: { type: Number, default: 0 },
      critique: { type: String, default: '' },
      suggestions: [{ type: String }]
    },
    linkedin: {
      score: { type: Number, default: 0 },
      critique: { type: String, default: '' },
      suggestions: [{ type: String }]
    },
    portfolio: {
      score: { type: Number, default: 0 },
      critique: { type: String, default: '' },
      suggestions: [{ type: String }]
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AnalysisReport', AnalysisReportSchema);
