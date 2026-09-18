// ============================================
// Partner report
// GET /api/sponsors/[slug]/report?from=&to=
// ============================================
//
// What a brand actually gets back from a campaign. This is the deliverable a
// pilot is judged on, so the numbers are deliberately conservative: reach is the
// peak of daily distinct accounts rather than their sum, and engagement is a
// purchase rather than a pixel. Overstating either is the fastest way to lose
// the second campaign.
//
// Authenticated with a bearer token rather than a player session: the reader is
// a partner, not a player.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { handleApiError, notFound, unauthorized } from '@/lib/errors';
import { buildPartnerReport } from '@/lib/sponsorship/placements';

/**
 * Partner reports are read with `SPONSOR_REPORT_TOKEN`.
 *
 * Refused outright when it is unset rather than left open: an unauthenticated
 * commercial report is a list of how many people a brand reached, which is not
 * ours to publish.
 */
function authorised(request: NextRequest): boolean {
  const expected = process.env.SPONSOR_REPORT_TOKEN;
  if (!expected) return false;

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    if (!authorised(request)) throw unauthorized();

    const { slug } = await params;
    const { searchParams } = new URL(request.url);

    const from = Number(searchParams.get('from'));
    const to = Number(searchParams.get('to'));

    const sponsor = await db.sponsor.findUnique({
      where: { slug },
      include: { placements: true },
    });
    if (!sponsor) throw notFound('Sponsor');

    const stats = await db.sponsorDailyStat.findMany({
      where: {
        sponsorId: sponsor.id,
        ...(Number.isFinite(from) || Number.isFinite(to)
          ? {
              gameDay: {
                ...(Number.isFinite(from) ? { gte: from } : {}),
                ...(Number.isFinite(to) ? { lte: to } : {}),
              },
            }
          : {}),
      },
      select: { gameDay: true, placementId: true, impressions: true, engagements: true, uniqueUsers: true },
      orderBy: { gameDay: 'asc' },
    });

    const report = buildPartnerReport(stats);

    const placementLabels = new Map(sponsor.placements.map(p => [p.id, { label: p.label, kind: p.kind }]));

    return NextResponse.json({
      sponsor: {
        name: sponsor.name,
        slug: sponsor.slug,
        status: sponsor.status,
        startsAt: sponsor.startsAt,
        endsAt: sponsor.endsAt,
      },
      report: {
        ...report,
        byPlacement: report.byPlacement.map(row => ({
          ...row,
          label: placementLabels.get(row.placementId)?.label ?? row.placementId,
          kind: placementLabels.get(row.placementId)?.kind ?? 'UNKNOWN',
        })),
      },
      // Said out loud in the payload, so nobody reading it has to guess.
      methodology: {
        impression:
          'A shop stocked and displayed the branded line on that game day. Observed server-side, not from a client beacon.',
        engagement: 'Units of the branded line actually sold that day.',
        reach:
          'Peak distinct accounts reached on any single day. Deliberately not the sum across days, which would count a returning player more than once.',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
