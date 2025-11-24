const fs = require('fs');
const path = require('path');

// 定数
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
    
    // 2日で1年進む
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

module.exports = {
    MIN_YEAR,
    getDefaultGameYear,
    getQuestions
};