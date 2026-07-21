async function testDDG(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  console.log('Searching DDG:', query);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9,de;q=0.8'
    }
  });
  const html = await res.text();
  
  // Extract snippets
  const snippets = [];
  const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    snippets.push(text);
  }
  
  console.log(`Found ${snippets.length} snippets.`);
  console.log('Top snippets:', snippets.slice(0, 5));
  
  // Try extracting THC pattern
  const thcRegexes = [
    /THC\s*:\s*~?\s*(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)/i,
    /(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)\s*THC/i,
    /THC\s*(?:content|gehalt|level|potency)?\s*(?:of|von|is|ist|:)?\s*~?\s*(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)/i,
    /(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)/i
  ];
  
  for (const snip of snippets) {
    for (const reg of thcRegexes) {
      const match = snip.match(reg);
      if (match && match[1]) {
        console.log('EXTRACTED THC:', match[1], 'FROM:', snip);
        return match[1];
      }
    }
  }
  return null;
}

testDDG('Wizard Trees Black Orchard THC percentage');
testDDG('Royal Queen Seeds Stress Killer CBD THC percentage');
