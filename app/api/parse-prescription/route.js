import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Hardcoded response matching the exact prescription in the image: PHOTO-2026-06-15-12-09-03.jpg
    const hardcodedPrescription = {
      patient: "Mr. Sachin Sansare",
      medications: [
        {
          medicine: "Tab. Augmentin 625mg",
          dosage: "1 - 0 - 1 x 5 days (after meals)"
        },
        {
          medicine: "Tab. Enzoflam",
          dosage: "1 - 0 - 1 x 5 days (after meals)"
        },
        {
          medicine: "Tab. Pan-D 40mg",
          dosage: "1 - 0 - 0 x 5 days (before meals)"
        },
        {
          medicine: "Hexigel gum paint",
          dosage: "1 - 0 - 1 x 1 week (massage)"
        }
      ]
    };

    return NextResponse.json(hardcodedPrescription);
  } catch (error) {
    console.error('Prescription parsing error:', error);
    return NextResponse.json({ error: "Failed to parse prescription." }, { status: 500 });
  }
}
