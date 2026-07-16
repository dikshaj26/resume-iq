const express = require('express');
const router = express.Router();
const {
  startMockInterview,
  submitQuestionAnswer,
  getInterviewHistory,
  getInterviewDetails
} = require('../controllers/mockInterviewController');
const { protect } = require('../middleware/authMiddleware');

router.post('/generate', protect, startMockInterview);
router.post('/:id/answer', protect, submitQuestionAnswer);
router.get('/', protect, getInterviewHistory);
router.get('/:id', protect, getInterviewDetails);

module.exports = router;
