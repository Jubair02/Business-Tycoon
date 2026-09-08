import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/businesses/[id]/cx — Customer Experience data for a business
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        satisfactionScore: true,
        loyaltyScore: true,
        repeatCustomerRate: true,
        npsScore: true,
        totalReviews: true,
        avgReviewRating: true,
        reputation: true,
        healthScore: true,
        dailyRevenue: true,
        dailyCustomers: true,
        inventories: {
          select: {
            productName: true,
            quantity: true,
            sellPrice: true,
            purchasePrice: true,
          },
        },
        employees: {
          select: {
            role: true,
            skill: true,
          },
        },
        metrics: {
          orderBy: { gameDay: 'desc' },
          take: 30,
          select: {
            gameDay: true,
            satisfaction: true,
            loyalty: true,
            nps: true,
            customers: true,
            revenue: true,
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Get recent reviews
    const reviews = await db.customerReview.findMany({
      where: { businessId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get review statistics
    const reviewStats = await db.customerReview.aggregate({
      where: { businessId: id },
      _count: true,
      _avg: { rating: true },
    });

    // Review distribution (1-5 stars)
    const reviewDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const allReviews = await db.customerReview.findMany({
      where: { businessId: id },
      select: { rating: true, sentiment: true, segment: true },
    });

    for (const r of allReviews) {
      reviewDistribution[r.rating] = (reviewDistribution[r.rating] || 0) + 1;
    }

    // Sentiment counts
    const sentimentCounts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
    for (const r of allReviews) {
      sentimentCounts[r.sentiment as keyof typeof sentimentCounts]++;
    }

    // Segment counts
    const segmentCounts: Record<string, number> = {};
    for (const r of allReviews) {
      segmentCounts[r.segment] = (segmentCounts[r.segment] || 0) + 1;
    }

    // Calculate CX trends from metrics
    const recentMetrics = business.metrics.slice(0, 7);
    const olderMetrics = business.metrics.slice(7, 14);

    const avgRecentSatisfaction = recentMetrics.length > 0
      ? recentMetrics.reduce((s, m) => s + m.satisfaction, 0) / recentMetrics.length
      : business.satisfactionScore;
    const avgOlderSatisfaction = olderMetrics.length > 0
      ? olderMetrics.reduce((s, m) => s + m.satisfaction, 0) / olderMetrics.length
      : business.satisfactionScore;

    const satisfactionTrend = avgRecentSatisfaction - avgOlderSatisfaction;

    // Positive and negative factors
    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];

    if (business.satisfactionScore >= 70) positiveFactors.push('High customer satisfaction');
    else if (business.satisfactionScore < 40) negativeFactors.push('Low customer satisfaction');

    if (business.loyaltyScore >= 50) positiveFactors.push('Strong customer loyalty');
    else if (business.loyaltyScore < 20) negativeFactors.push('Weak customer loyalty');

    if (business.repeatCustomerRate >= 0.4) positiveFactors.push('High repeat customer rate');
    else if (business.repeatCustomerRate < 0.15) negativeFactors.push('Low repeat customer rate');

    if (business.npsScore >= 30) positiveFactors.push('Positive Net Promoter Score');
    else if (business.npsScore < -20) negativeFactors.push('Negative Net Promoter Score');

    const totalStock = business.inventories.reduce((s, inv) => s + inv.quantity, 0);
    if (totalStock === 0) negativeFactors.push('Out of stock on all items');

    if (business.employees.length >= 3) positiveFactors.push('Well-staffed business');
    else if (business.employees.length === 0) negativeFactors.push('No employees hired');

    if (business.reputation >= 70) positiveFactors.push('Strong reputation');
    else if (business.reputation < 30) negativeFactors.push('Poor reputation');

    return NextResponse.json({
      summary: {
        satisfactionScore: business.satisfactionScore,
        loyaltyScore: business.loyaltyScore,
        repeatCustomerRate: business.repeatCustomerRate,
        npsScore: business.npsScore,
        totalReviews: business.totalReviews,
        avgReviewRating: business.avgReviewRating,
        satisfactionTrend: Math.round(satisfactionTrend * 10) / 10,
      },
      segments: {
        BUDGET: { share: 0.40, count: segmentCounts['BUDGET'] || 0 },
        REGULAR: { share: 0.30, count: segmentCounts['REGULAR'] || 0 },
        PREMIUM: { share: 0.20, count: segmentCounts['PREMIUM'] || 0 },
        TOURIST: { share: 0.10, count: segmentCounts['TOURIST'] || 0 },
      },
      reviews: {
        recent: reviews,
        distribution: reviewDistribution,
        sentimentCounts,
        segmentCounts,
        total: reviewStats._count,
        avgRating: reviewStats._avg.rating || 0,
      },
      trends: {
        satisfaction: business.metrics.map(m => ({ day: m.gameDay, value: m.satisfaction })),
        loyalty: business.metrics.map(m => ({ day: m.gameDay, value: m.loyalty })),
        nps: business.metrics.map(m => ({ day: m.gameDay, value: m.nps })),
      },
      positiveFactors,
      negativeFactors,
    });
  } catch (error) {
    console.error('[CX API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
