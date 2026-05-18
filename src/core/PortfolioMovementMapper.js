import { defaultTodayProvider } from "../config/constants.js";

export class PortfolioMovementMapper {
  constructor(todayProvider = defaultTodayProvider) {
    this.todayProvider = todayProvider;
    this.positionCounter = 0;
  }

  map(entry) {
    if (entry.ticker === "" || entry.nombre === "") {
      throw new Error(`Missing ticker or nombre: ${JSON.stringify(entry)}`);
    }

    if (entry.fechac === "" || entry.cantidad === "" || entry.precioc === "") {
      throw new Error(`Missing fechac, cantidad, or precioc: ${JSON.stringify(entry)}`);
    }

    const quantity = Number(entry.cantidad);
    const buyPrice = Number(entry.precioc.replace(/,/g, ""));
    const buyAmount = +(quantity * buyPrice).toFixed(2);
    const positionId = this.#nextPositionId();

    const buy = {
      action: "buy",
      date: entry.fechac,
      ticker: entry.ticker,
      qty: quantity,
      amount: buyAmount,
      positionId,
    };

    if (entry.fechav !== "" && entry.preciov !== "") {
      if (entry.precioa !== "") {
        throw new Error(`Unexpected precioa with fechav and preciov: ${JSON.stringify(entry)}`);
      }

      const sellPrice = Number(entry.preciov.replace(/,/g, ""));
      const sellAmount = +(quantity * sellPrice).toFixed(2);

      return [
        buy,
        {
          action: "sell",
          date: entry.fechav,
          ticker: entry.ticker,
          qty: quantity,
          amount: sellAmount,
          positionId,
        },
      ];
    }

    if (entry.precioa !== "") {
      if (entry.fechav !== "" || entry.preciov !== "") {
        throw new Error(`Unexpected fechav/preciov with precioa: ${JSON.stringify(entry)}`);
      }

      const currentPrice = Number(entry.precioa.replace(/,/g, ""));
      const currentAmount = +(quantity * currentPrice).toFixed(2);

      return [
        buy,
        {
          action: "valueToday",
          date: this.todayProvider(),
          ticker: entry.ticker,
          qty: quantity,
          amount: currentAmount,
          positionId,
        },
      ];
    }

    throw new Error(`Unexpected entry (no sell or current price): ${JSON.stringify(entry)}`);
  }

  #nextPositionId() {
    this.positionCounter += 1;
    return this.positionCounter;
  }
}
