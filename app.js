"use strict";

const TODAY = new Date().toISOString().slice(0, 10);

const FIELDS = ["Ticker", "Nombre", "FechaC", "Cantidad", "PrecioC", "FechaV", "PrecioV", "PrecioA"];
const FIELD_SLUGS = FIELDS.map(f => f.toLowerCase());

const TAB_NAMES = [
    "HEU500 (top 4)",
    "SP500 PER (top 10)",
    "Rusell1000 PER (top 10)",
];

const MIN_DEPOSIT = 1000;

// --- Google Sheets API ---

function extractSpreadsheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) throw new Error("Could not extract spreadsheet ID from URL.");
    return match[1];
}

async function fetchSheetTabs(spreadsheetId, apiKey) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${encodeURIComponent(apiKey)}&fields=sheets.properties.title`;
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Failed to fetch spreadsheet metadata (${res.status}): ${body}`);
    }
    const data = await res.json();
    return data.sheets.map(s => s.properties.title);
}

async function fetchSheetValues(spreadsheetId, sheetName, apiKey) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Failed to fetch sheet "${sheetName}" (${res.status}): ${body}`);
    }
    const data = await res.json();
    return data.values || [];
}

function parseSheetRows(rows) {
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim().toLowerCase());
    return rows.slice(1)
        .map(row => {
            const obj = {};
            FIELD_SLUGS.forEach(slug => {
                const colIdx = headers.indexOf(slug);
                obj[slug] = (colIdx >= 0 && row[colIdx] != null) ? String(row[colIdx]).trim() : "";
            });
            return obj;
        })
        .filter(entry => entry.ticker !== "");
}

async function fetchAllTabs(spreadsheetId, apiKey) {
    const availableTabs = await fetchSheetTabs(spreadsheetId, apiKey);
    const tabs = [];
    for (const tabName of TAB_NAMES) {
        if (!availableTabs.includes(tabName)) {
            console.warn(`Sheet "${tabName}" not found. Available: ${availableTabs.join(", ")}`);
            tabs.push([]);
            continue;
        }
        const rows = await fetchSheetValues(spreadsheetId, tabName, apiKey);
        tabs.push(parseSheetRows(rows));
    }
    return tabs;
}

// --- Calculation logic (ported from original) ---

function filterFirstNPerDate(tab, firstN) {
    const dates = {};
    return tab.filter(entry => {
        dates[entry.fechac] ??= 0;
        dates[entry.fechac] += 1;
        return dates[entry.fechac] <= firstN;
    });
}

function tabEntryToPortfolioMovements(entry) {
    if (entry.ticker === "" || entry.nombre === "") {
        throw new Error(`Missing ticker or nombre: ${JSON.stringify(entry)}`);
    }
    if (entry.fechac === "" || entry.cantidad === "" || entry.precioc === "") {
        throw new Error(`Missing fechac, cantidad, or precioc: ${JSON.stringify(entry)}`);
    }

    const qty = Number(entry.cantidad);
    const buyPrice = Number(entry.precioc.replace(/,/g, ""));
    const buyAmount = +(qty * buyPrice).toFixed(2);

    const buy = { action: "buy", date: entry.fechac, ticker: entry.ticker, amount: buyAmount };

    if (entry.fechav !== "" && entry.preciov !== "") {
        if (entry.precioa !== "") {
            throw new Error(`Unexpected precioa with fechav and preciov: ${JSON.stringify(entry)}`);
        }
        const sellPrice = Number(entry.preciov.replace(/,/g, ""));
        const sellAmount = +(qty * sellPrice).toFixed(2);
        return [buy, { action: "sell", date: entry.fechav, ticker: entry.ticker, amount: sellAmount }];
    }

    if (entry.precioa !== "") {
        if (entry.fechav !== "" || entry.preciov !== "") {
            throw new Error(`Unexpected fechav/preciov with precioa: ${JSON.stringify(entry)}`);
        }
        const currentPrice = Number(entry.precioa.replace(/,/g, ""));
        const currentAmount = +(qty * currentPrice).toFixed(2);
        return [buy, { action: "valueToday", date: TODAY, ticker: entry.ticker, amount: currentAmount }];
    }

    throw new Error(`Unexpected entry (no sell or current price): ${JSON.stringify(entry)}`);
}

function xirr(cashflows, guess = 0.1) {
    if (!Array.isArray(cashflows) || cashflows.length < 2) {
        throw new Error("At least two cash flows are needed.");
    }
    const flows = cashflows
        .map(cf => ({ amount: Number(cf.amount), date: new Date(cf.date) }))
        .sort((a, b) => a.date - b.date);

    if (flows.some(f => isNaN(f.amount) || isNaN(f.date.getTime()))) {
        throw new Error("Invalid dates or amounts found.");
    }
    if (!flows.some(f => f.amount > 0)) throw new Error("At least one positive flow is needed.");
    if (!flows.some(f => f.amount < 0)) throw new Error("At least one negative flow is needed.");
    if (flows.some(f => f.amount === 0)) throw new Error("No zero flows are allowed.");

    const dayMs = 86400000;
    const firstDate = flows[0].date;
    const years = flows.map(f => (f.date - firstDate) / dayMs / 365.25);

    const npv = rate => {
        if (rate <= -1) return Infinity;
        return flows.reduce((sum, f, i) => sum + f.amount / Math.pow(1 + rate, years[i]), 0);
    };
    const dNpv = rate => {
        if (rate <= -1) return Infinity;
        return flows.reduce((sum, f, i) => {
            if (years[i] === 0) return sum;
            return sum - (years[i] * f.amount) / Math.pow(1 + rate, years[i] + 1);
        }, 0);
    };

    let rate = guess;
    for (let i = 0; i < 100; i++) {
        const value = npv(rate);
        const derivative = dNpv(rate);
        if (Math.abs(value) < 1e-8) return rate;
        if (!isFinite(derivative) || derivative === 0) break;
        const newRate = rate - value / derivative;
        if (!isFinite(newRate) || newRate <= -0.999999999) break;
        if (Math.abs(newRate - rate) < 1e-8) return newRate;
        rate = newRate;
    }
    throw new Error("XIRR did not converge.");
}

function avgWeightedAge(flows) {
    const parsed = flows
        .map(cf => ({ amount: Number(cf.amount), date: new Date(cf.date) }))
        .sort((a, b) => a.date - b.date);

    if (parsed.some(f => isNaN(f.amount) || isNaN(f.date.getTime()))) {
        throw new Error("Invalid dates or amounts found.");
    }
    if (parsed.some(f => f.amount <= 0)) throw new Error("All flows must be positive.");

    const dayMs = 86400000;
    const todayDate = new Date(TODAY);
    const sumWeighted = parsed.reduce((acc, f) => acc + ((todayDate - f.date) / dayMs / 365.25) * f.amount, 0);
    const sumAmounts = parsed.reduce((acc, f) => acc + f.amount, 0);
    return sumWeighted / sumAmounts;
}

// --- Main calculation ---

function calculate(tabs, firstNValues) {
    const results = [];

    for (const n of firstNValues) {
        const tabsForN = tabs.map(tab => filterFirstNPerDate(tab, n));

        tabsForN.forEach((tab, idx) => {
            const tabName = TAB_NAMES[idx];
            const movements = tab.flatMap(entry => tabEntryToPortfolioMovements(entry));
            const dates = [...new Set(movements.map(e => e.date))].sort();

            const moneyIn = [];
            const moneyOut = [];
            let cash = 0;
            let valueToday = 0;

            for (const date of dates) {
                const toBuy = movements
                    .filter(e => e.date === date && e.action === "buy")
                    .reduce((acc, e) => acc + e.amount, 0);

                let deposited = 0;
                while (cash < toBuy) {
                    cash += MIN_DEPOSIT;
                    deposited += MIN_DEPOSIT;
                }
                if (deposited > 0) moneyIn.push({ date, amount: deposited });
                cash -= toBuy;

                const toSell = movements
                    .filter(e => e.date === date && e.action === "sell")
                    .reduce((acc, e) => acc + e.amount, 0);
                cash += toSell;

                const currentValue = movements
                    .filter(e => e.date === date && e.action === "valueToday")
                    .reduce((acc, e) => acc + e.amount, 0);

                if (currentValue > 0) {
                    valueToday += currentValue;
                    moneyOut.push({ date, amount: +currentValue.toFixed(2) });
                }
            }

            if (moneyOut.length > 0) {
                const last = moneyOut[moneyOut.length - 1];
                if (last.date === TODAY) {
                    last.amount = +(last.amount + cash).toFixed(2);
                } else {
                    moneyOut.push({ date: TODAY, amount: +cash.toFixed(2) });
                }
            } else {
                moneyOut.push({ date: TODAY, amount: +cash.toFixed(2) });
            }

            const xirrFlows = [
                ...moneyIn.map(x => ({ date: x.date, amount: -x.amount })),
                ...moneyOut.map(x => ({ date: x.date, amount: x.amount })),
            ];

            let rate;
            try {
                rate = xirr(xirrFlows);
            } catch (e) {
                console.warn(`XIRR failed for Top ${n} / ${tabName}: ${e.message}`);
                rate = NaN;
            }

            const avgAge = moneyIn.length > 0 ? avgWeightedAge(moneyIn) : 0;

            results.push({
                top_n: n,
                tab: tabName,
                XIRR: isNaN(rate) ? "N/A" : +((rate * 100).toFixed(2)),
                avg_age_y: +(avgAge.toFixed(2)),
                deposited: +(moneyIn.reduce((acc, x) => acc + x.amount, 0).toFixed(2)),
                invested: +(valueToday.toFixed(2)),
                cash: +(cash.toFixed(2)),
            });
        });
    }

    return results;
}

// --- UI ---

function showStatus(msg, type) {
    const el = document.getElementById("status");
    el.textContent = msg;
    el.className = type;
}

function clearStatus() {
    const el = document.getElementById("status");
    el.className = "";
    el.textContent = "";
}

function renderResults(results) {
    const container = document.getElementById("results");
    if (results.length === 0) {
        container.innerHTML = "<p>No results.</p>";
        return;
    }

    let html = `<table>
        <thead><tr>
            <th>Top N</th><th>Tab</th><th>XIRR</th><th>Avg Age (Y)</th>
            <th>Deposited</th><th>Invested</th><th>Cash</th>
        </tr></thead><tbody>`;

    for (const r of results) {
        html += `<tr>
            <td class="num">${r.top_n}</td>
            <td>${r.tab}</td>
            <td class="num">${r.XIRR === "N/A" ? "N/A" : r.XIRR + "%"}</td>
            <td class="num">${r.avg_age_y}</td>
            <td class="num">${r.deposited.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td class="num">${r.invested.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td class="num">${r.cash.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        </tr>`;
    }

    html += "</tbody></table>";
    container.innerHTML = html;
}

document.getElementById("btn-calculate").addEventListener("click", async () => {
    const btn = document.getElementById("btn-calculate");
    const urlInput = document.getElementById("spreadsheet-url").value.trim();
    const apiKey = document.getElementById("api-key").value.trim();
    const firstNRaw = document.getElementById("first-n").value.trim();

    if (!urlInput) { showStatus("Please enter a Google Sheets URL.", "error"); return; }
    if (!apiKey) { showStatus("Please enter a Google API Key.", "error"); return; }

    let spreadsheetId;
    try {
        spreadsheetId = extractSpreadsheetId(urlInput);
    } catch (e) {
        showStatus(e.message, "error");
        return;
    }

    const firstNValues = firstNRaw.split(/\s*,\s*/g).map(Number).filter(n => n > 0);
    if (firstNValues.length === 0) {
        showStatus("Please enter at least one valid 'First N' value.", "error");
        return;
    }

    btn.disabled = true;
    showStatus("Fetching data from Google Sheets...", "info");

    try {
        const tabs = await fetchAllTabs(spreadsheetId, apiKey);
        showStatus("Calculating...", "info");
        const results = calculate(tabs, firstNValues);
        clearStatus();
        renderResults(results);
    } catch (e) {
        showStatus(`Error: ${e.message}`, "error");
        console.error(e);
    } finally {
        btn.disabled = false;
    }
});
