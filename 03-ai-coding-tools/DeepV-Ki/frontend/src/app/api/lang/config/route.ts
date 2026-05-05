import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.PYTHON_BACKEND_HOST || process.env.SERVER_BASE_URL || 'http://localhost:8001';

export async function GET() {
  try {
    const backendUrl = `${BACKEND_URL}/api/lang/config`;
    console.log(`[lang/config] Fetching from: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[lang/config] Backend error: ${response.status} - ${errorText}`);
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[lang/config] Error fetching lang config:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch language configuration', details: errorMessage },
      { status: 500 }
    );
  }
}
