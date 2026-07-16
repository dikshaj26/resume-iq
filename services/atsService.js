/**
 * Analyzes resume text locally to calculate formatting, structure, and readability heuristics.
 * @param {string} text - Raw text from the resume
 * @returns {object} - Heuristic scores and checklists
 */
const calculateLocalAtsMetrics = (text) => {
  const lowercaseText = text.toLowerCase();
  
  // 1. Check for standard sections
  const sections = {
    experience: /experience|work|employment|history/i.test(lowercaseText),
    education: /education|university|college|degree|academic/i.test(lowercaseText),
    skills: /skills|abilities|technologies|expertise/i.test(lowercaseText),
    projects: /projects|portfolio|personal projects/i.test(lowercaseText)
  };

  let sectionCount = 0;
  if (sections.experience) sectionCount++;
  if (sections.education) sectionCount++;
  if (sections.skills) sectionCount++;
  if (sections.projects) sectionCount++;

  const structureScore = Math.round((sectionCount / 4) * 100);

  // 2. Readability check (simple word count and paragraph analysis)
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  let readabilityScore = 80; // Baseline
  if (wordCount < 100) {
    readabilityScore = 40; // Too short
  } else if (wordCount > 1500) {
    readabilityScore = 60; // Too long
  } else if (wordCount >= 300 && wordCount <= 800) {
    readabilityScore = 95; // Optimal length for standard parsing
  }

  // 3. Formatting heuristics (check for typical parseable items like bullets)
  const bulletCount = (text.match(/[•\-\*]/g) || []).length;
  let formattingScore = 70; // Baseline
  if (bulletCount > 5 && bulletCount < 30) {
    formattingScore = 95; // Good detail density
  } else if (bulletCount >= 30) {
    formattingScore = 80; // Might be list-heavy
  }

  return {
    wordCount,
    sections,
    structureScore,
    formattingScore,
    readabilityScore
  };
};

module.exports = { calculateLocalAtsMetrics };
