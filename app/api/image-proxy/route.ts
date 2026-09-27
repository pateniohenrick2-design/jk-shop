import { NextRequest, NextResponse } from 'next/server';

// Streams a file from R2 through our own domain, so the browser never
// has to resolve/contact the .r2.dev domain directly (some ISPs block it).
//
// Usage: /api/image-proxy?key=mlbb/xxxxx.jpg
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  }

  // Basic safety: only allow keys, not full URLs, to prevent this becoming
  // an open proxy for arbitrary sites.
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }

  const r2Url = `${process.env.R2_PUBLIC_URL}/${key}`;

  try {
    const upstream = await fetch(r2Url);

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // cache 1 day in the browser
      },
    });
  } catch (err) {
    console.error('Image proxy failed:', err);
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 });
  }
}