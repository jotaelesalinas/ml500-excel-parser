export class WeeklyInvestmentPolicy {
  decide({
    buyCount,
    depositCash,
    saleCash,
    minDeposit,
    minInvestment,
    strategy,
    smoothN = 4,
    lastSaleReinvestment = 0,
    smoothBand = 0,
    smoothWeeksRemaining = 0,
  }) {
    if (buyCount <= 0) {
      return {
        depositTopUp: 0,
        baseToBuy: 0,
        saleReinvestment: 0,
        targetToBuy: 0,
        investedByPosition: 0,
        investedToday: 0,
        investedFromDeposits: 0,
        investedFromSales: 0,
        nextDepositCash: depositCash,
        nextSaleCash: saleCash,
        nextLastSaleReinvestment: lastSaleReinvestment,
        nextSmoothBand: smoothBand,
        nextSmoothWeeksRemaining: smoothWeeksRemaining,
      };
    }

    const { saleReinvestment, nextSmoothBand, nextSmoothWeeksRemaining } =
      this.#computeSaleAmount({ strategy, saleCash, minInvestment, smoothN, smoothBand, smoothWeeksRemaining, lastSaleReinvestment });

    // Determine fromDeposits and fromSales based on strategy family
    let fromDeposits, fromSales;

    if (strategy === "Fixed D") {
      fromDeposits = minInvestment;
      fromSales = 0;
    } else if (strategy === "Fixed S|D") {
      if (saleCash >= minInvestment) {
        fromDeposits = 0;
        fromSales = minInvestment;
      } else {
        fromDeposits = minInvestment;
        fromSales = 0;
      }
    } else if (strategy.startsWith("Fixed D +")) {
      fromDeposits = minInvestment;
      fromSales = saleReinvestment;
    } else {
      // Sales-first: Full S, Smooth S, Half S, Doubling S
      if (saleReinvestment > 0) {
        fromDeposits = 0;
        fromSales = saleReinvestment;
      } else {
        fromDeposits = minInvestment;
        fromSales = 0;
      }
    }

    let depositTopUp = 0;
    while (depositCash + depositTopUp < fromDeposits) {
      depositTopUp += minDeposit;
    }

    const targetToBuy = fromDeposits + fromSales;
    const investedByPosition = Math.floor(targetToBuy / buyCount);
    const investedToday = investedByPosition * buyCount;

    let investedFromDeposits, investedFromSales;
    if (fromDeposits === 0) {
      investedFromDeposits = 0;
      investedFromSales = investedToday;
    } else if (fromSales === 0) {
      investedFromDeposits = investedToday;
      investedFromSales = 0;
    } else {
      investedFromDeposits = Math.min(investedToday, fromDeposits);
      investedFromSales = Math.max(0, investedToday - investedFromDeposits);
    }

    const nextLastSaleReinvestment =
      strategy === "Doubling S" || strategy === "Fixed D + Doubling S"
        ? investedFromSales
        : 0;

    return {
      depositTopUp,
      baseToBuy: fromDeposits,
      saleReinvestment: fromSales,
      targetToBuy,
      investedByPosition,
      investedToday,
      investedFromDeposits,
      investedFromSales,
      nextDepositCash: depositCash + depositTopUp - investedFromDeposits,
      nextSaleCash: saleCash - investedFromSales,
      nextLastSaleReinvestment,
      nextSmoothBand,
      nextSmoothWeeksRemaining,
    };
  }

  #computeSaleAmount({ strategy, saleCash, minInvestment, smoothN, smoothBand, smoothWeeksRemaining, lastSaleReinvestment }) {
    const noSale = { saleReinvestment: 0, nextSmoothBand: smoothBand, nextSmoothWeeksRemaining: smoothWeeksRemaining };

    if (strategy === "Fixed D" || strategy === "Fixed S|D") {
      return noSale;
    }

    if (strategy === "Full S" || strategy === "Fixed D + Full S") {
      return { ...noSale, saleReinvestment: Math.floor(saleCash / minInvestment) * minInvestment };
    }

    if (strategy === "Smooth S" || strategy === "Fixed D + Smooth S") {
      const { saleReinvestment, nextSmoothBand, nextSmoothWeeksRemaining } =
        this.#decideSmooth({ saleCash, minInvestment, smoothN, smoothBand, smoothWeeksRemaining });
      return { saleReinvestment, nextSmoothBand, nextSmoothWeeksRemaining };
    }

    if (strategy === "Half S" || strategy === "Fixed D + Half S") {
      const half = saleCash * 0.5;
      return { ...noSale, saleReinvestment: half >= minInvestment ? Math.floor(half / minInvestment) * minInvestment : 0 };
    }

    if (strategy === "Doubling S" || strategy === "Fixed D + Doubling S") {
      return { ...noSale, saleReinvestment: this.#decideDoublingReinvestment({ saleCash, minInvestment, lastSaleReinvestment }) };
    }

    return noSale;
  }

  #decideSmooth({ saleCash, minInvestment, smoothN, smoothBand, smoothWeeksRemaining }) {
    const newBand = Math.floor(saleCash / (smoothN * minInvestment));
    const needsReset = smoothWeeksRemaining === 0 || newBand > smoothBand;

    let activeBand = smoothBand;
    let activeWeeks = smoothWeeksRemaining;

    if (needsReset) {
      if (newBand >= 1) {
        activeBand = newBand;
        activeWeeks = smoothN;
      } else {
        return { saleReinvestment: 0, nextSmoothBand: 0, nextSmoothWeeksRemaining: 0 };
      }
    }

    return {
      saleReinvestment: activeBand * minInvestment,
      nextSmoothBand: activeBand,
      nextSmoothWeeksRemaining: activeWeeks - 1,
    };
  }

  #decideDoublingReinvestment({ saleCash, minInvestment, lastSaleReinvestment }) {
    if (saleCash < minInvestment) {
      return 0;
    }
    if (lastSaleReinvestment <= 0) {
      return minInvestment;
    }
    let candidate = Math.floor(lastSaleReinvestment * 2);
    while (candidate > saleCash && candidate > minInvestment) {
      candidate = Math.floor(candidate / 2);
    }
    if (candidate < minInvestment) {
      return minInvestment;
    }
    return Math.floor(candidate);
  }
}
