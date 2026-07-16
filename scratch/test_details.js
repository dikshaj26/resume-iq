const mongoose = require('mongoose');
require('dotenv').config();
const Resume = require('../models/Resume');

const testDetails = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/resume-iq';
    await mongoose.connect(mongoUri);
    
    const resumeId = '6a579eb0dbdd9d7a9faa025f'; // latest resume ID
    const userId = '6a57930939ea831c83657c22'; // Diksha jain's user ID

    console.log(`Querying Resume by ID: ${resumeId}...`);
    const resume = await Resume.findById(resumeId);
    if (!resume) {
      console.log('✗ Resume not found.');
      return;
    }
    console.log('✓ Resume document found.');

    console.log(`Checking user association: resume.user (${resume.user}) vs userId (${userId})`);
    const isOwner = resume.user.toString() === userId.toString();
    console.log(`Is owner: ${isOwner}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('Test error:', error.message);
  }
};

testDetails();
