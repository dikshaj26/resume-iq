const JobMatch = require('../models/JobMatch');
const Resume = require('../models/Resume');
const { compareResumeToJobDescription, generateCoverLetter } = require('../services/geminiService');

/**
 * @desc    Compare resume against a job description
 * @route   POST /api/job-match
 * @access  Private
 */
const matchJobDescription = async (req, res, next) => {
  try {
    const { resumeId, jobTitle, company, jobDescriptionText, tone } = req.body;

    if (!resumeId || !jobDescriptionText) {
      return res.status(400).json({ success: false, message: 'Please provide resumeId and jobDescriptionText' });
    }

    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume version not found' });
    }

    // Verify ownership
    if (resume.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Intercept if requesting Cover Letter only
    if (req.headers['x-generate-cover-letter-only'] === 'true') {
      const coverLetter = await generateCoverLetter(resume.parsedText, jobDescriptionText, tone || 'Professional');
      return res.json({
        success: true,
        coverLetter
      });
    }

    if (!jobTitle) {
      return res.status(400).json({ success: false, message: 'Please provide jobTitle for comparison' });
    }

    // Call Gemini API to calculate gap analysis
    const matchAnalysis = await compareResumeToJobDescription(
      resume.parsedText,
      jobDescriptionText,
      jobTitle,
      company || 'Unknown'
    );

    // Save matching report
    const jobMatch = await JobMatch.create({
      user: req.user.id,
      resume: resumeId,
      jobTitle,
      company: company || 'Unknown',
      jobDescriptionText,
      matchPercentage: matchAnalysis.matchPercentage,
      roleFit: matchAnalysis.roleFit,
      missingKeywords: matchAnalysis.missingKeywords,
      missingSkills: matchAnalysis.missingSkills,
      atsSuggestions: matchAnalysis.atsSuggestions,
      learningRoadmap: matchAnalysis.learningRoadmap
    });

    res.status(201).json({
      success: true,
      jobMatch
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's job match history
 * @route   GET /api/job-match
 * @access  Private
 */
const getJobMatches = async (req, res, next) => {
  try {
    const matches = await JobMatch.find({ user: req.user.id })
      .populate('resume', 'version targetRole targetCompany originalName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: matches.length,
      matches
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get detailed job match report
 * @route   GET /api/job-match/:id
 * @access  Private
 */
const getJobMatchDetails = async (req, res, next) => {
  try {
    const match = await JobMatch.findById(req.params.id)
      .populate('resume', 'version targetRole targetCompany originalName');

    if (!match) {
      return res.status(404).json({ success: false, message: 'Job match analysis not found' });
    }

    if (match.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    res.json({
      success: true,
      jobMatch: match
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  matchJobDescription,
  getJobMatches,
  getJobMatchDetails
};
