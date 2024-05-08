import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

//Bypass cloudflare human checks
puppeteer.use(StealthPlugin());

import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { Browser, ElementHandle, Page } from "puppeteer";
import {
  declineCookies,
  getActiveMap,
  getMapStats,
  getMatchStatsAndSummary,
  isGameEnd,
  renderMapStats,
  renderMatchStats,
} from "./hltv-utils";
import { MapStats, MatchStats } from "./types";

const CONTAINERIZED_PARAMS = {
  executablePath: `/usr/bin/google-chrome-stable`,
  args: [
    `--no-sandbox`,
    `--headless`,
    `--disable-gpu`,
    `--disable-dev-shm-usage`,
  ],
};

interface GamesMap {
  [keys: string]: { promise: Promise<void>; shouldTerminate: boolean };
}

const gamesMap: GamesMap = {};

const token = process.env.TELEGRAM_BOT_TOKEN;
const localServer = process.env.LOCAL_SERVER;

(async () => {
  if (token === undefined) {
    throw new Error("TELEGRAM_BOT_TOKEN is not defined");
  }

  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/stop/, async (msg, _) => {
    const chatId = msg.chat.id;
    await terminateGame(chatId);
    await bot.sendMessage(chatId, "Game stopped.");
  });

  bot.onText(/\/watch (.+)/, async (msg, match) => {
    if (match === null) {
      return;
    }

    const chatId = msg.chat.id;
    const matchId = match[1];

    await terminateGame(chatId);

    gamesMap[chatId] = {
      promise: watchGame({ chatId, matchId: matchId, bot }),
      shouldTerminate: true,
    };
  });
})();

const terminateGame = async (chatId: number) => {
  const game = gamesMap[chatId];
  if (game === undefined) {
    return;
  }

  if (game.shouldTerminate) {
    console.log("Terminating game in chat", chatId);
    game.shouldTerminate = false;
    await game.promise;
    console.log("Game terminated in chat", chatId);
  }

  delete gamesMap[chatId];
};

const watchGame = async (params: {
  chatId: number;
  matchId: string;
  bot: TelegramBot;
}) => {
  const { chatId, matchId, bot } = params;

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    await bot.sendMessage(chatId, "Loading a new game...");

    const result = await setupBrowser();
    browser = result.browser;
    page = result.page;

    const { matchStats, matchSummary } = await getMatchStatsAndSummary(
      page,
      matchId
    );

    matchStats.maps = await getMapStats(page, matchSummary);
    const message = await bot.sendMessage(chatId, renderMatchStats(matchStats), {parse_mode: 'MarkdownV2'});

    await watchAndPublish({
      chatId,
      matchStats,
      page,
      matchSummary,
      bot,
      message,
    });
  } catch (e) {
    await bot.sendMessage(chatId, "Match not found.");
    console.log(e);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
};

const setupBrowser = async () => {
  const puppeteerParams = localServer
    ? { headless: true }
    : { headless: true, ...CONTAINERIZED_PARAMS };

  const browser = await puppeteer.launch(puppeteerParams);
  const page = await browser.newPage();
  await page.goto("https://www.hltv.org/matches");
  await new Promise((r) => setTimeout(r, 2000));

  await declineCookies(page);

  return { browser, page };
};

const watchAndPublish = async (params: {
  chatId: number;
  matchStats: MatchStats;
  page: Page;
  matchSummary: ElementHandle<Element>;
  bot: TelegramBot;
  message: TelegramBot.Message;
}) => {
  const { chatId, matchStats, page, matchSummary, bot, message } = params;

  let previousMapStats: MapStats[] = [];

  while (gamesMap[chatId]?.shouldTerminate) {
    matchStats.maps = await getMapStats(page, matchSummary);

    if (JSON.stringify(matchStats.maps) !== JSON.stringify(previousMapStats)) {
      previousMapStats = matchStats.maps;
      const currentMap = getActiveMap(matchStats.maps);
      if (currentMap) {
        await bot.editMessageText(
          renderFullMessageText(matchStats, currentMap),
          { message_id: message.message_id, chat_id: chatId, parse_mode: 'MarkdownV2' }
        );
      }
    }

    if (isGameEnd(matchStats)) {
      await bot.sendMessage(chatId, "Game ended.");
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
};

const renderFullMessageText = (matchStats: MatchStats, mapStats: MapStats) =>
  `${renderMatchStats(
    matchStats
  )}\n\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\n${renderMapStats(matchStats, mapStats)}`;

