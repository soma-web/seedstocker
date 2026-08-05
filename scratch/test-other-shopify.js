async function check(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await res.text();
    const data = JSON.parse(text);
    console.log(url, data.product.variants.map(v => ({ id: v.id, title: v.title, available: v.available })));
  } catch (err) {
    console.log(url, 'error:', err.message);
  }
}

async function main() {
  await check('https://hansbrainfood.de/products/apple-fritter-lump-status.json');
  await check('https://mephistogenetics.com/products/forum-stomper.json');
}

main();
