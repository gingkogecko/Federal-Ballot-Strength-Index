# Voter Power Index — 2026 US Midterms

An estimate of how likely a single ballot is to decide each 2026 House and Senate race, rescaled so the average equals 1. This is not a forecast of who wins; it converts an existing forecast into ballot-level power. I'm using Lakshya Jain/Split Ticket/The Argument's forecast to power this index, due to data availability and relative consistency with other forecasts.

There are House, Senate and combined versions, each in two flavors of population weighting:

- **Weighted (per voter):** Measures how much your vote matters, by dividing the power by the total votes cast in the 2024 Presidential Election. This favors smaller electorates, like lower population senate seats (such as Alaska, Maine and Nebraska) as well as smaller than average congressional districts due to rounding impacts in seat apportionment (like in Alabama, Colorado, Montana, Nebraska which have smaller than average district populations) or due to low turnout in 2024 (CA-22, TX-09 are examples) tend to be a bit upweighted, because these jurisdictions have less voters.
- **Unweighted (per race):** Measures how much this race (or combination of races matters. No adjustment for how many people vote. This version does not consider electorate population impact on voter power, only the closeness of the races in combination.

The site (in `docs/`) lets you change the assumptions below and shows the top 15 for the combined, House, Senate and state-average indexes, plus a search by district, state or candidate. A state search always returns the statewide result.

## Data sources

| Input | Source |
|---|---|
| 2026 House and Senate win probabilities and expected margins | [The Argument/Split Ticket](https://www.theargumentmag.com/p/split-ticket-2026-midterms-model) |
| 2024 presidential votes by 2026 congressional district lines | [The Downballot](https://www.the-downballot.com/p/the-downballot-releases-presidential) |
| 2024 presidential votes by state | [Federal Election Commission, 2024 general election results](https://www.fec.gov/documents/5644/2024presgeresults.pdf) |

The forecast and vote data belong to their respective publishers. Forecasts change, so rankings will too.

## Key methodological choices

1. **Decisiveness model.** A ballot decides a race when the final margin lands within one vote of a tie. I take the height of the margin's probability curve at a tie and multiply by 2 (one ballot moves the margin by two votes).
2. **Spread (σ).** Default: one shared σ per chamber, the median of the values implied by each race's win probability. Race-by-race implied σ is available as a robustness check, and is used only where the win probability is between 10 and 45 points from 50/50; otherwise the chamber median is used.
3. **Curve shape.** Default: a fat-tailed Student t with 4 degrees of freedom, as in Gelman, Silver and Edlin, scaled so its win probability matches the forecast. Normal is the alternative.
4. **Denominator.** Weighted versions divide by 2024 total presidential votes cast; unweighted versions do not.
5. **Chamber weight.** In the combined index a Senate seat counts *w* = 4.35 times a House seat (435 ÷ 100), because a senator is 1/100 of the Senate and a representative is 1/435 of the House. The site lets you pick other integer weights.
6. **Normalization.** Weighted indexes divide by the vote-weighted average (average voter = 1). Unweighted indexes divide by the simple average across races (average race = 1).
7. **Fragile rankings.** Rankings that change when σ mode or curve shape changes should be treated as fragile; the search box shows each district's rank range across settings.
8. **Known side effect.** Per-voter power rewards low-turnout districts. Among 60 competitive districts, the log of power correlates about 0.85 with closeness and about −0.46 with the log of votes cast.

## State average

The state-average index is the average of a state's House district combined indexes (weighted by votes when counting per voter, a simple average per race). Each district's combined index already includes its state's Senate race, so this equals the state's average House power plus its Senate power.
