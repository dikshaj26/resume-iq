const mongoose = require('mongoose');

const connectDB = async () => {
  const connUri = process.env.MONGODB_URI;

  if (!connUri) {
    throw new Error('MONGODB_URI is not configured');
  }

  try {
    const conn = await mongoose.connect(connUri, {
      serverSelectionTimeoutMS: 10000
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    throw new Error(
      'Unable to connect to MongoDB. Set MONGODB_URI and allow the deployment IP in MongoDB Atlas.'
    );
  }
};

module.exports = connectDB;
