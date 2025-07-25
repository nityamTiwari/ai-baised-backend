const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;  
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(cors({
     origin: ['https://your-vercel-app.vercel.app', 'http://localhost:8080'],
     credentials: true
   }));
app.use(express.json());

// POST /api/analyze-text
app.post('/api/analyze-text', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  // Define the prompt for the AI
  const prompt = `You are an expert bias detection system. For the following input, analyze it for bias and ethical issues.
  Return ONLY a pure JSON object with this exact structure:
  {
    "severity": "low|medium|high",
    "overallAssessment": "A brief and readable summary of your analysis.",
    "issues": [
      {
        "sentence": "Original sentence.",
        "bias": "Type of bias (e.g., socioeconomic, gender, age, etc.)",
        "issue": "Brief description of the issue.",
        "solution": "A more inclusive or neutral version of the sentence."
      }
    ]
  }
  Text to analyze: "${text}"
  Do not include markdown, backticks, or any explanation — only return valid JSON.`;

  try {
    const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      console.error('Gemini API Error:', errorData);
      return res.status(geminiResponse.status).json({ error: `Gemini API responded with an error: ${geminiResponse.statusText}` });
    }

    const data = await geminiResponse.json();
    let aiResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean up the JSON string from any markdown formatting
    aiResult = aiResult.replace(/^```json/, '').replace(/```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(aiResult);
    } catch (e) {
      console.error('JSON Parse Error:', e, 'Raw AI Result:', aiResult);
      return res.status(500).json({ error: 'Model did not return valid JSON.', rawOutput: aiResult });
    }

    // Success: send the parsed JSON directly to the frontend
    res.json(parsed);

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Failed to analyze text.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});