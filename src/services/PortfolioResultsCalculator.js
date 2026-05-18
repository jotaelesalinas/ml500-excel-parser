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
    const incremental = reinvest && Boolean(strategy.incremental);
    const results = [];

    for (const firstN of firstNValues) {
      tabs.forEach((tabData) => {
        const tabName = tabData.name;
        const entries = this.firstNFilter.filter(tabData.entries, firstN);
        const movements = entries.flatMap((entry) => this.movementMapper.map(entry));
        const dates = [...new Set(movements.map((movement) => movement.date))].sort();

        const moneyIn = [];
        const moneyOut = [];
        const actionLog = [];
        const buyScaleByPositionId = new Map();
        const openPositionById = new Map();
        const currentByTicker = new Map();
        let depositCash = 0;
        let saleCash = 0;
        let lastSaleReinvestment = 0;
        let valueToday = 0;
        let trackedDeposited = 0;
        let trackedInvested = 0;

        const addLogRow = ({ date, action, qty = null, amount = 0 }) => {
          const cash = depositCash + saleCash;
          const current = trackedInvested + cash;
          const returns = trackedDeposited > 0 ? (((current / trackedDeposited) - 1) * 100) : 0;
          actionLog.push({
            date,
            action,
            qty: qty == null ? null : +qty.toFixed(6),
            amount: +amount.toFixed(2),
            deposited: +trackedDeposited.toFixed(2),
            current: +current.toFixed(2),
            invested: +trackedInvested.toFixed(2),
            depositCash: +depositCash.toFixed(2),
            saleCash: +saleCash.toFixed(2),
            cash: +cash.toFixed(2),
            returns: +returns.toFixed(2),
          });
        };

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
            incremental,
            lastSaleReinvestment,
          });
          if (allocation.depositTopUp > 0) {
            moneyIn.push({ date, amount: allocation.depositTopUp });
            depositCash += allocation.depositTopUp;
            trackedDeposited += allocation.depositTopUp;
            addLogRow({ date, action: "Deposit", amount: allocation.depositTopUp });
          }

          buyMovements.forEach((movement) => {
            if (movement.amount <= 0 || movement.positionId == null) {
              return;
            }
            buyScaleByPositionId.set(movement.positionId, allocation.investedByPosition / movement.amount);
          });

          const validBuys = buyMovements
            .map((movement) => ({
              movement,
              scaledAmount: this.#scaledAmount(movement, buyScaleByPositionId),
              scaledQty: this.#scaledQuantity(movement, buyScaleByPositionId),
            }))
            .filter(({ scaledAmount }) => scaledAmount > 0);

          let remainingFromDeposits = allocation.investedFromDeposits;
          let remainingFromSales = allocation.investedFromSales;
          validBuys.forEach(({ movement, scaledAmount, scaledQty }, index) => {
            const rowsLeft = validBuys.length - index;
            const investedFromDeposits = this.#portionAmount(remainingFromDeposits, rowsLeft);
            const investedFromSales = this.#portionAmount(remainingFromSales, rowsLeft);
            remainingFromDeposits = +(remainingFromDeposits - investedFromDeposits).toFixed(2);
            remainingFromSales = +(remainingFromSales - investedFromSales).toFixed(2);
            depositCash = +(depositCash - investedFromDeposits).toFixed(2);
            saleCash = +(saleCash - investedFromSales).toFixed(2);
            trackedInvested = +(trackedInvested + scaledAmount).toFixed(2);
            openPositionById.set(movement.positionId, {
              ticker: movement.ticker,
              qty: scaledQty > 0 ? scaledQty : 0,
              cost: scaledAmount,
            });
            addLogRow({
              date,
              action: `Buy ${movement.ticker}`,
              qty: scaledQty > 0 ? scaledQty : null,
              amount: scaledAmount,
            });
          });
          depositCash = +allocation.nextDepositCash.toFixed(2);
          saleCash = +allocation.nextSaleCash.toFixed(2);
          lastSaleReinvestment = Math.floor(allocation.nextLastSaleReinvestment || 0);

          const sellMovements = movements.filter(
            (movement) => movement.date === date && movement.action === "sell",
          );
          sellMovements.forEach((movement) => {
            const scaledAmount = this.#scaledAmount(movement, buyScaleByPositionId);
            if (scaledAmount <= 0) {
              return;
            }
            const scaledQty = this.#scaledQuantity(movement, buyScaleByPositionId);
            const position = movement.positionId != null ? openPositionById.get(movement.positionId) : null;
            const costReleased = position ? position.cost : 0;
            if (movement.positionId != null) {
              openPositionById.delete(movement.positionId);
            }
            trackedInvested = +(trackedInvested - costReleased).toFixed(2);
            saleCash = +(saleCash + scaledAmount).toFixed(2);
            addLogRow({
              date,
              action: `Sell ${movement.ticker}`,
              qty: scaledQty > 0 ? scaledQty : null,
              amount: scaledAmount,
            });
          });

          const currentMovements = movements.filter(
            (movement) => movement.date === date && movement.action === "valueToday",
          );
          const currentValue = currentMovements
            .reduce((sum, movement) => sum + this.#scaledAmount(movement, buyScaleByPositionId), 0);

          if (currentValue > 0) {
            valueToday += currentValue;
            moneyOut.push({ date, amount: +currentValue.toFixed(2) });
          }
          currentMovements.forEach((movement) => {
            const scaledAmount = this.#scaledAmount(movement, buyScaleByPositionId);
            if (scaledAmount <= 0) {
              return;
            }
            const scaledQty = this.#scaledQuantity(movement, buyScaleByPositionId);
            const tickerTotals = currentByTicker.get(movement.ticker) || { date, qty: 0, amount: 0 };
            tickerTotals.date = date;
            tickerTotals.qty = +(tickerTotals.qty + scaledQty).toFixed(6);
            tickerTotals.amount = +(tickerTotals.amount + scaledAmount).toFixed(2);
            currentByTicker.set(movement.ticker, tickerTotals);
          });
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

        const openCostByTicker = new Map();
        openPositionById.forEach((position) => {
          const prev = openCostByTicker.get(position.ticker) || 0;
          openCostByTicker.set(position.ticker, +(prev + position.cost).toFixed(2));
        });
        [...currentByTicker.keys()].sort().forEach((ticker) => {
          const currentTotals = currentByTicker.get(ticker);
          const costBeforeValuation = openCostByTicker.get(ticker) || 0;
          const diffAmount = +(currentTotals.amount - costBeforeValuation).toFixed(2);
          trackedInvested = +(trackedInvested + diffAmount).toFixed(2);
          addLogRow({
            date: currentTotals.date,
            action: `Diff ${ticker}`,
            qty: null,
            amount: diffAmount,
          });
        });

        trackedInvested = invested;
        addLogRow({
          date: today,
          action: "Final snapshot",
          amount: 0,
        });

        const result = {
          top_n: firstN,
          tab: tabName,
          XIRR: Number.isNaN(rate) ? "N/A" : +((rate * 100).toFixed(2)),
          avg_age_y: +avgAge.toFixed(2),
          deposited,
          current,
          invested,
          depositCash: +depositCash.toFixed(2),
          saleCash: +saleCash.toFixed(2),
          cash: +cash.toFixed(2),
          returns: returnsPct,
        };
        Object.defineProperty(result, "log", {
          value: actionLog,
          enumerable: false,
          writable: false,
        });
        results.push(result);
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

  #scaledQuantity(movement, buyScaleByPositionId) {
    const rawQty = Number(movement.qty);
    if (!Number.isFinite(rawQty) || rawQty <= 0) {
      return 0;
    }
    const scale = movement.positionId != null ? buyScaleByPositionId.get(movement.positionId) : null;
    if (scale == null) {
      return 0;
    }
    return +(rawQty * scale).toFixed(6);
  }

  #portionAmount(remainingAmount, rowsLeft) {
    if (rowsLeft <= 1) {
      return +remainingAmount.toFixed(2);
    }
    return +(remainingAmount / rowsLeft).toFixed(2);
  }

  #toPositiveAmount(rawValue, fallback) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }
}
