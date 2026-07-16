const Resume = require('../models/Resume');
const AnalysisReport = require('../models/AnalysisReport');
const { parsePDF } = require('../services/pdfService');
const { analyzeResume, optimizeResume } = require('../services/geminiService');
const { calculateLocalAtsMetrics } = require('../services/atsService');
const fs = require('fs');

/**
 * Helper to serialize parsedData into a plain text representation
 * used for running new analysis iterations on edited/optimized versions
 */
function convertParsedDataToText(parsedData) {
  let text = '';
  
  if (parsedData.personalInfo) {
    const { name, email, phone, location, website } = parsedData.personalInfo;
    text += `${name || ''}\n${email || ''} | ${phone || ''} | ${location || ''}\n${website || ''}\n\n`;
  }
  
  if (parsedData.summary) {
    text += `SUMMARY\n${parsedData.summary}\n\n`;
  }
  
  if (parsedData.skills) {
    text += `SKILLS\n`;
    if (parsedData.skills.technical && parsedData.skills.technical.length > 0) {
      text += `Technical: ${parsedData.skills.technical.join(', ')}\n`;
    }
    if (parsedData.skills.soft && parsedData.skills.soft.length > 0) {
      text += `Soft Skills: ${parsedData.skills.soft.join(', ')}\n`;
    }
    if (parsedData.skills.languages && parsedData.skills.languages.length > 0) {
      text += `Languages: ${parsedData.skills.languages.join(', ')}\n`;
    }
    text += `\n`;
  }
  
  if (parsedData.experience && parsedData.experience.length > 0) {
    text += `EXPERIENCE\n`;
    parsedData.experience.forEach(exp => {
      text += `${exp.role || ''} - ${exp.company || ''} (${exp.location || ''})\n`;
      text += `${exp.startDate || ''} to ${exp.endDate || (exp.current ? 'Present' : '')}\n`;
      text += `${exp.description || ''}\n\n`;
    });
  }
  
  if (parsedData.projects && parsedData.projects.length > 0) {
    text += `PROJECTS\n`;
    parsedData.projects.forEach(proj => {
      text += `${proj.title || ''}\n`;
      if (proj.technologies && proj.technologies.length > 0) {
        text += `Technologies: ${proj.technologies.join(', ')}\n`;
      }
      text += `${proj.description || ''}\n`;
      if (proj.url) text += `Link: ${proj.url}\n`;
      text += `\n`;
    });
  }
  
  if (parsedData.education && parsedData.education.length > 0) {
    text += `EDUCATION\n`;
    parsedData.education.forEach(edu => {
      text += `${edu.degree || ''} in ${edu.fieldOfStudy || ''}\n`;
      text += `${edu.school || ''} (${edu.startDate || ''} - ${edu.endDate || ''})\n`;
      if (edu.gpa) text += `GPA: ${edu.gpa}\n`;
      text += `\n`;
    });
  }
  
  return text.trim();
}

/**
 * @desc    Upload new resume (V1) & instantly run ATS analysis
 * @route   POST /api/resumes/upload
 * @access  Private
 */
const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a PDF resume file' });
    }

    const targetRole = req.body.targetRole || 'Software Engineer';
    const targetCompany = req.body.targetCompany || 'Any';

    const pdfPath = req.file.path;
    
    // 1. Extract text from PDF
    const extractedText = await parsePDF(pdfPath);

    // 2. Call Gemini service to structure and analyze resume
    const aiAnalysis = await analyzeResume(extractedText, targetRole, targetCompany);

    // 3. Local heuristics to adjust formatting and readability score
    const localMetrics = calculateLocalAtsMetrics(extractedText);
    if (aiAnalysis.scores) {
      aiAnalysis.scores.formatting = Math.round((aiAnalysis.scores.formatting + localMetrics.formattingScore) / 2);
      aiAnalysis.scores.readability = Math.round((aiAnalysis.scores.readability + localMetrics.readabilityScore) / 2);
      aiAnalysis.overallScore = Math.round(
        (aiAnalysis.scores.formatting + 
         aiAnalysis.scores.skills + 
         aiAnalysis.scores.experience + 
         aiAnalysis.scores.education + 
         aiAnalysis.scores.keyword + 
         aiAnalysis.scores.readability) / 6
      );
    }

    // 4. Create and save Resume V1
    const newResume = await Resume.create({
      user: req.user.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      parsedText: extractedText,
      version: 1,
      targetRole: targetRole,
      targetCompany: targetCompany,
      parsedData: aiAnalysis.parsedData || {}
    });

    // 5. Save Analysis Report linked to V1 Resume
    const report = await AnalysisReport.create({
      user: req.user.id,
      resume: newResume._id,
      targetRole: targetRole,
      targetCompany: targetCompany,
      overallScore: aiAnalysis.overallScore,
      scores: aiAnalysis.scores,
      professionalSummary: aiAnalysis.professionalSummary,
      atsFeedback: aiAnalysis.atsFeedback,
      strengths: aiAnalysis.strengths,
      weaknesses: aiAnalysis.weaknesses,
      skillsMatch: aiAnalysis.skillsMatch,
      keywords: aiAnalysis.keywords,
      formattingReview: aiAnalysis.formattingReview,
      grammarReview: aiAnalysis.grammarReview,
      projectAnalysis: aiAnalysis.projectAnalysis,
      certificationSuggestions: aiAnalysis.certificationSuggestions,
      careerSuggestions: aiAnalysis.careerSuggestions,
      priorityImprovements: aiAnalysis.priorityImprovements,
      socialAnalysis: aiAnalysis.socialAnalysis || {}
    });

    res.status(201).json({
      success: true,
      resume: newResume,
      report: report
    });
  } catch (error) {
    // Cleanup physical file on upload error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

/**
 * @desc    Save a manually edited resume as a new version & run analysis
 * @route   POST /api/resumes/:id/version
 * @access  Private
 */
const createResumeVersion = async (req, res, next) => {
  try {
    const parentResume = await Resume.findById(req.params.id);

    if (!parentResume) {
      return res.status(404).json({ success: false, message: 'Parent resume version not found' });
    }

    // Check ownership
    if (parentResume.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized to edit this resume' });
    }

    const { parsedData, targetRole, targetCompany } = req.body;
    
    // Find latest version number in this series
    const seriesId = parentResume.parentResumeId || parentResume._id;
    const latestVersionDoc = await Resume.findOne({
      $or: [
        { _id: seriesId },
        { parentResumeId: seriesId }
      ]
    }).sort({ version: -1 });

    const newVersionNum = latestVersionDoc ? latestVersionDoc.version + 1 : 2;

    // Convert edited sections to text
    const textRepresentation = convertParsedDataToText(parsedData);

    // Run new ATS analysis
    const aiAnalysis = await analyzeResume(textRepresentation, targetRole || parentResume.targetRole, targetCompany || parentResume.targetCompany);

    // Save as new version
    const newVersion = await Resume.create({
      user: req.user.id,
      filename: parentResume.filename,
      originalName: parentResume.originalName,
      path: parentResume.path,
      size: parentResume.size,
      parsedText: textRepresentation,
      version: newVersionNum,
      parentResumeId: seriesId,
      targetRole: targetRole || parentResume.targetRole,
      targetCompany: targetCompany || parentResume.targetCompany,
      parsedData: parsedData
    });

    // Create a new analysis report for this version
    const report = await AnalysisReport.create({
      user: req.user.id,
      resume: newVersion._id,
      targetRole: targetRole || parentResume.targetRole,
      targetCompany: targetCompany || parentResume.targetCompany,
      overallScore: aiAnalysis.overallScore,
      scores: aiAnalysis.scores,
      professionalSummary: aiAnalysis.professionalSummary,
      atsFeedback: aiAnalysis.atsFeedback,
      strengths: aiAnalysis.strengths,
      weaknesses: aiAnalysis.weaknesses,
      skillsMatch: aiAnalysis.skillsMatch,
      keywords: aiAnalysis.keywords,
      formattingReview: aiAnalysis.formattingReview,
      grammarReview: aiAnalysis.grammarReview,
      projectAnalysis: aiAnalysis.projectAnalysis,
      certificationSuggestions: aiAnalysis.certificationSuggestions,
      careerSuggestions: aiAnalysis.careerSuggestions,
      priorityImprovements: aiAnalysis.priorityImprovements,
      socialAnalysis: aiAnalysis.socialAnalysis || {}
    });

    res.status(201).json({
      success: true,
      resume: newVersion,
      report: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    One-Click AI Resume Optimizer
 * @route   POST /api/resumes/:id/optimize
 * @access  Private
 */
const optimizeResumeWithAI = async (req, res, next) => {
  try {
    const resume = await Resume.findById(req.params.id);

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume version not found' });
    }

    if (resume.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Get the latest report for this resume
    const report = await AnalysisReport.findOne({ resume: resume._id }).sort({ createdAt: -1 });
    if (!report) {
      return res.status(400).json({ success: false, message: 'No analysis report found for this resume. Please analyze it first.' });
    }

    // Call optimization prompt
    const optimizedParsedData = await optimizeResume(resume.parsedData, report);

    // Save as new version
    const seriesId = resume.parentResumeId || resume._id;
    const latestVersionDoc = await Resume.findOne({
      $or: [
        { _id: seriesId },
        { parentResumeId: seriesId }
      ]
    }).sort({ version: -1 });

    const newVersionNum = latestVersionDoc ? latestVersionDoc.version + 1 : 2;

    const textRepresentation = convertParsedDataToText(optimizedParsedData);
    const aiAnalysis = await analyzeResume(textRepresentation, resume.targetRole, resume.targetCompany);

    const optimizedResume = await Resume.create({
      user: req.user.id,
      filename: resume.filename,
      originalName: resume.originalName,
      path: resume.path,
      size: resume.size,
      parsedText: textRepresentation,
      version: newVersionNum,
      parentResumeId: seriesId,
      targetRole: resume.targetRole,
      targetCompany: resume.targetCompany,
      parsedData: optimizedParsedData
    });

    const newReport = await AnalysisReport.create({
      user: req.user.id,
      resume: optimizedResume._id,
      targetRole: resume.targetRole,
      targetCompany: resume.targetCompany,
      overallScore: aiAnalysis.overallScore,
      scores: aiAnalysis.scores,
      professionalSummary: aiAnalysis.professionalSummary,
      atsFeedback: aiAnalysis.atsFeedback,
      strengths: aiAnalysis.strengths,
      weaknesses: aiAnalysis.weaknesses,
      skillsMatch: aiAnalysis.skillsMatch,
      keywords: aiAnalysis.keywords,
      formattingReview: aiAnalysis.formattingReview,
      grammarReview: aiAnalysis.grammarReview,
      projectAnalysis: aiAnalysis.projectAnalysis,
      certificationSuggestions: aiAnalysis.certificationSuggestions,
      careerSuggestions: aiAnalysis.careerSuggestions,
      priorityImprovements: aiAnalysis.priorityImprovements,
      socialAnalysis: aiAnalysis.socialAnalysis || {}
    });

    res.json({
      success: true,
      resume: optimizedResume,
      report: newReport
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's resume list (v1 entries for series list)
 * @route   GET /api/resumes
 * @access  Private
 */
const getResumes = async (req, res, next) => {
  try {
    // Only fetch root resumes (parentResumeId: null)
    const resumes = await Resume.find({ user: req.user.id, parentResumeId: null })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: resumes.length,
      resumes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all versions of a specific resume series
 * @route   GET /api/resumes/series/:id
 * @access  Private
 */
const getResumeVersions = async (req, res, next) => {
  try {
    const rootId = req.params.id;

    // Verify ownership of the root doc
    const rootResume = await Resume.findById(rootId);
    if (!rootResume) {
      return res.status(404).json({ success: false, message: 'Resume series not found' });
    }
    if (rootResume.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Fetch all resumes in this group (parentResumeId: rootId or _id: rootId)
    const versions = await Resume.find({
      $or: [
        { _id: rootId },
        { parentResumeId: rootId }
      ]
    }).sort({ version: 1 });

    res.json({
      success: true,
      versions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get details of a single resume version
 * @route   GET /api/resumes/:id
 * @access  Private
 */
const getResumeDetails = async (req, res, next) => {
  try {
    const resume = await Resume.findById(req.params.id);

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume version not found' });
    }

    if (resume.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    res.json({
      success: true,
      resume
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a resume series (deletes all versions and reports)
 * @route   DELETE /api/resumes/:id
 * @access  Private
 */
const deleteResumeSeries = async (req, res, next) => {
  try {
    const rootId = req.params.id;
    const rootResume = await Resume.findById(rootId);

    if (!rootResume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    if (rootResume.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Delete all resumes in this series
    const seriesResumes = await Resume.find({
      $or: [
        { _id: rootId },
        { parentResumeId: rootId }
      ]
    });

    const resumeIds = seriesResumes.map(r => r._id);

    // Delete all reports linked to these versions
    await AnalysisReport.deleteMany({ resume: { $in: resumeIds } });

    // Delete physical files (only root resume typically holds the PDF file path)
    seriesResumes.forEach(r => {
      if (r.path && fs.existsSync(r.path)) {
        try {
          fs.unlinkSync(r.path);
        } catch (e) {
          console.error('Error unlinking physical file:', e);
        }
      }
    });

    // Delete database entries
    await Resume.deleteMany({ _id: { $in: resumeIds } });

    res.json({
      success: true,
      message: 'Resume series and all its analysis reports deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadResume,
  createResumeVersion,
  optimizeResumeWithAI,
  getResumes,
  getResumeVersions,
  getResumeDetails,
  deleteResumeSeries
};
