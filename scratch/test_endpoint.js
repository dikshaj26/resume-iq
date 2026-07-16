const mongoose = require('mongoose');
require('dotenv').config();
const Resume = require('../models/Resume');

const testEndpoint = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/resume-iq';
    await mongoose.connect(mongoUri);
    
    const userId = '6a57930939ea831c83657c22'; // From DB check output
    
    // Test the exact query used in controllers/resumeController.js
    const resumes = await Resume.find({ user: userId, parentResumeId: null })
      .sort({ createdAt: -1 });
      
    console.log(`Query: { user: '${userId}', parentResumeId: null }`);
    console.log(`Results count: ${resumes.length}`);
    resumes.forEach(r => {
      console.log(`- ${r.originalName} (${r._id})`);
    });
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Test error:', error.message);
  }
};

testEndpoint();
