import { MIN_DEPOSIT, MIN_INVESTMENT, defaultTodayProvider } from "../config/constants.js";
import { WeeklyInvestmentPolicy } from "../core/WeeklyInvestmentPolicy.js";

export class PortfolioResultsCalculator {
  constructor({
    firstNFilter,
    movementMapper,
    xirrCalculator,
    weightedAgeCalculator,
    logger = console,
    minDeposit = MIN_DEPOSIT,
    minInvestment = MIN_INVESTMENT,
    weeklyInvestmentPolicy = new WeeklyInvestmentPolicy(),
    todayProvider = defaultTodayProvider,
  }) {
    this.firstNFilter = firstNFilter;
    this.movementMapper = movementMapper;
    this.xirrCalculator = xirrCalculator;
    this.weightedAgeCalculator = weightedAgeCalculator;
    this.logger = logger;
    this.minDeposit = minDeposit;
    this.minInvestment = minInvestment;
    this.weeklyInvestmentPolicy = weeklyInvestmentPolicy;
    this.todayProvider = todayProvider;
  }

  calculate(tabs, firstNValues, strategy = {}) {
    const configuredMinDeposit = this.#toPositiveAmount(strategy.minDeposit, this.minDeposit);
    const configuredMinInvestment = this.#toPositiveAmount(strategy.minInvestment, this.minInvestment);
    const reinvest = Boolean(strategy.reinvest);
    const results = [];

    for (const firstN of firstNValues) {
      tabs.forEach((tabData) => {
        const tabName = tabData.name;
        const entries = this.firstNFilter.filter(tabData.entries, firstN);
        const movements = entries.flatMap((entry) => this.movementMapper.map(entry));
        const dates = [...new Set(movements.map((movement) => movement.date))].sort();

        const moneyIn = [];
        const moneyOut = [];
        const buyScaleByPositionId = new Map();
        let depositCash = 0;
        let saleCash = 0;
        let valueToday = 0;

        for (const date of dates) {
          const buyMovements = movements.filter(
            (movement) => movement.date === date && movement.action === "buy",
          );

          const allocation = this.weeklyInvestmentPolicy.decide({
            buyCount: buyMovements.length,
            depositCash,
            saleCash,
            minDeposit: configuredMinDeposit,
            minInvestment: configuredMinInvestment,
            reinvest,
          });
          if (allocation.depositTopUp > 0) {
            moneyIn.push({ date, amount: allocation.depositTopUp });
          }

          buyMovements.forEach((movement) => {
            if (movement.amount <= 0 || movement.positionId == null) {
              return;
            }
            buyScaleByPositionId.set(movement.positionId, allocation.investedByPosition / movement.amount);
          });

          depositCash = allocation.nextDepositCash;
          saleCash = allocation.nextSaleCash;

          const toSell = movements
            .filter((movement) => movement.date === date && movement.action === "sell")
            .reduce((sum, movement) => sum + this.#scaledAmount(movement, buyScaleByPositionId), 0);
          saleCash += toSell;

          const currentValue = movements
            .filter((movement) => movement.date === date && movement.action === "valueToday")
            .reduce((sum, movement) => sum + this.#scaledAmount(movement, buyScaleByPositionId), 0);

          if (currentValue > 0) {
            valueToday += currentValue;
            moneyOut.push({ date, amount: +currentValue.toFixed(2) });
          }
        }

        const today = this.todayProvider();
        if (moneyOut.length > 0) {
          const last = moneyOut[moneyOut.length - 1];
          if (last.date === today) {
            last.amount = +(last.amount + depositCash + saleCash).toFixed(2);
          } else {
            moneyOut.push({ date: today, amount: +(depositCash + saleCash).toFixed(2) });
          }
        } else {
          moneyOut.push({ date: today, amount: +(depositCash + saleCash).toFixed(2) });
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

        const deposited = +moneyIn.reduce((sum, entry) => sum + entry.amount, 0).toFixed(2);
        const invested = +valueToday.toFixed(2);
        const cash = depositCash + saleCash;
        const current = +(invested + cash).toFixed(2);
        const returnsPct = deposited > 0 ? +(((current / deposited) - 1) * 100).toFixed(2) : 0;

        results.push({
          top_n: firstN,
          tab: tabName,
          XIRR: Number.isNaN(rate) ? "N/A" : +((rate * 100).toFixed(2)),
          avg_age_y: +avgAge.toFixed(2),
          deposited,
          current,
          invested,
          cash: +cash.toFixed(2),
          returns: returnsPct,
        });
      });
    }

    return results;
  }

  #scaledAmount(movement, buyScaleByPositionId) {
    const scale = movement.positionId != null ? buyScaleByPositionId.get(movement.positionId) : null;
    if (scale == null) {
      return 0;
    }
    return +(movement.amount * scale).toFixed(2);
  }

  #toPositiveAmount(rawValue, fallback) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }
}
