import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseInt(searchParams.get('limit') || '10', 10);
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 10;

    const news = await db.newsArticle.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(news);
  } catch (error) {
    return handleApiError(error);
  }
}
