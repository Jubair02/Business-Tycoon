import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, validationError, cityQuerySchema } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');

    cityQuerySchema.parse({ city });

    const prices = await db.marketPrice.findMany({
      where: { city: city! },
    });

    return NextResponse.json(prices);
  } catch (error) {
    return handleApiError(error);
  }
}
