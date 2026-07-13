import fs from 'node:fs';

const html = fs.readFileSync('server/scratch/hans-page.html', 'utf8');

const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let idx = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  idx++;
  const content = match[1];
  if (content.includes('Black Runtz') || content.includes('Diamond Sherbet')) {
    console.log(`Script #${idx} contains keywords! Length:`, content.length);
    console.log(content.substring(0, 500) + '...');
  }
}
