import { MIN_DEPOSIT, MIN_INVESTMENT, defaultTodayProvider } from "../config/constants.js";
import { WeeklyInvestmentPolicy } from "../core/WeeklyInvestmentPolicy.js";
import { BlockedSaleScheduler } from "../core/BlockedSaleScheduler.js";
import { SaleBlockHistoryValidator } from "../core/SaleBlockHistoryValidator.js";

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
    blockedSaleSchedulerFactory = (config) => new BlockedSaleScheduler(config),
    saleBlockHistoryValidator = new SaleBlockHistoryValidator(),
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
    this.blockedSaleSchedulerFactory = blockedSaleSchedulerFactory;
    this.saleBlockHistoryValidator = saleBlockHistoryValidator;
  }

  calculate(tabs, firstNValues, strategy = {}, history = null) {
    const configuredMinDeposit = this.#toPositiveAmount(strategy.minDeposit, this.minDeposit);
    const configuredMinInvestment = this.#toPositiveAmount(strategy.minInvestment, this.minInvestment);
    const configuredSmoothN = this.#toPositiveAmount(strategy.smoothN, 4);
    const saleBlockScheduler = this.#buildSaleBlockScheduler(
      strategy.saleBlockLookbacks,
      strategy.trackingStopPct,
      history,
    );
    const strategyVariants = [
      { strat: "Fixed D" },
      { strat: "Fixed S|D" },
      { strat: "Full S" },
      { strat: "Fixed D + Full S" },
      { strat: "Smooth S" },
      { strat: "Fixed D + Smooth S" },
      { strat: "Half S" },
      { strat: "Fixed D + Half S" },
      { strat: "Doubling S" },
      { strat: "Fixed D + Doubling S" },
    ];
    const results = [];

    for (const firstN of firstNValues) {
      tabs.forEach((tabData) => {
        strategyVariants.forEach(({ strat }) => {
          const tabName = tabData.name;
          const entries = this.firstNFilter.filter(tabData.entries, firstN);
          const mappedMovements = entries.flatMap((entry) => this.movementMapper.map(entry));
          const movements = saleBlockScheduler ? saleBlockScheduler.apply(mappedMovements) : mappedMovements;
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
          let smoothBand = 0;
          let smoothWeeksRemaining = 0;
          let valueToday = 0;
          let trackedDeposited = 0;
          let trackedInvested = 0;
          let lastSaleDate = null;

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
              strategy: strat,
              smoothN: configuredSmoothN,
              lastSaleReinvestment,
              smoothBand,
              smoothWeeksRemaining,
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
            smoothBand = allocation.nextSmoothBand ?? 0;
            smoothWeeksRemaining = allocation.nextSmoothWeeksRemaining ?? 0;

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
              lastSaleDate = date;
              addLogRow({
                date,
                action: this.#sellLabel(movement),
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
          // A portfolio is closed when no position is left open once every date has been
          // processed. Transient empty states (sold everything, then bought again) do not
          // count, and the closing date is the last executed sale, not the first time the
          // open positions map became empty.
          const closed = openPositionById.size === 0 && lastSaleDate != null;
          const asOf = closed ? lastSaleDate : today;

          if (moneyOut.length > 0) {
            const last = moneyOut[moneyOut.length - 1];
            if (last.date === asOf) {
              last.amount = +(last.amount + depositCash + saleCash).toFixed(2);
            } else {
              moneyOut.push({ date: asOf, amount: +(depositCash + saleCash).toFixed(2) });
            }
          } else {
            moneyOut.push({ date: asOf, amount: +(depositCash + saleCash).toFixed(2) });
          }

          const xirrFlows = [
            ...moneyIn.map((entry) => ({ date: entry.date, amount: -entry.amount })),
            ...moneyOut.map((entry) => ({ date: entry.date, amount: entry.amount })),
          ];

          let rate;
          try {
            rate = this.xirrCalculator.calculate(xirrFlows);
          } catch (error) {
            this.logger.warn(`XIRR failed for Top ${firstN} / ${tabName} / ${strat}: ${error.message}`);
            rate = Number.NaN;
          }

          const avgAge = moneyIn.length > 0 ? this.weightedAgeCalculator.calculate(moneyIn, asOf) : 0;

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
            date: asOf,
            action: closed ? "Closed" : "Final snapshot",
            amount: 0,
          });
          const result = {
            top_n: firstN,
            tab: tabName,
            strat,
            closed,
            asOf,
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
      });
    }

    return results;
  }

  // Says why a sale left its scheduled date: the stop brought it forward, the index
  // held it back, or both.
  #sellLabel(movement) {
    const notes = [];
    if (movement.stopLoss) {
      notes.push("stop loss");
    }
    if (movement.blockedFrom) {
      notes.push(`held from ${movement.blockedFrom}`);
    }

    return notes.length === 0 ? `Sell ${movement.ticker}` : `Sell ${movement.ticker} (${notes.join(", ")})`;
  }

  // Returns null when the feature is off, so the mapped movements are used as they are.
  #buildSaleBlockScheduler(rawLookbacks, rawTrackingStopPct, history) {
    const lookbacks = Array.isArray(rawLookbacks) ? rawLookbacks : [];
    if (lookbacks.length === 0) {
      return null;
    }

    const errors = this.saleBlockHistoryValidator.validateHistory({ lookbacks, history });
    if (errors.length > 0) {
      throw new Error(errors.join(" "));
    }

    return this.blockedSaleSchedulerFactory({
      indexSeries: history.indexSeries,
      priceSeriesByTicker: history.priceSeriesByTicker || new Map(),
      lookbacks,
      trackingStopPct: Number(rawTrackingStopPct) > 0 ? Number(rawTrackingStopPct) : 0,
      todayProvider: this.todayProvider,
    });
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
