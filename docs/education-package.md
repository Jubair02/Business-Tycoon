# Education edition: packaging outline

**Written for:** whoever takes this to a university, and the person who has to decide what to build next for it.

---

## The case

The simulation already teaches, without anything being added to it:

| Concept | Where it shows up in play |
|---|---|
| COGS and gross margin | Buying stock at wholesale, setting a shelf price |
| Net margin | Rent, power, wages and tax eating the gross |
| Working capital | A profitable shop that cannot fund tomorrow's stock does not open tomorrow |
| Loan amortisation | Flat-rate borrowing repaid daily, and what it really costs |
| Price elasticity | Demand moving against price, per product |
| Competitive strategy | AI rivals that undercut, open nearby and poach staff |
| NPS and customer experience | Satisfaction, loyalty and reviews driving repeat custom |
| Customer acquisition cost | Marketing campaigns with measurable conversions |

That list is a first-year BBA syllabus. The gap was never content — it was that an instructor had no way to **set** anything or **mark** it.

## What was built

- **Cohorts** — a named class with a join code, a seat limit, and a scenario.
- **Scenarios** — a shared starting position, so what one student did is comparable with the student next to them. Four presets: an open brief, thin margins, cash-is-not-profit, and service-not-price.
- **Objectives** — an instructor picks metrics and targets from a fixed list, with weights.
- **Gradebook** — every student's measured position against those objectives, with a weighted score, exportable as CSV for whatever the institution marks in.

Scenarios constrain the opening position only. They never alter the economy's rules — the teaching value is that the simulation behaves identically for everyone, and a scenario that quietly changed margins would teach a wrong lesson convincingly.

## Packaging

Per seat, per semester. A seat is a student in a cohort.

| Tier | Seats | Indicative price/seat/semester | Includes |
|---|---:|---:|---|
| **Single course** | up to 60 | ৳300 | Cohorts, scenarios, objectives, gradebook, CSV export |
| **Department** | up to 300 | ৳220 | The above, plus cross-cohort comparison and a named contact |
| **Institution** | unlimited | negotiated | The above, plus custom scenarios built to a syllabus |

Prices are a starting point for a conversation, not a rate card. The number that actually matters is whether it clears a departmental software budget without needing procurement, and for most private universities in Dhaka that ceiling is low enough that per-course billing is the realistic route.

**Free tier:** an instructor can run one cohort of up to 15 seats at no charge. Teaching software is adopted by one lecturer trying it in one class, not by a procurement decision, so the trial has to be genuinely usable rather than a demo.

## What a course actually uses

Realistically, a lecturer will use:

1. **One scenario**, chosen to match the week's topic.
2. **Three or four objectives**, not the full list.
3. **The CSV export**, once, at the end.

Everything else is nice to have. Build depth in that order.

## Curriculum fit

| Course | Scenario | Why |
|---|---|---|
| Introduction to Business / Entrepreneurship | Open brief | Exploration; the point is that decisions compound |
| Managerial Accounting | Thin margins | Forces the gap between markup and net margin |
| Financial Management | Cash is not profit | Working capital and the cost of borrowing |
| Marketing / Consumer Behaviour | Service, not price | Reputation and NPS against the temptation to discount |

A single class session is about 90 real minutes, which at the current clock is about 90 game days — most of a season. That is a genuinely useful property: a lecture-length session is a full business cycle.

## What is still missing before selling this

Honest list, in the order it will bite:

1. **No instructor account type.** Anyone can create a cohort. Fine for a pilot, wrong for a paid product — there is nothing stopping a student creating their own class and marking themselves.
2. **No billing.** Seat limits are enforced, but nothing charges for seats. The commerce layer exists and could carry it, but no institutional invoicing path exists.
3. **Scenario constraints are not enforced in play.** A scenario declares its allowed business types, cities and whether loans are available; the cohort screen shows them, but the game does not yet stop a student opening something outside the brief. This is the single most important gap — without it, "everyone starts from the same position" is a convention rather than a rule.
4. **No profitable-days counter.** One objective metric reads zero because the underlying figure is not stored per day. It should not be offered until it is.
5. **No LMS integration.** CSV export covers most of it; Moodle and Google Classroom are what local universities actually run.
6. **No instructor guide.** A lecturer needs a one-page "run this in a 90-minute class" document more than they need another feature.

## The realistic first move

One lecturer, one course, one semester, free. Ask for the gradebook back at the end and what they wished it did. Items 1 and 3 above will almost certainly be the first two things they hit — but hearing it from them is worth more than building it on this list's say-so.
