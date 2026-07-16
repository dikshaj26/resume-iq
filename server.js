const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const jobMatchRoutes = require('./routes/jobMatchRoutes');
const mockInterviewRoutes = require('./routes/mockInterviewRoutes');
const profileRoutes = require('./routes/profileRoutes');

// Initialize app
const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/job-match', jobMatchRoutes);
app.use('/api/interviews', mockInterviewRoutes);
app.use('/api/profile', profileRoutes);

// Fallback to HTML for client-side routing (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Error Handler
app.use(errorHandler);

// Port setup
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running in production-ready mode on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your web browser`);
});
