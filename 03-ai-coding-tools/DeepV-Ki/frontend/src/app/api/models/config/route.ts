import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.PYTHON_BACKEND_HOST || process.env.SERVER_BASE_URL || 'http://localhost:8001';

export async function GET() {
  try {
    const backendUrl = `${BACKEND_URL}/api/models/config`;
    console.log(`[models/config] Fetching from: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[models/config] Backend error: ${response.status} - ${errorText}`);
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[models/config] Error fetching models config:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch models configuration', details: errorMessage },
      { status: 500 }
    );
  }
}