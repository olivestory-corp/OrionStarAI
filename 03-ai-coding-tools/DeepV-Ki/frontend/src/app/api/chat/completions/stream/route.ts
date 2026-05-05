import { NextRequest, NextResponse } from 'next/server';

// The target backend server base URL, derived from environment variable or defaulted.
const TARGET_SERVER_BASE_URL = process.env.PYTHON_BACKEND_HOST || process.env.SERVER_BASE_URL || 'http://localhost:8001';

export async function POST(req: NextRequest) {
  try {
    const requestBody = await req.json();

    console.log('Proxying chat completions stream request to:', `${TARGET_SERVER_BASE_URL}/api/chat/completions/stream`);

    const targetUrl = `${TARGET_SERVER_BASE_URL}/api/chat/completions/stream`;

    const cookieHeader = req.headers.get('cookie') || '';

    // Make the actual request to the backend service
    const backendResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cookie': cookieHeader,
      },
      body: JSON.stringify(requestBody),
    });

    // If the backend service returned an error, forward that error to the client
    if (!backendResponse.ok) {
      const errorBody = await backendResponse.text();
      const errorHeaders = new Headers();
      backendResponse.headers.forEach((value, key) => {
        errorHeaders.set(key, value);
      });
      return new NextResponse(errorBody, {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        headers: errorHeaders,
      });
    }

    // Ensure the backend response has a body to stream
    if (!backendResponse.body) {
      return new NextResponse('Stream body from backend is null', { status: 500 });
    }

    // Create a new ReadableStream to pipe the data from the backend to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = backendResponse.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            controller.enqueue(value);
          }
        } catch (error) {
          console.error('Error reading from backend stream in proxy:', error);
          controller.error(error);
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
      cancel(reason) {
        console.log('Client cancelled stream request:', reason);
      }
    });

    // Set up headers for the response to the client
    const responseHeaders = new Headers();
    const contentType = backendResponse.headers.get('Content-Type');
    if (contentType) {
      responseHeaders.set('Content-Type', contentType);
    }
    responseHeaders.set('Cache-Control', 'no-cache, no-transform');

    return new NextResponse(stream, {
      status: backendResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Error in API proxy route (/api/chat/completions/stream):', error);
    let errorMessage = 'Internal Server Error in proxy';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return new NextResponse(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
