import { NextRequest, NextResponse } from 'next/server';

const VALIDATOR = process.env.INTERNAL_API_URL ?? 'http://localhost:4000';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const url = `${VALIDATOR}/api/governance/${path.join('/')}${req.nextUrl.search}`;
    const upstream = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const body = await req.json();
    const url = `${VALIDATOR}/api/governance/${path.join('/')}`;
    const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
}
