// Native fetch used

async function testFetch() {
  const url = 'https://seedfinder.eu/en/strain-info/biker-kush/karma-genetics';
  console.log('Fetching:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Includes THC?:', text.includes('THC') || text.includes('thc'));
    
    // Match any THC occurrences
    const matches = text.match(/.{0,50}THC.{0,50}/gi);
    console.log('THC snippets:', matches ? matches.slice(0, 5) : 'None');
  } catch (err) {
    console.error(err);
  }
}

testFetch();
