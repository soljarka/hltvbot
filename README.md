# hltvbot
Telegram bot that posts HLTV match results to your chat.

## Setup
Set up your Telegram bot token. Copy `.env-template` to `.env` and add your token there or export as an environment variable:
```
export TELEGRAM_BOT_TOKEN=[token]
```
Run locally (requires Node.js v20):
```
npm i
npm start
```
Run in Docker:
```
docker-compose up
```

## Usage
- `/watch [match id]`: start watching a live HLTV match.
- `/stop`: stop watching.