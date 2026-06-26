import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { image } = await request.json(); // base64 data URL
    const apiKey = process.env.GROQ_API_KEY;

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: "Missing or invalid 'image' field in request body." }, { status: 400 });
    }

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
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 1024,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `You are a medical data extraction assistant that reads prescription images and outputs structured JSON.

RULES:
1. Output ONLY a valid JSON object. No markdown, no explanation, no extra text.
2. The JSON must have exactly two keys: "patient" (string) and "medications" (array).
3. Each item in "medications" must have: "medicine" (string) and "dosage" (string).
4. For "medicine": output the name exactly as written on the prescription. Do not translate, abbreviate, or expand it.
5. For "dosage": output the dosage exactly as written (e.g. "1-0-1", "twice daily", "500mg BD x5 days"). Do not convert or normalize.
6. If the patient name is illegible or absent, use "Unknown Patient" for the "patient" field.
7. If a dosage is illegible, use "See prescription" for that medication's "dosage" field.
8. If the image does not appear to be a medical prescription, return exactly: {"error": "not_a_prescription"}
9. Do not invent or hallucinate any medication not clearly visible in the image.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the prescription data from this image and return it as JSON.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
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
    console.error('Groq vision parsing error:', error);
    return NextResponse.json({ error: "Failed to parse image with AI." }, { status: 500 });
  }
}
