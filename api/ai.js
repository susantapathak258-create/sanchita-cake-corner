export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt' });

  try {
    const url = 'https://text.pollinations.ai/' + encodeURIComponent(
      'Respond ONLY with valid JSON, no markdown, no explanation. ' + prompt
    );

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/plain,*/*',
      }
    });

    const text = await r.text();
    
    // Extract JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'No JSON in response', raw: text.slice(0, 200) });
    
    const parsed = JSON.parse(match[0]);
    return res.json(parsed);

  } catch (e) {
    console.error('AI proxy error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
