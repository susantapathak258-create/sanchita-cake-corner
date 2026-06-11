export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'No prompt' });

  try {
    const r = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: `<s>[INST] You must respond with valid JSON only. No explanation, no markdown. ${prompt} [/INST]`,
          parameters: { max_new_tokens: 800, temperature: 0.7, return_full_text: false }
        })
      }
    );

    const data = await r.json();
    
    let text = '';
    if (Array.isArray(data)) text = data[0]?.generated_text || '';
    else if (data.generated_text) text = data.generated_text;
    else if (data.error) throw new Error(data.error);
    else text = JSON.stringify(data);

    // Extract JSON
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found: ' + text.slice(0, 100));
    
    const parsed = JSON.parse(match[0]);
    return res.json(parsed);

  } catch (e) {
    console.error('AI error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
