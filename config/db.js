const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/resume-iq';
    
    // Connect with options to handle connection issues gracefully
    const conn = await mongoose.connect(connUri, {
      serverSelectionTimeoutMS: 5000 // Keep selection timeout to 5s instead of 30s
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.log('Ensure MongoDB is installed and running locally, or configure MONGODB_URI in your .env file.');
    // Do not crash the application in development, let it run so user can see UI
  }
};

module.exports = connectDB;
