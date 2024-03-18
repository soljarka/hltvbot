import parse, { HTMLElement } from "node-html-parser";
import { ElementHandle, Page } from "puppeteer";
import { MapStats, MatchStats } from "./types";

export const getMatchStatsAndSummary = async (
  page: Page,
  matchId: string
): Promise<{
  matchSummary: ElementHandle<Element>;
  matchStats: MatchStats;
}> => {
  try {
    const match = await page.waitForSelector(
      `div[data-scorebot-id="${matchId}"]`,
      {
        timeout: 10000,
      }
    );

    if (!match) {
      throw new Error("Match container not found.");
    }

    const html = await page.evaluate((el) => el?.innerHTML, match);
    if (!html) {
      throw new Error("Could not parse match container.");
    }

    const matchHtmlElement = parse(html);
    const teams = matchHtmlElement.querySelectorAll(".matchTeam");

    const matchStats: MatchStats = {
      leftTeam:
        teams[0].querySelector(".matchTeamName")?.textContent.trim() ?? "",
      rightTeam:
        teams[1].querySelector(".matchTeamName")?.textContent.trim() ?? "",
      bestOf: Number.parseInt(
        matchHtmlElement
          .querySelector(".matchMeta")
          ?.textContent.substring(2) ?? ""
      ),
      maps: [],
    };

    const button = await match.waitForSelector(".expand-match-btn", {
      timeout: 5000,
    });
    if (!button) {
      throw new Error("Expand button not found.");
    }

    await button.click();

    await new Promise((r) => setTimeout(r, 1000));

    const scorebotContainer = await match.waitForSelector(
      `#matchScorebotId${matchId}`,
      {
        timeout: 10000,
      }
    );

    if (!scorebotContainer) {
      throw new Error("Scorebot container not found.");
    }

    const matchSummary = await scorebotContainer.waitForSelector(
      ".summary-container",
      {
        timeout: 10000,
      }
    );

    if (!matchSummary) {
      throw new Error("Match summary not found.");
    }

    return { matchSummary, matchStats };
  } catch (e) {
    throw new Error("Match not found: " + (e as Error).message);
  }
};

export const getMapStats = async (
  page: Page,
  matchSummary: ElementHandle<Element>
): Promise<MapStats[]> => {
  try {
    const html = await page.evaluate((el) => el?.innerHTML, matchSummary);
    if (!html) {
      throw new Error("Couldn't parse match summary.");
    }

    const root = parse(html);
    const maps = root.querySelectorAll(".map-row");
    return maps.map((x) => getMapStat(x));
  } catch (e) {
    throw new Error("Match stats could not be loaded.");
  }
};

const getMapStat = (element: HTMLElement): MapStats => {
  const scores = element.querySelectorAll(".team-points");

  return {
    mapName: trimLive(
      element.querySelector(".map-name")?.textContent.trim() ?? ""
    ),
    leftTeamScore: parseTeamScore(scores[0]?.textContent.trim()),
    rightTeamScore: parseTeamScore(scores[1]?.textContent.trim()),
  };
};

const trimLive = (text: string): string => {
  if (text.includes("LIVE")) {
    return text.substring(0, text.indexOf("LIVE")).trim();
  }
  return text;
};

const parseTeamScore = (score: string): number | null => {
  const parsed = Number.parseInt(score);
  if (isNaN(parsed)) {
    return null;
  }
  return parsed;
};

export const getMatchScore = (
  matchStats: MatchStats
): { leftTeamScore: number; rightTeamScore: number } => {
  let leftTeamScore = 0;
  let rightTeamScore = 0;
  matchStats.maps.forEach((map) => {
    if (map.leftTeamScore === null || map.rightTeamScore === null) {
      return;
    }

    if (isWinScore(map.leftTeamScore, map.rightTeamScore)) {
      leftTeamScore++;
      return;
    }

    if (isWinScore(map.rightTeamScore, map.leftTeamScore)) {
      rightTeamScore++;
    }
  });
  return { leftTeamScore, rightTeamScore };
};

export const isGameEnd = (matchStats: MatchStats): boolean => {
  const { leftTeamScore, rightTeamScore } = getMatchScore(matchStats);
  if (leftTeamScore === Math.floor(matchStats.bestOf / 2) + 1) {
    return true;
  }

  if (rightTeamScore === Math.floor(matchStats.bestOf / 2) + 1) {
    return true;
  }

  return false;
};

export const getActiveMap = (mapStatsList: MapStats[]): MapStats | null => {
  for (let i = mapStatsList.length - 1; i >= 0; i--) {
    if (
      mapStatsList[i].leftTeamScore !== null &&
      mapStatsList[i].rightTeamScore !== null
    ) {
      return mapStatsList[i];
    }
  }
  return null;
};

const isWinScore = (score: number, otherScore: number) => {
  if (isNaN(score)) {
    return false;
  }

  if (score < 13) {
    return false;
  }

  if (score - otherScore < 2) {
    return false;
  }

  const overtime = score - 13;

  if (overtime === 0) {
    return true;
  }

  return overtime % 3 === 0;
};

export const renderMatchStats = (matchStats: MatchStats): string => {
  const { leftTeamScore, rightTeamScore } = getMatchScore(matchStats);
  return `Match: ${matchStats.leftTeam} ${leftTeamScore}:${rightTeamScore} ${
    matchStats.rightTeam
  }\nFormat: best of ${matchStats.bestOf}\nMaps: ${matchStats.maps
    .map((x) => x.mapName)
    .join(", ")}`;
};

export const renderMapStats = (
  matchStats: MatchStats,
  mapStats: MapStats
): string => {
  return `${mapStats.mapName}: ${matchStats.leftTeam} ${mapStats.leftTeamScore}:${mapStats.rightTeamScore} ${matchStats.rightTeam}`;
};

export const declineCookies = async (page: Page) => {
  try {
    const cookieButton = await page.waitForSelector(
      "#CybotCookiebotDialogBodyButtonDecline",
      { timeout: 10000 }
    );
    if (cookieButton) {
      await cookieButton.click();
    }
    await new Promise((r) => setTimeout(r, 1000));
  } catch (e) {
    console.log("Cookie decline button not found");
  }
};
