import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const badCharacters = {
  'â‚¬': 'Corrupted Euro Sign (should be €)',
  'â€”': 'Corrupted Em-dash (should be —)',
  'â†‘': 'Corrupted Up Arrow (should be ↑)',
  'â†“': 'Corrupted Down Arrow (should be ↓)',
  'â†’': 'Corrupted Right Arrow (should be →)',
  'â€¢': 'Corrupted Bullet (should be •)',
  'â€¦': 'Corrupted Ellipsis (should be …)'
};

function runTest() {
  const rootDir = path.resolve(__dirname, '../..');
  const filesToScan = [
    path.join(rootDir, 'src/App.jsx'),
    path.join(rootDir, 'src/StrainDetailPage.jsx')
  ];

  let passed = true;
  console.log('Running encoding validation test...');

  filesToScan.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping non-existent file: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(rootDir, filePath);
    
    Object.entries(badCharacters).forEach(([badChar, description]) => {
      if (content.includes(badChar)) {
        console.error(`FAIL: Found ${description} ("${badChar}") in ${relativePath}`);
        passed = false;
      }
    });
  });

  if (!passed) {
    console.error('\nEncoding test FAILED. Please clean up the corrupted characters.');
    process.exit(1);
  } else {
    console.log('\nEncoding test PASSED. All checked files are free from character corruption.');
    process.exit(0);
  }
}

runTest();
