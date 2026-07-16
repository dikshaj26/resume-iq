const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Extracts raw text from a PDF file
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {Promise<string>} - The extracted text
 */
const parsePDF = async (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    // Clean and return the extracted text
    let text = pdfData.text || '';
    
    // Simple sanitization: normalize spaces and line breaks
    text = text.replace(/\r\n/g, '\n').replace(/ {2,}/g, ' ');
    
    return text.trim();
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error(`Failed to parse resume PDF: ${error.message}`);
  }
};

module.exports = { parsePDF };
