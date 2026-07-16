const AnalysisReport = require('../models/AnalysisReport');
const Resume = require('../models/Resume');
const { analyzeSocialProfiles } = require('../services/geminiService');

/**
 * @desc    Get detailed analysis report by ID
 * @route   GET /api/analysis/:id
 * @access  Private
 */
const getAnalysisDetails = async (req, res, next) => {
  try {
    const report = await AnalysisReport.findById(req.params.id).populate('resume');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Analysis report not found' });
    }

    if (report.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    res.json({
      success: true,
      report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get the latest analysis report for a specific resume version
 * @route   GET /api/analysis/resume/:resumeId
 * @access  Private
 */
const getReportByResume = async (req, res, next) => {
  try {
    const report = await AnalysisReport.findOne({ resume: req.params.resumeId });

    if (!report) {
      return res.status(404).json({ success: false, message: 'No analysis report found for this resume version' });
    }

    if (report.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    res.json({
      success: true,
      report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all analysis reports for the user
 * @route   GET /api/analysis/history
 * @access  Private
 */
const getAnalysisHistory = async (req, res, next) => {
  try {
    const reports = await AnalysisReport.find({ user: req.user.id })
      .populate({
        path: 'resume',
        select: 'originalName version targetRole targetCompany parentResumeId'
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get trend data of ATS scores over time for Chart.js
 * @route   GET /api/analysis/trends
 * @access  Private
 */
const getAnalysisTrends = async (req, res, next) => {
  try {
    // Retrieve user's reports populated with resume details
    const reports = await AnalysisReport.find({ user: req.user.id })
      .populate('resume', 'version targetRole targetCompany parentResumeId')
      .sort({ createdAt: 1 }); // Sorted chronologically to plot trend

    // Format for charts: date, score, version
    const trends = reports.map(r => ({
      reportId: r._id,
      date: r.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      overallScore: r.overallScore,
      formatting: r.scores.formatting,
      skills: r.scores.skills,
      experience: r.scores.experience,
      education: r.scores.education,
      keyword: r.scores.keyword,
      readability: r.scores.readability,
      version: r.resume ? `v${r.resume.version}` : 'v1',
      role: r.targetRole,
      company: r.targetCompany
    }));

    res.json({
      success: true,
      trends
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Run social media audits and save results to report
 * @route   POST /api/analysis/social
 * @access  Private
 */
const runSocialAudit = async (req, res, next) => {
  try {
    const { githubUrl, linkedinUrl, portfolioUrl, userProvidedBio, reportId } = req.body;

    const report = await AnalysisReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Reference analysis report not found' });
    }

    if (report.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Call Gemini API review
    const socialAudit = await analyzeSocialProfiles(
      githubUrl,
      linkedinUrl,
      portfolioUrl,
      userProvidedBio,
      report.targetRole
    );

    // Save back to the report
    report.socialAnalysis = socialAudit;
    await report.save();

    res.json({
      success: true,
      socialAnalysis: socialAudit
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalysisDetails,
  getReportByResume,
  getAnalysisHistory,
  getAnalysisTrends,
  runSocialAudit
};
