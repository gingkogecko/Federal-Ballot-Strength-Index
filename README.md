# Voter Power Index — 2026 US Midterms

An estimate of how likely a single ballot is to decide each 2026 House and Senate race, rescaled so the average equals 1. This is not a forecast of who wins; it converts an existing forecast into ballot-level power.

There are House, Senate and combined versions, each in two flavors:

- **Weighted (per voter):** my vote matters. Divides by votes cast, so smaller electorates score higher.
- **Unweighted (per race):** this race matters. No adjustment for how many people vote.

The site (in `docs/`) lets you change the assumptions below and shows the top 15 for the combined, House and Senate indexes, plus a search by district, state or candidate.

## Data sources

| Input | Source |
|---|---|
| 2026 House and Senate win probabilities and expected margins | [Split Ticket](https://split-ticket.org/) 2026 forecasts |
| 2024 presidential votes by 2026 congressional district lines | [The Downballot](https://www.the-downballot.com/p/the-downballot-releases-presidential) |
| 2024 presidential votes by state | [Federal Election Commission, 2024 general election results](https://www.fec.gov/documents/5644/2024presgeresults.pdf) |

The forecast and vote data belong to their respective publishers. Forecasts change, so rankings will too.

## Method references

- Gelman, Silver and Edlin, [What Is the Probability Your Vote Will Make a Difference?](https://www.nber.org/system/files/working_papers/w15220/w15220.pdf)
- Gelman, Katz and Bafumi, [Standard Voting Power Indexes Don't Work](https://sites.stat.columbia.edu/gelman/research/published/gelmankatzbafumi.pdf)
- Mulligan and Hunter, [The Empirical Frequency of a Pivotal Vote](https://www.nber.org/papers/w8590.pdf)

## Key methodological choices

1. **Decisiveness model.** A ballot decides a race when the final margin lands within one vote of a tie. I take the height of the margin's probability curve at a tie and multiply by 2 (one ballot moves the margin by two votes).
2. **Spread (σ).** Default: one shared σ per chamber, the median of the values implied by each race's win probability. Race-by-race implied σ is available as a robustness check, and is used only where the win probability is between 10 and 45 points from 50/50; otherwise the chamber median is used.
3. **Curve shape.** Default: a fat-tailed Student t with 4 degrees of freedom, as in Gelman, Silver and Edlin, scaled so its win probability matches the forecast. Normal is the alternative.
4. **Denominator.** Weighted versions divide by 2024 total presidential votes cast; unweighted versions do not.
5. **Chamber weight.** In the combined index a Senate seat counts *w* = 4.35 times a House seat (435 ÷ 100), because a senator is 1/100 of the Senate and a representative is 1/435 of the House. The site lets you pick other integer weights.
6. **Normalization.** Weighted indexes divide by the vote-weighted average (average voter = 1). Unweighted indexes divide by the simple average across races (average race = 1).
7. **Fragile rankings.** Rankings that change when σ mode or curve shape changes should be treated as fragile; the search box shows each district's rank range across settings.
8. **Known side effect.** Per-voter power rewards low-turnout districts. Among 60 competitive districts, the log of power correlates about 0.85 with closeness and about −0.46 with the log of votes cast.

## Equations

**Symbol key**

| Symbol | Meaning |
|---|---|
| μ | Expected Democratic-minus-Republican margin, as a fraction of total votes (positive = Democrat ahead) |
| p | Forecaster's Democratic win probability |
| σ | Spread (standard deviation or scale) of the final margin |
| z | μ / σ, the forecast margin in σ units |
| φ | Density of the margin curve (standard normal, or Student t) |
| Φ⁻¹ | Quantile function of that curve (normal, or Student t) |
| T | Total 2024 presidential votes in the race's geography |
| P | Probability that one ballot is decisive |
| w | Senate weight (default 4.35) |
| P̄ | Average of P used for normalizing |

**Implied σ** — σ = μ / Φ⁻¹(p). In words: the spread that makes the forecaster's margin and win probability agree.

**Weighted (per voter)** — P = 2·φ(z) / (σ·T). In words: curve height at a tie, times two, divided by votes cast.

**Unweighted (per race)** — P = 2·φ(z) / σ. In words: the same without dividing by votes cast.

**Combined** — P_total = P_house + w · P_senate (for the voter's state; a state's Senate power sums across its contests). In words: House power plus 4.35 times Senate power.

**Index** — P / P̄. In words: each score as a multiple of the average voter (weighted) or average race (unweighted).

## Updating the data

1. Replace `data/house_forecast.tsv` and `data/senate_forecast.tsv` with fresh forecast exports (columns: `cd`/`state`, `matchup`, `raw_prediction`, `win_prob_d`).
2. Run `python3 build.py`. It merges the forecasts with the vote files in `data/` and writes `docs/data.json`.
3. Commit and push. The site reads `docs/data.json` directly; there is no other build step.
