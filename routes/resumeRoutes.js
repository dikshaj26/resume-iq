const express = require('express');
const router = express.Router();
const {
  uploadResume,
  createResumeVersion,
  optimizeResumeWithAI,
  getResumes,
  getResumeVersions,
  getResumeDetails,
  deleteResumeSeries
} = require('../controllers/resumeController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/upload', protect, upload.single('resume'), uploadResume);
router.post('/:id/version', protect, createResumeVersion);
router.post('/:id/optimize', protect, optimizeResumeWithAI);
router.get('/', protect, getResumes);
router.get('/series/:id', protect, getResumeVersions);
router.get('/:id', protect, getResumeDetails);
router.delete('/:id', protect, deleteResumeSeries);

module.exports = router;
