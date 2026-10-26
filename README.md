# ML500 Excel Parser

Browser-based tool for analyzing investment portfolio performance from Google Sheets.

## What it does

Point it at a Google Sheets spreadsheet containing your investment records and it will calculate, for each tab:

- **Deposited** — total cash injected into the portfolio
- **Invested** — current market value of open positions
- **Cash** — uninvested cash
- **Current** — invested + cash
- **Returns** — total return percentage relative to deposited
- **Avg Age (Y)** — weighted average age of holdings, in years
- **XIRR** — annualized internal rate of return

You can run the analysis for multiple **Top N** values at once. Top N means "consider only the first N holdings by purchase date."

## Running locally

```bash
npm start   # serves at http://localhost:8080
npm test    # runs the Jasmine test suite
```

No build step — the app uses native ES modules served directly by `serve`.

## Frontend architecture

The UI layer is split into an explicit state store plus small controllers and renderers. See `docs/frontend-architecture.md` for the contributor-facing boundaries.

## Google Sheets format

Each tab you want analyzed must have a header row (row 1) with **at least** these column names (case-insensitive):

| Column | Required | Description |
|--------|----------|-------------|
| `Ticker` | ✓ | Stock ticker symbol |
| `Nombre` | ✓ | Company name |
| `FechaC` | ✓ | Purchase date (`YYYY-MM-DD`) |
| `Cantidad` | ✓ | Number of shares |
| `PrecioC` | ✓ | Purchase price per share |
| `FechaV` | | Sale date (`YYYY-MM-DD`). Leave empty if still held. |
| `PrecioV` | | Sale price per share. Required when `FechaV` is set. |
| `PrecioA` | | Current price per share. Required when still held (`FechaV` empty). |

Columns can be in any order. Extra columns are ignored. Tabs without the required columns are skipped automatically.

**Rule**: each row must have either `FechaV` + `PrecioV` (sold position) or `PrecioA` (open position) — not both.

## Getting a Google API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use an existing one)
3. Enable the **Google Sheets API**
4. Create an **API key** under *Credentials*
5. The spreadsheet must be shared as **"Anyone with the link can view"**

Your API key is never stored — it only lives in the browser page while you use it.

## Input

**Individual fields** (left column):
- Paste the spreadsheet URL
- Enter the API key
- Enter one or more Top N values, comma-separated (e.g. `4, 10, 20`)
- Enter **Minimum deposit** (default `1000`)
- Enter **Minimum investment** (default `100`)
- Switch **Block sales on a falling S&P 500** on or off (off by default). With it on,
  fill **Block sales S&P 500 -D** (default `20,50,100`) and **Tracking stop loss (%)**
  (default `20`); both fields are disabled while it is off

**Bulk input** (right textarea): paste lines in order — URL, API key, Top N values, minimum deposit, minimum investment. The fields on the left will be filled automatically when you click Calculate.

## Blocking sales on a falling S&P 500

**Block sales on a falling S&P 500** is off by default, and with it off nothing changes:
every position is sold exactly as the sheet says, and the two history tabs below are
ignored. Switching it on enables its two fields and changes how sales are decided.

**Block sales S&P 500 -D** takes positive whole numbers separated by commas (e.g.
`20,50,100`), each one a number of **sessions** — days the market actually quoted, so
weekends and holidays are not counted. An empty field, or anything that is not a list of
positive whole numbers, is rejected: the block cannot run without a lookback.

**Tracking stop loss (%)** takes a percentage greater than 0 and lower than 100
(default `20`).

With the block on, two things can sell a position, and the index has the last word on
both.

### The sheet's sale

On the day a sale is due (the row's `FechaV`), the index is compared with its value N
sessions earlier for every N in the list. **If any of those changes is negative the sale
does not happen**, and the same check runs again on the next session. When the sale
finally goes through it is priced with the real close of that session, taken from the
price history, not with the sheet's `PrecioV`. The action log shows those sales as
`Sell AAPL (held from 2025-04-03)`.

If the index is still down when the history runs out, the sale never happened: the
position stays open and is valued at the last price available.

### The trailing stop loss

The stop watches **every position** from its purchase (`FechaC`), the ones the sheet
sells and the ones it still holds. Session by session it keeps the highest close seen
since the purchase and compares the current close with it: a close that is the configured
percentage or more below that maximum breaks the stop. The maximum comes from the price
history alone, so the sheet's `PrecioC` is never the first maximum.

The stop is a condition, not a queued order, so the index cannot hold it back: it sells
on the first session that is **both** below the stop level **and** not blocked by the
index. While sales are blocked the position keeps being watched, so a price that climbs
back above the stop level simply cancels it, and the maximum keeps trailing from the new
high. A stop that is never free to sell leaves the position open.

A stop sale is priced with the close of the session it happens on, and the action log
shows it as `Sell AAPL (stop loss)`. For a position the sheet sells later, the stop only
matters when it sells first; a position the sheet does not sell at all is closed by the
stop and its cash is reinvested like any other sale.

Because the stop measures from the purchase, **every** position needs its ticker's prices
from `FechaC` onwards, not only the sold ones. A position whose prices start later is an
error, not a guess: see *What the app checks*.

This needs two extra tabs in the same spreadsheet. Both are ignored while the block is
off.

### `Index hist`

Columns are found by header, so a `Fecha` / `Día` / `Valor` block can repeat across the
row (one per year) and extra columns are ignored:

| Ticker | Fecha | Día | Valor | Fecha | Día | Valor |
|--------|-------|-----|-------|-------|-----|-------|
| `INDEXSP:.INX` | `2025-01-02` | Thu | `5,868.55` | `2026-01-02` | Fri | `6,858.47` |

### `Prices hist`

One **calendar-day row** and one **column per ticker**, with the ticker in row 1. The
`Fecha` column is shared by every ticker and is found by header, so the `Día` weekday
helper next to it and the `_SAMPLE_` template column are ignored:

| Fecha | Día | _SAMPLE_ | A | AAPL |
|-------|-----|----------|---|------|
| `2023-01-01` | Sun | `#N/A` | `#N/A` | `#N/A` |
| `2023-01-03` | Tue | `#N/A` | `150.04` | `125.07` |
| `2023-01-04` | Wed | `#N/A` | `151.67` | `126.36` |

Every position is watched by the stop, so every ticker needs a column, with prices from
its earliest `FechaC` onwards. Dates must be `YYYY-MM-DD`; cells without a usable price (`#N/A` on weekends, holidays and days outside the ticker's
history) are skipped, so each ticker keeps its own sessions. Paste the prices as values
once they are computed — hundreds of live GOOGLEFINANCE formulas are slow and return
`#N/A` under rate limiting.

If a held-back sale reaches a session with no price for that ticker, the calculation
stops with an error naming the ticker and the date instead of guessing a price.

### What the app checks

Nothing is read on a best-effort basis: whatever does not look like the layout above is
reported instead of silently ignored.

**After loading**, the status line lists every warning found while reading the
spreadsheet, and the browser console repeats them one by one:

- a tab skipped because row 1 does not hold the required headers (`ticker`, `nombre`,
  `fechac`, `cantidad`, `precioc`);
- a missing `Index hist` or `Prices hist` tab;
- a history tab that is empty, or whose row 1 does not hold the expected columns;
- a row whose `Fecha` is not a `YYYY-MM-DD` date, or a cell that holds something other
  than a number where a price or an index value is expected (`#N/A` and empty cells are
  expected absences and are never reported);
- a ticker column with no price at all.

Repeated problems of the same kind are capped at five lines and then counted, so one
badly pasted column does not flood the status line.

**On Calculate**, with the block on, the same warnings are shown again, plus one per sale
that has no price after its `FechaV` — the sales that would stop the calculation if the
index held them back. These cases are errors instead, and no result is calculated:

- the index history is missing or unreadable;
- the price history is missing or unreadable;
- a position whose ticker has no price on or before its `FechaC`, which the stop would
  otherwise watch from a later maximum (up to five are named, then counted).

Switch the block off to calculate without any history.

## Investment allocation rules

The app calculates three strategies for every Top N + tab combination:

- **Fixed**: invests the weekly minimum only from deposits; sales remain as cash.
- **Reinv**: keeps the weekly minimum and reinvests sales in multiples of the minimum investment.
- **Incr**: same as Reinv, but sale reinvestment follows the incremental memory policy.
