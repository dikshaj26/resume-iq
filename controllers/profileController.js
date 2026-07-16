const User = require('../models/User');
const Settings = require('../models/Settings');
const bcrypt = require('bcryptjs');

/**
 * @desc    Update user profile (Name, social URLs, avatar)
 * @route   PUT /api/profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { name, email, githubUrl, linkedinUrl, portfolioUrl, avatar } = req.body;

    if (name) user.name = name;
    if (email) user.email = email;
    if (githubUrl !== undefined) user.githubUrl = githubUrl;
    if (linkedinUrl !== undefined) user.linkedinUrl = linkedinUrl;
    if (portfolioUrl !== undefined) user.portfolioUrl = portfolioUrl;
    if (avatar) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        githubUrl: user.githubUrl,
        linkedinUrl: user.linkedinUrl,
        portfolioUrl: user.portfolioUrl
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/profile/password
 * @access  Private
 */
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password' });
    }

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    // Set new password (will trigger user encryption pre-save)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user settings
 * @route   GET /api/profile/settings
 * @access  Private
 */
const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne({ user: req.user.id });

    if (!settings) {
      // Create settings if they don't exist
      settings = await Settings.create({ user: req.user.id });
    }

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user settings
 * @route   PUT /api/profile/settings
 * @access  Private
 */
const updateSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne({ user: req.user.id });

    if (!settings) {
      settings = new Settings({ user: req.user.id });
    }

    const { theme, emailNotifications, autoOptimize, defaultTargetRole, defaultTargetCompany } = req.body;

    if (theme) settings.theme = theme;
    if (emailNotifications !== undefined) settings.emailNotifications = emailNotifications;
    if (autoOptimize !== undefined) settings.autoOptimize = autoOptimize;
    if (defaultTargetRole) settings.defaultTargetRole = defaultTargetRole;
    if (defaultTargetCompany) settings.defaultTargetCompany = defaultTargetCompany;

    settings.updatedAt = Date.now();
    await settings.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateProfile,
  updatePassword,
  getSettings,
  updateSettings
};
