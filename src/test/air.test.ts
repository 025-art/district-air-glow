import { describe, it, expect } from "vitest";
import { maskGrade, pushRecent, relativeLabel, parseNum } from "@/lib/air";

describe("air rules", () => {
  it("mask uses worse of PM10/PM2.5", () => {
    expect(maskGrade({ pm10: 20, pm25: 50, pm10Grade: null, pm25Grade: null })).toBe(3);
  });
  it("mask uses only the received value when one is missing", () => {
    expect(maskGrade({ pm10: 100, pm25: null, pm10Grade: null, pm25Grade: null })).toBe(3);
    expect(maskGrade({ pm10: null, pm25: null, pm10Grade: null, pm25Grade: null })).toBeNull();
  });
  it("recent list keeps max 3, LRU, no duplicates", () => {
    expect(pushRecent(["a", "b", "c"], "d")).toEqual(["d", "a", "b"]);
    expect(pushRecent(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });
  it("relative label", () => {
    expect(relativeLabel(0, 59_000)).toBe("방금 전 갱신");
    expect(relativeLabel(0, 180_000)).toBe("3분 전 갱신");
  });
  it("treats '-' and '' as missing", () => {
    expect(parseNum("-")).toBeNull();
    expect(parseNum("")).toBeNull();
    expect(parseNum("0.03")).toBe(0.03);
  });
});
