const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules') {
        results = results.concat(walk(fullPath));
      }
    } else {
      if (file.endsWith('.js')) {
        results.push(fullPath);
      }
    }
  });
  return results;
};

const searchFiles = () => {
  const files = walk(path.join(__dirname, '..'));
  console.log(`Found ${files.length} JS files to search.\n`);
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('RegExp') || line.includes('\\b') || line.includes('/\\b')) {
        console.log(`${path.basename(file)}:${idx + 1} -> ${line.trim()}`);
      }
    });
  });
};

searchFiles();
