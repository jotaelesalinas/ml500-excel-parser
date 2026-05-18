export class XirrCalculator {
  calculate(cashflows, guess = 0.1) {
    if (!Array.isArray(cashflows) || cashflows.length < 2) {
      throw new Error("At least two cash flows are needed.");
    }

    const flows = cashflows
      .map((cashflow) => ({
        amount: Number(cashflow.amount),
        date: new Date(cashflow.date),
      }))
      .sort((left, right) => left.date - right.date);

    if (flows.some((flow) => Number.isNaN(flow.amount) || Number.isNaN(flow.date.getTime()))) {
      throw new Error("Invalid dates or amounts found.");
    }
    if (!flows.some((flow) => flow.amount > 0)) {
      throw new Error("At least one positive flow is needed.");
    }
    if (!flows.some((flow) => flow.amount < 0)) {
      throw new Error("At least one negative flow is needed.");
    }
    if (flows.some((flow) => flow.amount === 0)) {
      throw new Error("No zero flows are allowed.");
    }

    const dayMs = 86400000;
    const firstDate = flows[0].date;
    const years = flows.map((flow) => (flow.date - firstDate) / dayMs / 365.25);

    const npv = (rate) => {
      if (rate <= -1) {
        return Infinity;
      }
      return flows.reduce((sum, flow, index) => sum + flow.amount / Math.pow(1 + rate, years[index]), 0);
    };

    const dNpv = (rate) => {
      if (rate <= -1) {
        return Infinity;
      }
      return flows.reduce((sum, flow, index) => {
        if (years[index] === 0) {
          return sum;
        }
        return sum - (years[index] * flow.amount) / Math.pow(1 + rate, years[index] + 1);
      }, 0);
    };

    let rate = guess;
    for (let i = 0; i < 100; i += 1) {
      const value = npv(rate);
      const derivative = dNpv(rate);

      if (Math.abs(value) < 1e-8) {
        return rate;
      }
      if (!Number.isFinite(derivative) || derivative === 0) {
        break;
      }

      const newRate = rate - value / derivative;
      if (!Number.isFinite(newRate) || newRate <= -0.999999999) {
        break;
      }
      if (Math.abs(newRate - rate) < 1e-8) {
        return newRate;
      }

      rate = newRate;
    }

    throw new Error("XIRR did not converge.");
  }
}
