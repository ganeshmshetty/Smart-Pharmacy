import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { text } = await request.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      return NextResponse.json({ error: "GROQ_API_KEY is not configured in .env.local" }, { status: 500 });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Using active Llama 3.1 8B model for fast inference
        messages: [
          {
            role: 'system',
            content: 'You are a precise medical data extraction assistant. Your task is to extract information from raw OCR text of a prescription and format it exactly into a JSON object. The JSON object must have a "patient" key (string) and a "medications" key (array of objects). Each object in the "medications" array must have "medicine" (string) and "dosage" (string) keys. Ignore any compartment information. Respond ONLY with valid JSON. Do not include markdown blocks like ```json or any conversational text.'
          },
          {
            role: 'user',
            content: `Extract the details from this OCR text:\n\n${text}`
          }
        ],
        temperature: 0.1,
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    
    // Clean up potential markdown formatting just in case the LLM ignores instructions
    content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);

  } catch (error) {
    console.error('Groq parsing error:', error);
    return NextResponse.json({ error: "Failed to parse text with AI." }, { status: 500 });
  }
}
