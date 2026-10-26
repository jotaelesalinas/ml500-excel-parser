import { SaleBlockLookbackParser } from "../src/core/SaleBlockLookbackParser.js";

describe("SaleBlockLookbackParser", () => {
  const parser = new SaleBlockLookbackParser();

  it("treats an empty field as disabled", () => {
    expect(parser.parse("")).toEqual([]);
    expect(parser.parse("   ")).toEqual([]);
    expect(parser.parse(null)).toEqual([]);
    expect(parser.parse(undefined)).toEqual([]);
  });

  it("parses positive whole numbers separated by commas", () => {
    expect(parser.parse("20,50,100")).toEqual([20, 50, 100]);
    expect(parser.parse(" 20 , 50 ")).toEqual([20, 50]);
    expect(parser.parse("5")).toEqual([5]);
  });

  it("rejects anything that is not a list of positive whole numbers", () => {
    const message =
      'Invalid "Block sales S&P 500 -D" value: "20,x". Use positive whole numbers separated by commas, for example "20,50,100".';

    expect(() => parser.parse("20,x")).toThrowError(message);
    expect(() => parser.parse("20,")).toThrowError();
    expect(() => parser.parse("0")).toThrowError();
    expect(() => parser.parse("-20")).toThrowError();
    expect(() => parser.parse("20.5")).toThrowError();
    expect(() => parser.parse("20 50")).toThrowError();
  });
});
