import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

//Bypass cloudflare human checks
puppeteer.use(StealthPlugin());

import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { Browser, Page } from "puppeteer";
import { getMapStats, isGameEnd } from "./hltv-utils";

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

(async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const localServer = process.env.LOCAL_SERVER;

  if (token === undefined) {
    throw new Error("TELEGRAM_BOT_TOKEN is not defined");
  }

  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/stop/, async (msg, _) => {
    const chatId = msg.chat.id;
    await terminateGame(chatId);
    bot.sendMessage(chatId, "Game stopped.");
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
      bot.sendMessage(chatId, "Loading a new game...");

      const puppeteerParams = localServer
        ? { headless: true }
        : { headless: true, ...CONTAINERIZED_PARAMS };

      //Launch browser
      browser = await puppeteer.launch(puppeteerParams);
      page = await browser.newPage();
      await page.goto("https://www.hltv.org/matches");
      await new Promise((r) => setTimeout(r, 2000));

      //Decline cookies
      try {
        const cookieButton = await page.waitForSelector(
          ".CybotCookiebotDialogBodyButtonDecline",
          { timeout: 2000 }
        );
        if (cookieButton) await cookieButton.click();
      } catch (e) {}

      let mapStats = null;

      //Watch game
      while (gamesMap[chatId]?.shouldTerminate) {
        const newMapStats = await getMapStats(page, matchId);

        if (JSON.stringify(newMapStats) !== JSON.stringify(mapStats)) {
          mapStats = newMapStats;
          const text = `${mapStats.leftTeam.name} ${mapStats.leftTeam.score}:${mapStats.rightTeam.score} ${mapStats.rightTeam.name}`;
          bot.sendMessage(chatId, text);
        }

        if (mapStats && isGameEnd(mapStats)) {
          bot.sendMessage(chatId, "Game ended.");
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      bot.sendMessage(chatId, "Match not found.");
      console.log(e);
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  };
})();
