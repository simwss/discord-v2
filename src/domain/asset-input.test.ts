import { describe, expect, it } from "vitest";
import { parseAssetInput } from "./asset-input.js";

describe("parseAssetInput", () => {
  it("recognises an ISIN", () => {
    expect(parseAssetInput(" us0378331005 ")).toEqual({
      type: "isin",
      isin: "US0378331005",
    });
  });

  it("recognises a crypto pair", () => {
    expect(parseAssetInput("btc-usd")).toEqual({
      type: "crypto",
      symbol: "BTC-USD",
    });
  });

  it("treats anything else short as a ticker", () => {
    expect(parseAssetInput("aapl")).toEqual({
      type: "ticker",
      symbol: "AAPL",
    });
    expect(parseAssetInput("BRK.B")).toEqual({
      type: "ticker",
      symbol: "BRK.B",
    });
  });

  it("rejects text that cannot be an asset", () => {
    expect(parseAssetInput("")).toBeNull();
    expect(parseAssetInput("apple inc")).toBeNull();
    expect(parseAssetInput("https://example.com")).toBeNull();
  });
});
