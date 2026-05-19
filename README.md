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
- Enter **Minimum investment** (default `200`)

**Bulk input** (right textarea): paste lines in order — URL, API key, Top N values, minimum deposit, minimum investment. The fields on the left will be filled automatically when you click Calculate.

## Investment allocation rules

The app calculates three strategies for every Top N + tab combination:

- **Fixed**: invests the weekly minimum only from deposits; sales remain as cash.
- **Reinv**: keeps the weekly minimum and reinvests sales in multiples of the minimum investment.
- **Incr**: same as Reinv, but sale reinvestment follows the incremental memory policy.
