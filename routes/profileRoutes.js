const express = require('express');
const router = express.Router();
const {
  updateProfile,
  updatePassword,
  getSettings,
  updateSettings
} = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware');

router.put('/', protect, updateProfile);
router.put('/password', protect, updatePassword);
router.get('/settings', protect, getSettings);
router.put('/settings', protect, updateSettings);

module.exports = router;
