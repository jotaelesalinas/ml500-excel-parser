import { defaultTodayProvider } from "../config/constants.js";

export class WeightedAgeCalculator {
  constructor(todayProvider = defaultTodayProvider) {
    this.todayProvider = todayProvider;
  }

  calculate(flows) {
    const parsed = flows
      .map((flow) => ({
        amount: Number(flow.amount),
        date: new Date(flow.date),
      }))
      .sort((left, right) => left.date - right.date);

    if (parsed.some((flow) => Number.isNaN(flow.amount) || Number.isNaN(flow.date.getTime()))) {
      throw new Error("Invalid dates or amounts found.");
    }
    if (parsed.some((flow) => flow.amount <= 0)) {
      throw new Error("All flows must be positive.");
    }

    const dayMs = 86400000;
    const todayDate = new Date(this.todayProvider());
    const weightedAgeSum = parsed.reduce(
      (sum, flow) => sum + ((todayDate - flow.date) / dayMs / 365.25) * flow.amount,
      0,
    );
    const amountSum = parsed.reduce((sum, flow) => sum + flow.amount, 0);

    return weightedAgeSum / amountSum;
  }
}
