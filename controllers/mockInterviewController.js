const MockInterview = require('../models/MockInterview');
const Resume = require('../models/Resume');
const { generateMockInterviewQuestions, evaluateMockInterviewAnswer } = require('../services/geminiService');

/**
 * @desc    Start/Generate a new Mock Interview Session
 * @route   POST /api/interviews/generate
 * @access  Private
 */
const startMockInterview = async (req, res, next) => {
  try {
    const { resumeId, targetRole, targetCompany } = req.body;

    if (!resumeId || !targetRole) {
      return res.status(400).json({ success: false, message: 'Please provide resumeId and targetRole' });
    }

    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume version not found' });
    }

    // Verify ownership
    if (resume.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const company = targetCompany || resume.targetCompany || 'Any';

    // 1. Call Gemini to generate tailored questions
    const questionsData = await generateMockInterviewQuestions(resume.parsedText, targetRole, company);

    // 2. Create interview document
    const interview = await MockInterview.create({
      user: req.user.id,
      resume: resumeId,
      targetRole,
      targetCompany: company,
      questions: questionsData.map(q => ({
        questionText: q.questionText,
        category: q.category,
        userAnswer: '',
        evaluation: { score: 0, strengths: '', weaknesses: '', suggestions: '' }
      }))
    });

    res.status(201).json({
      success: true,
      interview
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit an answer for a specific question inside an interview
 * @route   POST /api/interviews/:id/answer
 * @access  Private
 */
const submitQuestionAnswer = async (req, res, next) => {
  try {
    const { questionId, userAnswer } = req.body;
    const interviewId = req.params.id;

    if (!questionId || userAnswer === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide questionId and userAnswer' });
    }

    const interview = await MockInterview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: 'Mock interview session not found' });
    }

    // Verify ownership
    if (interview.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Find the question to answer
    const question = interview.questions.id(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found in this interview session' });
    }

    // Call Gemini to evaluate the answer
    const evaluation = await evaluateMockInterviewAnswer(
      question.questionText,
      question.category,
      userAnswer,
      interview.targetRole,
      interview.targetCompany
    );

    // Update question
    question.userAnswer = userAnswer;
    question.answeredAt = new Date();
    question.evaluation = {
      score: evaluation.score || 0,
      strengths: evaluation.strengths || '',
      weaknesses: evaluation.weaknesses || '',
      suggestions: evaluation.suggestions || ''
    };

    // Check if all questions are answered
    const allAnswered = interview.questions.every(q => q.userAnswer && q.userAnswer.trim().length > 0);
    
    if (allAnswered) {
      interview.completed = true;
      // Calculate overall score
      const totalScore = interview.questions.reduce((sum, q) => sum + q.evaluation.score, 0);
      interview.overallScore = Math.round(totalScore / interview.questions.length);
    }

    await interview.save();

    res.json({
      success: true,
      question,
      completed: interview.completed,
      overallScore: interview.overallScore
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's mock interview history
 * @route   GET /api/interviews
 * @access  Private
 */
const getInterviewHistory = async (req, res, next) => {
  try {
    const interviews = await MockInterview.find({ user: req.user.id })
      .populate('resume', 'version targetRole targetCompany originalName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: interviews.length,
      interviews
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get detailed mock interview session
 * @route   GET /api/interviews/:id
 * @access  Private
 */
const getInterviewDetails = async (req, res, next) => {
  try {
    const interview = await MockInterview.findById(req.params.id)
      .populate('resume', 'version targetRole targetCompany originalName');

    if (!interview) {
      return res.status(404).json({ success: false, message: 'Mock interview session not found' });
    }

    if (interview.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    res.json({
      success: true,
      interview
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startMockInterview,
  submitQuestionAnswer,
  getInterviewHistory,
  getInterviewDetails
};
