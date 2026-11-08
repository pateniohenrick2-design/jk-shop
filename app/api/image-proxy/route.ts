import { NextRequest, NextResponse } from 'next/server';
import { getFromR2 } from '@/lib/r2';

// Streams a file from R2 through our own domain. It reads via the S3 API
// endpoint, not the public .r2.dev URL, because some ISPs block .r2.dev
// (for the browser *and* for this server when it runs on such a network).
//
// Usage: /api/image-proxy?key=mlbb/xxxxx.jpg
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  }

  // Only accept bucket keys, never full URLs.
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }

  try {
    const { body, contentType } = await getFromR2(key);
    if (!body) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    return new NextResponse(body.transformToWebStream() as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400', // cache 1 day in the browser
      },
    });
  } catch (err: any) {
    if (err?.name === 'NoSuchKey') {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    console.error('Image proxy failed:', err);
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 });
  }
}
