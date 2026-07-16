const express = require('express');
const router = express.Router();
const {
  getAnalysisDetails,
  getReportByResume,
  getAnalysisHistory,
  getAnalysisTrends,
  runSocialAudit
} = require('../controllers/analysisController');
const { protect } = require('../middleware/authMiddleware');

router.get('/history', protect, getAnalysisHistory);
router.get('/trends', protect, getAnalysisTrends);
router.get('/resume/:resumeId', protect, getReportByResume);
router.post('/social', protect, runSocialAudit);
router.get('/:id', protect, getAnalysisDetails);

module.exports = router;
