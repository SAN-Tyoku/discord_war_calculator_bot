const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('../logger');

const MIN_YEAR = 862;
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * ゲーム内の現在年度を計算して返します。
 * @returns {number} 計算されたゲーム内年度。
 */
function getDefaultGameYear() {
    const BASE_REAL_DATE = new Date('2025-09-09T21:00:00+09:00');
    const BASE_GAME_YEAR = 1385;
    const now = new Date();
    
    const timeDifference = now.getTime() - BASE_REAL_DATE.getTime();
    const daysPassed = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    
    const yearsPassed = Math.floor(daysPassed / 2);
    
    return BASE_GAME_YEAR + yearsPassed - 1;
}

/**
 * WAR計算のサブコマンド（野手/投手）に応じた質問のリストを返します。
 * @param {'fielder' | 'pitcher'} subCommand - 計算対象のサブコマンド。
 * @returns {Array<{q: string, key: string}>} 質問の文言(`q`)とAPI用のキー(`key`)を持つオブジェクトの配列。
 */
function getQuestions(subCommand) {
    if (subCommand === 'fielder') {
        return [
            { q: "打席数を入力してください", key: 'plateAppearance' },
            { q: "打数を入力してください", key: 'atBat' },
            { q: "安打数を入力してください", key: 'hit' },
            { q: "二塁打数を入力してください", key: 'doubleHit' },
            { q: "三塁打数を入力してください", key: 'triple' },
            { q: "本塁打数を入力してください", key: 'homeRun' },
            { q: "四球を入力してください", key: 'walk' },
            { q: "死球を入力してください", key: 'hbp' },
            { q: "盗塁数を入力してください", key: 'steal' },
            { q: "盗塁死数を入力してください", key: 'caughtStealing' },
            { q: "好走塁を入力してください", key: 'goodBaseRunning' },
            { q: "併殺打数を入力してください", key: 'doublePlay' },
            { q: "失策数を入力してください", key: 'error' },
            { q: "好守備を入力してください", key: 'finePlay' },
            { q: "捕手: 盗塁刺数を入力してください (捕手以外は0)", key: 'catchStealing' },
            { q: "捕手: 許盗塁数を入力してください (捕手以外は0)", key: 'stolenBasesAllowed' },
            { q: "捕手としての出場試合数", key: 'cGame' },
            { q: "一塁手としての出場試合数", key: 'fbGame' },
            { q: "二塁手としての出場試合数", key: 'sbGame' },
            { q: "三塁手としての出場試合数", key: 'tbGame' },
            { q: "遊撃手としての出場試合数", key: 'ssGame' },
            { q: "左翼手としての出場試合数", key: 'lfGame' },
            { q: "中堅手としての出場試合数", key: 'cfGame' },
            { q: "右翼手としての出場試合数", key: 'rfGame' },
            { q: "指名打者としての出場試合数", key: 'dhGame' },
        ];
    } else if (subCommand === 'pitcher') {
        return [
            { q: "投球回を入力してください (例: 143回1/3 -> 143.333)", key: 'innings' },
            { q: "自責点を入力してください", key: 'earnedRuns' },
            { q: "被安打数を入力してください", key: 'hitsAllowed' },
            { q: "被本塁打数を入力してください", key: 'homeRunsAllowed' },
            { q: "与四球数を入力してください", key: 'walksAllowed' },
            { q: "与死球数を入力してください", key: 'hitBatsmen' },
            { q: "奪三振数を入力してください", key: 'strikeouts' },
            { q: "登板数を入力してください", key: 'appearances' },
            { q: "先発数を入力してください", key: 'starts' },
        ];
    }
    return [];
}

/**
 * 外部APIにリクエストを送信してWARを計算します。
 * @param {object} requestBody - APIに送信するリクエストボディ。
 * @returns {Promise<import('axios').AxiosResponse<any>>} axiosのレスポンスを返すPromise。
 */
async function calculateWarWithApi(requestBody) {
    const apiUrl = process.env.API_URL;
    if (!apiUrl) throw new Error("API_URLが設定されていません。");

    const separator = apiUrl.includes('?') ? '&' : '?';
    const fullUrl = `${apiUrl}${separator}endpoint=calculate`;

    const config = { headers: { 'Content-Type': 'application/json' } };
    if (process.env.BASIC_ID && process.env.BASIC_PASS) {
        config.auth = { username: process.env.BASIC_ID, password: process.env.BASIC_PASS };
    }

    return axios.post(fullUrl, requestBody, config);
}


function normalizeNumberString(str) {
    if (!str) return '0';
    return str
        .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        .replace(/,/g, '');
}

function parseInnings(str) {
  const normalized = normalizeNumberString(str);
  const parts = normalized.split('回');
  let total = parseFloat(parts[0]);
  
  if (isNaN(total)) return 0;

  if (parts[1]) {
    if (parts[1].includes('1/3')) total += (1/3);
    else if (parts[1].includes('2/3')) total += (2/3);
  }
  
  return total;
}


function parseStatsText(text, type) {
  logger.debug(`[Utils] Parsing stats text for type: ${type}. Input length: ${text.length}`);
  const lines = text.split(/\r\n|\r|\n/).map(line => line.trim()).filter(line => line);
  
  const result = {};
  
  const map = {
    fielder: {
      "試合": "totalGames",
      "打席": "plateAppearance", "打数": "atBat", "安打": "hit", "二塁打": "doubleHit",
      "三塁打": "triple", "本塁打": "homeRun", "四球": "walk", "死球": "hbp",
      "盗塁": "steal", "盗塁死": "caughtStealing", "併殺打": "doublePlay",
      "好走塁": "goodBaseRunning", "失策": "error", "好守備": "finePlay",
      "盗塁刺": "catchStealing", "許盗塁": "stolenBasesAllowed"
    },
    pitcher: {
      "投球回": "innings", "自責点": "earnedRuns", "被安打": "hitsAllowed",
      "被本塁打": "homeRunsAllowed", "与四球": "walksAllowed", "与死球": "hitBatsmen",
      "奪三振": "strikeouts", "試合": "appearances", "先発": "starts"
    }
  };

  const currentMap = map[type];
  if (!currentMap) return {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (currentMap[line]) {
      const apiKey = currentMap[line];
      const valueLine = lines[i + 1];

      if (valueLine) {
        if (apiKey === 'innings') {
          result[apiKey] = parseInnings(valueLine);
        } else {
          const normalizedValue = normalizeNumberString(valueLine);
          const num = parseFloat(normalizedValue);
          result[apiKey] = isNaN(num) ? 0 : num;
        }
      }
    }
  }

  logger.debug(`[Utils] Parsed result: ${JSON.stringify(result)}`);
  return result;
}

/**
 * APIサーバーのステータスを確認します。
 * 軽量な計算リクエストを送信して応答を確認します。
 * @returns {Promise<{status: 'ok'|'error', latency?: number, message?: string}>}
 */
async function checkApiStatus() {
    const requestBody = {
        calcType: 'fielder',
        year: MIN_YEAR,
        league: 'A',
        plateAppearance: 0, atBat: 0, hit: 0, doubleHit: 0, triple: 0, homeRun: 0,
        walk: 0, hbp: 0, steal: 0, caughtStealing: 0, goodBaseRunning: 0,
        doublePlay: 0, error: 0, finePlay: 0, catchStealing: 0, stolenBasesAllowed: 0,
        cGame: 0, fbGame: 0, sbGame: 0, tbGame: 0, ssGame: 0, lfGame: 0, cfGame: 0, rfGame: 0, dhGame: 0
    };

    const start = Date.now();
    try {
        await calculateWarWithApi(requestBody);
        const duration = Date.now() - start;
        return { status: 'ok', latency: duration };
    } catch (error) {
        logger.error(`[HealthCheck] API Error: ${error.message}`);
        return { status: 'error', message: '接続失敗' }; // URLを漏らさないために詳細を伏せる
    }
}

module.exports = {
    MIN_YEAR,
    getDefaultGameYear,
    getQuestions,
    calculateWarWithApi,
    checkApiStatus,
    parseStatsText,
    parseInnings,
};
