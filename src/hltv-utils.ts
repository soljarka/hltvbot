import parse, { HTMLElement } from "node-html-parser";
import { ElementHandle, Page } from "puppeteer";

export interface MapStats {
  leftTeam: { name: string; score: string };
  rightTeam: { name: string; score: string };
}

export const getMapStats = async (
  page: Page,
  matchId: string
): Promise<MapStats> => {
  let match: ElementHandle<HTMLDivElement> | null;

  try {
    match = await page.waitForSelector(
      `div[data-livescore-match="${matchId}"]`,
      { timeout: 10000 }
    );
  } catch (e) {
    throw new Error("Match not found");
  }

  const html = await page.evaluate((el) => el?.innerHTML, match);
  if (!html) {
    throw new Error("Match not found");
  }

  const root = parse(html);
  const teams = root.querySelectorAll(".matchTeam");
  return {
    leftTeam: getTeamStats(teams[0]),
    rightTeam: getTeamStats(teams[1]),
  };
};

const getTeamStats = (
  element: HTMLElement
): { name: string; score: string } => {
  const name = element.querySelector(".matchTeamName")?.textContent.trim();
  const score = element.querySelector(".currentMapScore")?.textContent.trim();
  if (!name || !score) {
    throw new Error("Team stats not found.");
  }
  return { name, score };
};

export const isGameEnd = (mapStats: MapStats): boolean => {
  return (
    mapStats.leftTeam.score !== mapStats.rightTeam.score &&
    (isWinScore(Number.parseInt(mapStats.leftTeam.score)) ||
      isWinScore(Number.parseInt(mapStats.rightTeam.score)))
  );
};

const isWinScore = (score: number) => {
  if (isNaN(score)) {
    return false;
  }

  if (score < 13) {
    return false;
  }

  const overtime = score - 13;

  if (overtime === 0) {
    return true;
  }

  return overtime % 4 === 0;
};
