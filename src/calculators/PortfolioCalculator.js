import { AppConfig } from "../config.js";

export class PortfolioCalculator {
    constructor(financialMetrics, todayProvider = () => AppConfig.today()) {
        this.financialMetrics = financialMetrics;
        this.todayProvider = todayProvider;
    }

    calculate(tabs, firstNValues) {
        const results = [];

        for (const firstN of firstNValues) {
            const tabsForCurrentN = tabs.map(tab => this.#filterFirstNPerDate(tab, firstN));

            tabsForCurrentN.forEach((tab, index) => {
                results.push(this.#calculateTabResult(tab, firstN, AppConfig.tabNames[index]));
            });
        }

        return results;
    }

    #calculateTabResult(tab, firstN, tabName) {
        const movements = tab.flatMap(entry => this.#tabEntryToPortfolioMovements(entry));
        const dates = [...new Set(movements.map(movement => movement.date))].sort();

        const moneyIn = [];
        const moneyOut = [];
        let cash = 0;
        let invested = 0;

        for (const date of dates) {
            const buyAmount = this.#sumMovements(movements, date, "buy");
            let deposited = 0;

            while (cash < buyAmount) {
                cash += AppConfig.minDeposit;
                deposited += AppConfig.minDeposit;
            }

            if (deposited > 0) {
                moneyIn.push({ date, amount: deposited });
            }

            cash -= buyAmount;
            cash += this.#sumMovements(movements, date, "sell");

            const currentValue = this.#sumMovements(movements, date, "valueToday");
            if (currentValue > 0) {
                invested += currentValue;
                moneyOut.push({ date, amount: +currentValue.toFixed(2) });
            }
        }

        if (moneyOut.length > 0) {
            const lastFlow = moneyOut[moneyOut.length - 1];
            if (lastFlow.date === this.todayProvider()) {
                lastFlow.amount = +(lastFlow.amount + cash).toFixed(2);
            } else {
                moneyOut.push({ date: this.todayProvider(), amount: +cash.toFixed(2) });
            }
        } else {
            moneyOut.push({ date: this.todayProvider(), amount: +cash.toFixed(2) });
        }

        const xirrFlows = [
            ...moneyIn.map(flow => ({ date: flow.date, amount: -flow.amount })),
            ...moneyOut.map(flow => ({ date: flow.date, amount: flow.amount })),
        ];

        let rate;
        try {
            rate = this.financialMetrics.xirr(xirrFlows);
        } catch (error) {
            console.warn(`XIRR failed for Top ${firstN} / ${tabName}: ${error.message}`);
            rate = NaN;
        }

        const avgAge = moneyIn.length > 0 ? this.financialMetrics.avgWeightedAge(moneyIn) : 0;
        const deposited = +(moneyIn.reduce((acc, flow) => acc + flow.amount, 0).toFixed(2));
        const roundedInvested = +(invested.toFixed(2));
        const roundedCash = +(cash.toFixed(2));
        const current = +(roundedInvested + roundedCash).toFixed(2);
        const returns = deposited === 0 ? "N/A" : +((((current - deposited) / deposited) * 100).toFixed(2));

        return {
            topN: firstN,
            tab: tabName,
            deposited,
            invested: roundedInvested,
            current,
            cash: roundedCash,
            returns,
            avgAgeY: +(avgAge.toFixed(2)),
            xirr: isNaN(rate) ? "N/A" : +((rate * 100).toFixed(2)),
        };
    }

    #filterFirstNPerDate(tab, firstN) {
        const countsByDate = {};

        return tab.filter(entry => {
            countsByDate[entry.fechac] ??= 0;
            countsByDate[entry.fechac] += 1;
            return countsByDate[entry.fechac] <= firstN;
        });
    }

    #tabEntryToPortfolioMovements(entry) {
        if (entry.ticker === "" || entry.nombre === "") {
            throw new Error(`Missing ticker or nombre: ${JSON.stringify(entry)}`);
        }
        if (entry.fechac === "" || entry.cantidad === "" || entry.precioc === "") {
            throw new Error(`Missing fechac, cantidad, or precioc: ${JSON.stringify(entry)}`);
        }

        const quantity = Number(entry.cantidad);
        const buyPrice = Number(entry.precioc.replace(/,/g, ""));
        const buyAmount = +(quantity * buyPrice).toFixed(2);
        const buy = { action: "buy", date: entry.fechac, ticker: entry.ticker, amount: buyAmount };

        if (entry.fechav !== "" && entry.preciov !== "") {
            if (entry.precioa !== "") {
                throw new Error(`Unexpected precioa with fechav and preciov: ${JSON.stringify(entry)}`);
            }

            const sellPrice = Number(entry.preciov.replace(/,/g, ""));
            const sellAmount = +(quantity * sellPrice).toFixed(2);
            return [buy, { action: "sell", date: entry.fechav, ticker: entry.ticker, amount: sellAmount }];
        }

        if (entry.precioa !== "") {
            if (entry.fechav !== "" || entry.preciov !== "") {
                throw new Error(`Unexpected fechav/preciov with precioa: ${JSON.stringify(entry)}`);
            }

            const currentPrice = Number(entry.precioa.replace(/,/g, ""));
            const currentAmount = +(quantity * currentPrice).toFixed(2);
            return [buy, { action: "valueToday", date: this.todayProvider(), ticker: entry.ticker, amount: currentAmount }];
        }

        throw new Error(`Unexpected entry (no sell or current price): ${JSON.stringify(entry)}`);
    }

    #sumMovements(movements, date, action) {
        return movements
            .filter(movement => movement.date === date && movement.action === action)
            .reduce((acc, movement) => acc + movement.amount, 0);
    }
}
