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
- Enter **Block sales S&P 500 -D** (default `20,50,100`, empty to disable)

**Bulk input** (right textarea): paste lines in order — URL, API key, Top N values, minimum deposit, minimum investment. The fields on the left will be filled automatically when you click Calculate.

## Blocking sales on a falling S&P 500

**Block sales S&P 500 -D** holds a sale back while the index is below where it was a
while ago. The field takes positive whole numbers separated by commas (e.g. `20,50,100`),
each one a number of **sessions** — days the market actually quoted, so weekends and
holidays are not counted. Leave it empty to sell exactly as the sheet says; anything that
is not a list of positive whole numbers is rejected.

On the day a sale is due (the row's `FechaV`), the index is compared with its value N
sessions earlier for every N in the list. **If any of those changes is negative the sale
does not happen**, and the same check runs again on the next session. When the sale
finally goes through it is priced with the real close of that session, taken from the
price history, not with the sheet's `PrecioV`. The action log shows those sales as
`Sell AAPL (held from 2025-04-03)`.

If the index is still down when the history runs out, the sale never happened: the
position stays open and is valued at the last price available.

This needs two extra tabs in the same spreadsheet. Both are ignored when the field is
empty.

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

Only tickers that were sold (`FechaV` set) can ever be held back, so only those need a
column, and only from their earliest `FechaV` onwards. Dates must be `YYYY-MM-DD`; cells
without a usable price (`#N/A` on weekends, holidays and days outside the ticker's
history) are skipped, so each ticker keeps its own sessions. Paste the prices as values
once they are computed — hundreds of live GOOGLEFINANCE formulas are slow and return
`#N/A` under rate limiting.

If a held-back sale reaches a session with no price for that ticker, the calculation
stops with an error naming the ticker and the date instead of guessing a price.

## Investment allocation rules

The app calculates three strategies for every Top N + tab combination:

- **Fixed**: invests the weekly minimum only from deposits; sales remain as cash.
- **Reinv**: keeps the weekly minimum and reinvests sales in multiples of the minimum investment.
- **Incr**: same as Reinv, but sale reinvestment follows the incremental memory policy.
