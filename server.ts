import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Google Civic Information API Endpoint
  app.get('/api/voter-info', async (req, res) => {
    const { address } = req.query;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address is required' });
    }

    const apiKey = process.env.VITE_GOOGLE_CIVIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Civic API Key is missing' });
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/civicinfo/v2/voterinfo?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.error) {
        return res.status(response.status).json(data.error);
      }

      res.json(data);
    } catch (error) {
      console.error('Error fetching civic data:', error);
      res.status(500).json({ error: 'Failed to fetch election data' });
    }
  });

  // Gemini AI Guidance Endpoint
  app.post('/api/guidance', async (req, res) => {
    const { session } = req.body;
    if (!session) {
      return res.status(400).json({ error: 'Session data is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Controlled Prompt Template
      const prompt = `
        You are a structured civic guidance system for the "Election Assistant" app.
        Mission: Convert structured election data into plain-language, step-by-step voter instructions.
        
        RULES:
        1. Only use the data provided below. Do not infer, assume, or introduce any information not present in this object.
        2. Keep generated responses short, action-oriented, and written at a sixth-grade reading level.
        3. For every missing field, output the exact string: "This information is not available."
        4. Focus on clarity and the next concrete action.
        
        SESSION DATA:
        ${JSON.stringify(session, null, 2)}
        
        GOAL: Provide a summary and the next step for Step ${session.currentStep} of 5.
        Steps are: 1. Understanding Election, 2. When to Vote, 3. Where to Vote, 4. Candidates, 5. Next Action.
        
        Respond in JSON format:
        {
          "summary": "...",
          "nextStep": "...",
          "alert": "..." // Optional critical info
        }
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Clean potential markdown blocks
      const cleanJson = text.replace(/```json|```/g, '').trim();
      res.json(JSON.parse(cleanJson));
    } catch (error) {
      console.error('Gemini error:', error);
      res.status(500).json({ error: 'Failed to generate guidance' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
