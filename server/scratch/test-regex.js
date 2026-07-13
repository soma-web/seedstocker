import fs from 'node:fs';

const html = fs.readFileSync('server/scratch/zamnesia-page.html', 'utf8');

function extractSpec(html, headerPattern) {
  const regex = new RegExp(`<th>\\s*${headerPattern}\\s*</th>\\s*<td>\\s*([\\s\\S]*?)\\s*</td>`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

const thc = extractSpec(html, 'THC');
const cbd = extractSpec(html, 'CBD');
const genetics = extractSpec(html, '(?:Genetik|Genetics)');
const floweringTime = extractSpec(html, '(?:Bl&uuml;tezeit|Blutezeit|Flowering\\s+Time)\\s*');

console.log('THC:', thc);
console.log('CBD:', cbd);
console.log('Genetics:', genetics);
console.log('Flowering Time:', floweringTime);
