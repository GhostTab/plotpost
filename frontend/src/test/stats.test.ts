import { formatStats, validateCompose } from "@/lib/format";

describe("formatStats", () => {
  it("shows denominator form without rate when completed is 0", () => {
    expect(
      formatStats({
        successful: 0,
        unsuccessful: 0,
        pending: 3,
        completed: 0,
        success_rate: null,
      }),
    ).toBe("0 successful out of 0 completed");
  });

  it("includes percentage when completed > 0", () => {
    expect(
      formatStats({
        successful: 34,
        unsuccessful: 8,
        pending: 2,
        completed: 42,
        success_rate: 81.0,
      }),
    ).toBe("34 successful out of 42 completed (81%)");
  });
});

describe("validateCompose", () => {
  it("requires movie and rating", () => {
    expect(validateCompose({ movieId: null, hasRating: true })).toMatch(/movie/i);
    expect(validateCompose({ movieId: "m", hasRating: false })).toMatch(/rate/i);
    expect(validateCompose({ movieId: "m", hasRating: true })).toBeNull();
  });
});
