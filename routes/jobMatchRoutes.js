const express = require('express');
const router = express.Router();
const {
  matchJobDescription,
  getJobMatches,
  getJobMatchDetails
} = require('../controllers/jobMatchController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, matchJobDescription);
router.get('/', protect, getJobMatches);
router.get('/:id', protect, getJobMatchDetails);

module.exports = router;
