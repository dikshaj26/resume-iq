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

    // Validate if the extracted text is empty or is not a valid resume
    const cleanText = extractedText ? extractedText.trim() : '';
    
    // DEBUG LOGS
    console.log('--- UPLOAD VALIDATION DEBUG ---');
    console.log('Extracted Text Length:', cleanText.length);
    console.log('Extracted Text Snippet:\n', cleanText.substring(0, 300));

    if (cleanText.length < 150) {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      return res.status(400).json({ 
        success: false, 
        message: 'The uploaded PDF is empty, too short, or has no readable text. Please upload a valid text-based resume.' 
      });
    }
    
    const lowerText = cleanText.toLowerCase();
    
    // 1. Check for standard contact details (email/phone) or sections
    const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(cleanText);
    const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(cleanText);
    
    // 2. Check for 4-digit years (e.g., 2018, 2024) representing graduation or employment dates
    const hasYears = /\b(19|20)\d{2}\b/.test(cleanText);
    
    // 3. Check for typical Job Description keywords
    const jdKeywords = [
      'we are looking for', 'we are seeking', 'about the role', 'job description',
      'responsibilities include', 'who you are', 'what you will do', 'ideal candidate',
      'requirements:', 'we offer', 'competitive salary', 'equal opportunity employer',
      'reports to', 'join our team', 'visa sponsorship'
    ];
    const jdMatches = jdKeywords.filter(keyword => lowerText.includes(keyword));
    
    // 4. Check for typical Resume section titles
    const resumeKeywords = [
      'experience', 'work history', 'education', 'skills', 'projects', 'languages',
      'professional summary', 'objective', 'employment', 'certificates', 'achievements'
    ];
    const resumeMatches = resumeKeywords.filter(keyword => lowerText.includes(keyword));

    console.log('hasEmail:', hasEmail);
    console.log('hasPhone:', hasPhone);
    console.log('hasYears:', hasYears);
    console.log('jdMatches (Count:', jdMatches.length, '):', jdMatches);
    console.log('resumeMatches (Count:', resumeMatches.length, '):', resumeMatches);
    console.log('-------------------------------');

    // Decisive Check: If it has NO personal email and contains job-posting keywords, block it immediately
    const jdSpecificKeywords = [
      'job description', 'position', 'duration', 'eligibility', 'ppo', 'fresher', 'internship', 'stipend', 'intern / fresher'
    ];
    const jdSpecificMatches = jdSpecificKeywords.filter(keyword => lowerText.includes(keyword));

    if (!hasEmail && jdSpecificMatches.length >= 1) {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      return res.status(400).json({ 
        success: false, 
        message: 'The uploaded file appears to be a Job Description or lacks your personal contact details (email address). Please upload a valid candidate resume.' 
      });
    }

    // Decisive Check A: High density of JD phrases (definitely a Job Description)
    if (jdMatches.length >= 3) {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      return res.status(400).json({ 
        success: false, 
        message: 'The uploaded file appears to be a Job Description or Job Posting. Please upload your personal resume instead.' 
      });
    }

    // Decisive Check B: Has JD phrases and lacks dates/years (likely a Job Description)
    if (jdMatches.length >= 2 && !hasYears) {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      return res.status(400).json({ 
        success: false, 
        message: 'The uploaded file appears to be a Job Description rather than a candidate resume. Resumes must contain employment dates or graduation years.' 
      });
    }

    // Decisive Check C: Lacks both dates/years and common resume headings (likely nonsense or plain text)
    if (!hasYears && resumeMatches.length < 2) {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      return res.status(400).json({ 
        success: false, 
        message: 'The uploaded document does not contain standard resume sections (like Experience or Education) or employment dates.' 
      });
    }

    // 2. Call Gemini service to structure and analyze resume
    const aiAnalysis = await analyzeResume(extractedText, targetRole, targetCompany);

    // If the AI service detects an invalid document
    if (aiAnalysis.isInvalidDocument) {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      return res.status(400).json({ 
        success: false, 
        message: aiAnalysis.validationError || 'The uploaded file was recognized by AI as an invalid document. Please upload a valid resume.' 
      });
    }

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
