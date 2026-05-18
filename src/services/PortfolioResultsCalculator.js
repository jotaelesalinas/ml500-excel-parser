import { MIN_DEPOSIT, defaultTodayProvider } from "../config/constants.js";

export class PortfolioResultsCalculator {
  constructor({
    firstNFilter,
    movementMapper,
    xirrCalculator,
    weightedAgeCalculator,
    logger = console,
    minDeposit = MIN_DEPOSIT,
    todayProvider = defaultTodayProvider,
  }) {
    this.firstNFilter = firstNFilter;
    this.movementMapper = movementMapper;
    this.xirrCalculator = xirrCalculator;
    this.weightedAgeCalculator = weightedAgeCalculator;
    this.logger = logger;
    this.minDeposit = minDeposit;
    this.todayProvider = todayProvider;
  }

  calculate(tabs, firstNValues) {
    const results = [];

    for (const firstN of firstNValues) {
      tabs.forEach((tabData) => {
        const tabName = tabData.name;
        const entries = this.firstNFilter.filter(tabData.entries, firstN);
        const movements = entries.flatMap((entry) => this.movementMapper.map(entry));
        const dates = [...new Set(movements.map((movement) => movement.date))].sort();

        const moneyIn = [];
        const moneyOut = [];
        let cash = 0;
        let valueToday = 0;

        for (const date of dates) {
          const toBuy = movements
            .filter((movement) => movement.date === date && movement.action === "buy")
            .reduce((sum, movement) => sum + movement.amount, 0);

          let deposited = 0;
          while (cash < toBuy) {
            cash += this.minDeposit;
            deposited += this.minDeposit;
          }
          if (deposited > 0) {
            moneyIn.push({ date, amount: deposited });
          }
          cash -= toBuy;

          const toSell = movements
            .filter((movement) => movement.date === date && movement.action === "sell")
            .reduce((sum, movement) => sum + movement.amount, 0);
          cash += toSell;

          const currentValue = movements
            .filter((movement) => movement.date === date && movement.action === "valueToday")
            .reduce((sum, movement) => sum + movement.amount, 0);

          if (currentValue > 0) {
            valueToday += currentValue;
            moneyOut.push({ date, amount: +currentValue.toFixed(2) });
          }
        }

        const today = this.todayProvider();
        if (moneyOut.length > 0) {
          const last = moneyOut[moneyOut.length - 1];
          if (last.date === today) {
            last.amount = +(last.amount + cash).toFixed(2);
          } else {
            moneyOut.push({ date: today, amount: +cash.toFixed(2) });
          }
        } else {
          moneyOut.push({ date: today, amount: +cash.toFixed(2) });
        }

        const xirrFlows = [
          ...moneyIn.map((entry) => ({ date: entry.date, amount: -entry.amount })),
          ...moneyOut.map((entry) => ({ date: entry.date, amount: entry.amount })),
        ];

        let rate;
        try {
          rate = this.xirrCalculator.calculate(xirrFlows);
        } catch (error) {
          this.logger.warn(`XIRR failed for Top ${firstN} / ${tabName}: ${error.message}`);
          rate = Number.NaN;
        }

        const avgAge = moneyIn.length > 0 ? this.weightedAgeCalculator.calculate(moneyIn) : 0;

        results.push({
          top_n: firstN,
          tab: tabName,
          XIRR: Number.isNaN(rate) ? "N/A" : +((rate * 100).toFixed(2)),
          avg_age_y: +avgAge.toFixed(2),
          deposited: +moneyIn.reduce((sum, entry) => sum + entry.amount, 0).toFixed(2),
          invested: +valueToday.toFixed(2),
          cash: +cash.toFixed(2),
        });
      });
    }

    return results;
  }
}
