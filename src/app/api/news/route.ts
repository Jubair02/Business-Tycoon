import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const news = await db.newsArticle.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });

    return NextResponse.json(news);
  } catch (error) {
    console.error('Get news error:', error);
    return NextResponse.json(
      { error: 'Failed to get news' },
      { status: 500 }
    );
  }
}
