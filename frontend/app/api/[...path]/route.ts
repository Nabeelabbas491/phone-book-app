import { NextRequest, NextResponse } from 'next/server';

/**
 * Same-origin proxy to the NestJS API.
 * The browser calls /api/*, and this handler forwards to `${API_URL}/api/*`.
 * Keeping the backend address server-side means it can change per environment
 * (local, Docker, Cloud Run) without rebuilding the frontend, and avoids CORS.
 */
export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

type Context = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, { params }: Context): Promise<NextResponse> {
  const { path } = await params;
  const target = new URL(`/api/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`, API_URL);

  const init: RequestInit = {
    method: req.method,
    headers: {
      accept: 'application/json',
      'content-type': req.headers.get('content-type') ?? 'application/json',
    },
    cache: 'no-store',
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  try {
    const res = await fetch(target, init);
    const body = res.status === 204 ? null : await res.arrayBuffer();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json(
      { message: 'The phone book service is unavailable. Please try again shortly.' },
      { status: 502 },
    );
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
