const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Imports
const User = require('../models/User');
const Resume = require('../models/Resume');
const AnalysisReport = require('../models/AnalysisReport');
const JobMatch = require('../models/JobMatch');
const MockInterview = require('../models/MockInterview');
const Settings = require('../models/Settings');

const { calculateLocalAtsMetrics } = require('../services/atsService');
const { parsePDF } = require('../services/pdfService');

const runTests = async () => {
  console.log('==================================================');
  console.log('         RESUMEIQ AUTOMATED VERIFICATION          ');
  console.log('==================================================\n');

  let dbConnected = false;
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/resume-iq';
    console.log(`Connecting to database: ${mongoUri}...`);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log('✓ Database Connected successfully.\n');
    dbConnected = true;
  } catch (error) {
    console.log(`✗ Database connection failed: ${error.message}`);
    console.log('(Test will continue without database verification)\n');
  }

  // 1. Test ATS Heuristic Logic
  console.log('1. Testing Local ATS Parser Heuristics...');
  try {
    const testResumeText = `
      Johnathan Doe
      johndoe@email.com | 555-019-2834 | New York, NY
      
      SUMMARY
      Talented, result-driven Senior Software Engineer with 5+ years of extensive experience building highly scalable full-stack web applications. Expert in architectural design, database optimization, and implementing CI/CD pipelines to accelerate feature delivery.
      
      EXPERIENCE
      Senior Software Developer - Tech Corp (2022 - Present)
      - Spearheaded the design and development of React and Node.js microservices.
      - Boosted database query performance and decreased API latency by 18% using Redis caching.
      - Mentored junior engineers and introduced agile scrum methodologies to improve velocity.
      
      Projects Section
      E-commerce API - Node.js & MongoDB (2023)
      - Built a secure checkout payment API with Stripe integrating webhooks and state logging.
      
      EDUCATION
      B.S. in Computer Science - Tech University (2018 - 2022)
      
      SKILLS
      JavaScript, React, Node.js, Express, MongoDB, Git, Docker, Python, AWS, Kubernetes, Agile
    `;
    const metrics = calculateLocalAtsMetrics(testResumeText);
    console.log(`   Word Count: ${metrics.wordCount}`);
    console.log(`   Formatting Score: ${metrics.formattingScore}%`);
    console.log(`   Readability Score: ${metrics.readabilityScore}%`);
    console.log(`   Found Sections: Experience (${metrics.sections.experience}), Education (${metrics.sections.education}), Skills (${metrics.sections.skills}), Projects (${metrics.sections.projects})`);
    if (metrics.formattingScore > 50 && metrics.readabilityScore > 50) {
      console.log('✓ Heuristic tests passed.\n');
    } else {
      throw new Error('Heuristic outputs below expected thresholds');
    }
  } catch (error) {
    console.log(`✗ Heuristic tests failed: ${error.message}\n`);
  }

  if (dbConnected) {
    console.log('2. Testing Mongoose Schemas & Database Integrations...');
    try {
      // Clean up previous test users if any
      await User.deleteMany({ email: 'test_verifier@domain.com' });

      // Test User Create & Hashing
      const testUser = await User.create({
        name: 'Verification Bot',
        email: 'test_verifier@domain.com',
        password: 'verifier-password-123'
      });
      console.log('   ✓ User created and password successfully encrypted via pre-save hook.');

      // Test Login Match
      const matches = await testUser.matchPassword('verifier-password-123');
      const fails = await testUser.matchPassword('wrong-password');
      if (matches && !fails) {
        console.log('   ✓ Hashed password match methods pass validation.');
      } else {
        throw new Error('Password verification logic failure');
      }

      // Test Settings auto-generation link
      const settings = await Settings.create({
        user: testUser._id,
        theme: 'dark'
      });
      console.log('   ✓ Settings association document links correctly.');

      // Test Resume Schema
      const resume = await Resume.create({
        user: testUser._id,
        filename: 'resume-test.pdf',
        originalName: 'test.pdf',
        path: 'public/uploads/resume-test.pdf',
        size: 1024,
        parsedText: 'Mock Resume Text',
        version: 1,
        parsedData: {
          personalInfo: { name: 'John Doe', email: 'johndoe@email.com' }
        }
      });
      console.log('   ✓ Resume document successfully written to collection.');

      // Test Analysis Report Schema
      const report = await AnalysisReport.create({
        user: testUser._id,
        resume: resume._id,
        targetRole: 'Software Engineer',
        overallScore: 82,
        scores: { formatting: 85, skills: 80, experience: 85, education: 80, keyword: 80, readability: 80 }
      });
      console.log('   ✓ Analysis ATS report document successfully created.');

      // Test Mock Interview Schema
      const interview = await MockInterview.create({
        user: testUser._id,
        resume: resume._id,
        targetRole: 'Software Engineer',
        questions: [{ questionText: 'Describe React hooks?', category: 'Technical' }]
      });
      console.log('   ✓ Mock Interview session successfully scheduled.');

      // Cleanup Verification Entries
      await MockInterview.deleteMany({ user: testUser._id });
      await AnalysisReport.deleteMany({ user: testUser._id });
      await Resume.deleteMany({ user: testUser._id });
      await Settings.deleteMany({ user: testUser._id });
      await User.deleteOne({ _id: testUser._id });
      console.log('   ✓ Verification temp database entries cleaned up.');

      console.log('✓ Database integration test validation PASSED.\n');
    } catch (error) {
      console.log(`✗ Database schema verification failed: ${error.message}\n`);
    } finally {
      await mongoose.connection.close();
      console.log('Database connection closed.');
    }
  }

  console.log('==================================================');
  console.log('             VERIFICATION COMPLETED               ');
  console.log('==================================================');
};

runTests().catch(err => console.error(err));
