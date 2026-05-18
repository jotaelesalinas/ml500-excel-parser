export class WeeklyInvestmentPolicy {
  decide({
    buyCount,
    depositCash,
    saleCash,
    minDeposit,
    minInvestment,
    reinvest,
    incremental = false,
    lastSaleReinvestment = 0,
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
      };
    }

    const baseToBuy = minInvestment;
    let saleReinvestment = 0;
    if (reinvest) {
      if (incremental) {
        saleReinvestment = this.#decideIncrementalSaleReinvestment({
          saleCash,
          minInvestment,
          lastSaleReinvestment,
        });
      } else {
        saleReinvestment = Math.floor(saleCash / minInvestment) * minInvestment;
      }
    }
    const usesSalesForBase = !reinvest && saleCash >= baseToBuy;
    const baseFromSales = usesSalesForBase ? baseToBuy : 0;
    const baseFromDeposits = baseToBuy - baseFromSales;
    const targetToBuy = baseToBuy + saleReinvestment;

    let depositTopUp = 0;
    while (depositCash + depositTopUp < baseFromDeposits) {
      depositTopUp += minDeposit;
    }

    const investedByPosition = Math.floor(targetToBuy / buyCount);
    const investedToday = investedByPosition * buyCount;
    let investedFromDeposits;
    let investedFromSales;
    if (reinvest) {
      investedFromDeposits = Math.min(investedToday, baseFromDeposits);
      investedFromSales = Math.min(
        Math.max(investedToday - investedFromDeposits, 0),
        saleReinvestment,
      );
    } else {
      if (usesSalesForBase) {
        investedFromSales = Math.min(investedToday, baseFromSales);
        investedFromDeposits = 0;
      } else {
        investedFromSales = 0;
        investedFromDeposits = Math.min(investedToday, baseFromDeposits);
      }
    }
    const nextLastSaleReinvestment = incremental ? investedFromSales : 0;

    return {
      depositTopUp,
      baseToBuy,
      saleReinvestment,
      targetToBuy,
      investedByPosition,
      investedToday,
      investedFromDeposits,
      investedFromSales,
      nextDepositCash: depositCash + depositTopUp - investedFromDeposits,
      nextSaleCash: saleCash - investedFromSales,
      nextLastSaleReinvestment,
    };
  }

  #decideIncrementalSaleReinvestment({ saleCash, minInvestment, lastSaleReinvestment }) {
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
