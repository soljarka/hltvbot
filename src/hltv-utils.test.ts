import { isGameEnd } from "./hltv-utils";

describe("isGameEnd", () => {
  it("returns true if winning condition is met: bo3, overtime", () => {
    const matchStats = {
      bestOf: 3,
      leftTeam: "left",
      rightTeam: "right",
      maps: [
        { mapName: "map1", leftTeamScore: 13, rightTeamScore: 10 },
        { mapName: "map2", leftTeamScore: 22, rightTeamScore: 20 },
        { mapName: "map3", leftTeamScore: null, rightTeamScore: null },
      ],
    };
    expect(isGameEnd(matchStats)).toBe(true);
  });

  it("returns true if winning condition is met: bo1", () => {
    const matchStats = {
      bestOf: 1,
      leftTeam: "left",
      rightTeam: "right",
      maps: [{ mapName: "map1", leftTeamScore: 13, rightTeamScore: 10 }],
    };
    expect(isGameEnd(matchStats)).toBe(true);
  });

  it("returns false if winning condition is not met: bo1, overtime", () => {
    const matchStats = {
      bestOf: 1,
      leftTeam: "left",
      rightTeam: "right",
      maps: [{ mapName: "map1", leftTeamScore: 13, rightTeamScore: 12 }],
    };
    expect(isGameEnd(matchStats)).toBe(false);
  });

  it("returns false if winning condition is not met: bo3, overtime", () => {
    const matchStats = {
      bestOf: 3,
      leftTeam: "left",
      rightTeam: "right",
      maps: [
        { mapName: "map1", leftTeamScore: 13, rightTeamScore: 10 },
        { mapName: "map2", leftTeamScore: 10, rightTeamScore: 22 },
        { mapName: "map3", leftTeamScore: null, rightTeamScore: null },
      ],
    };
    expect(isGameEnd(matchStats)).toBe(false);
  });
});
