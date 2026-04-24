export class FinancialMetrics {
    constructor(todayProvider) {
        this.todayProvider = todayProvider;
    }

    xirr(cashflows, guess = 0.1) {
        if (!Array.isArray(cashflows) || cashflows.length < 2) {
            throw new Error("At least two cash flows are needed.");
        }

        const flows = cashflows
            .map(flow => ({ amount: Number(flow.amount), date: new Date(flow.date) }))
            .sort((a, b) => a.date - b.date);

        if (flows.some(flow => isNaN(flow.amount) || isNaN(flow.date.getTime()))) {
            throw new Error("Invalid dates or amounts found.");
        }
        if (!flows.some(flow => flow.amount > 0)) {
            throw new Error("At least one positive flow is needed.");
        }
        if (!flows.some(flow => flow.amount < 0)) {
            throw new Error("At least one negative flow is needed.");
        }
        if (flows.some(flow => flow.amount === 0)) {
            throw new Error("No zero flows are allowed.");
        }

        const dayMs = 86400000;
        const firstDate = flows[0].date;
        const years = flows.map(flow => (flow.date - firstDate) / dayMs / 365.25);

        const npv = rate => {
            if (rate <= -1) {
                return Infinity;
            }

            return flows.reduce((sum, flow, index) => {
                return sum + flow.amount / Math.pow(1 + rate, years[index]);
            }, 0);
        };

        const derivativeNpv = rate => {
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
        for (let index = 0; index < 100; index += 1) {
            const value = npv(rate);
            const derivative = derivativeNpv(rate);

            if (Math.abs(value) < 1e-8) {
                return rate;
            }
            if (!isFinite(derivative) || derivative === 0) {
                break;
            }

            const newRate = rate - value / derivative;
            if (!isFinite(newRate) || newRate <= -0.999999999) {
                break;
            }
            if (Math.abs(newRate - rate) < 1e-8) {
                return newRate;
            }

            rate = newRate;
        }

        throw new Error("XIRR did not converge.");
    }

    avgWeightedAge(flows) {
        const parsedFlows = flows
            .map(flow => ({ amount: Number(flow.amount), date: new Date(flow.date) }))
            .sort((a, b) => a.date - b.date);

        if (parsedFlows.some(flow => isNaN(flow.amount) || isNaN(flow.date.getTime()))) {
            throw new Error("Invalid dates or amounts found.");
        }
        if (parsedFlows.some(flow => flow.amount <= 0)) {
            throw new Error("All flows must be positive.");
        }

        const dayMs = 86400000;
        const todayDate = new Date(this.todayProvider());
        const weightedSum = parsedFlows.reduce((acc, flow) => {
            return acc + ((todayDate - flow.date) / dayMs / 365.25) * flow.amount;
        }, 0);
        const amountSum = parsedFlows.reduce((acc, flow) => acc + flow.amount, 0);

        return weightedSum / amountSum;
    }
}
