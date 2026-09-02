import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');

    if (!city) {
      return NextResponse.json(
        { error: 'City query parameter is required' },
        { status: 400 }
      );
    }

    const prices = await db.marketPrice.findMany({
      where: { city },
    });

    return NextResponse.json(prices);
  } catch (error) {
    console.error('Get market error:', error);
    return NextResponse.json(
      { error: 'Failed to get market prices' },
      { status: 500 }
    );
  }
}
