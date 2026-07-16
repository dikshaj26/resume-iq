const mongoose = require('mongoose');

const MockInterviewSchema = new mongoose.Schema({
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
    default: 0
  },
  questions: [
    {
      questionText: {
        type: String,
        required: true
      },
      category: {
        type: String,
        enum: ['HR', 'Technical', 'Behavioral', 'Project'],
        required: true
      },
      userAnswer: {
        type: String,
        default: ''
      },
      answeredAt: {
        type: Date
      },
      evaluation: {
        score: { type: Number, default: 0 },
        strengths: { type: String, default: '' },
        weaknesses: { type: String, default: '' },
        suggestions: { type: String, default: '' }
      }
    }
  ],
  completed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MockInterview', MockInterviewSchema);
