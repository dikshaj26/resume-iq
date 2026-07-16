const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Resume = require('../models/Resume');
const AnalysisReport = require('../models/AnalysisReport');

const checkDb = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/resume-iq';
    console.log(`Connecting to ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.\n');

    const users = await User.find();
    console.log(`=== USERS (${users.length}) ===`);
    users.forEach(u => console.log(`ID: ${u._id} | Name: ${u.name} | Email: ${u.email}`));
    console.log();

    const resumes = await Resume.find();
    console.log(`=== RESUMES (${resumes.length}) ===`);
    resumes.forEach(r => console.log(`ID: ${r._id} | User: ${r.user} | Name: ${r.originalName} | Version: ${r.version} | Parent: ${r.parentResumeId}`));
    console.log();

    const reports = await AnalysisReport.find();
    console.log(`=== REPORTS (${reports.length}) ===`);
    reports.forEach(rep => console.log(`ID: ${rep._id} | User: ${rep.user} | Resume: ${rep.resume} | Target: ${rep.targetCompany} - ${rep.targetRole}`));

    await mongoose.connection.close();
  } catch (error) {
    console.error('Database query error:', error.message);
  }
};

checkDb();
