export class WeeklyInvestmentPolicy {
  decide({
    buyCount,
    depositCash,
    saleCash,
    minDeposit,
    minInvestment,
    reinvest,
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
      };
    }

    const baseToBuy = minInvestment;
    const saleReinvestment = reinvest
      ? Math.floor(saleCash / minInvestment) * minInvestment
      : 0;
    const targetToBuy = baseToBuy + saleReinvestment;

    let depositTopUp = 0;
    while (depositCash + depositTopUp < baseToBuy) {
      depositTopUp += minDeposit;
    }

    const investedByPosition = Math.floor(targetToBuy / buyCount);
    const investedToday = investedByPosition * buyCount;
    const investedFromDeposits = Math.min(investedToday, baseToBuy);
    const investedFromSales = Math.min(
      Math.max(investedToday - investedFromDeposits, 0),
      saleReinvestment,
    );

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
    };
  }
}
