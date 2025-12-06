require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const readline = require('readline');
const { listGuilds } = require('./list_guilds');
const { broadcast } = require('./broadcast');
const { handleBlacklistCommand } = require('./blacklist');
const { analyzeLogs } = require('./analyze_logs');
const { closeDatabase } = require('../src/database');

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

async function mainMenu() {
    console.log('\n=== WAR Calculator Bot Admin Tool ===');
    console.log('1. サーバー一覧を表示 (List Guilds)');
    console.log('2. お知らせを一斉送信 (Broadcast)');
    console.log('3. ブラックリスト管理 (Blacklist)');
    console.log('4. ログ分析 (Analyze Logs)');
    console.log('q. 終了 (Quit)');
    
    const answer = await ask('\n選択してください: ');

    try {
        switch (answer.trim()) {
            case '1':
                await listGuilds(client);
                break;
            case '2':
                const msg = await ask('送信するメッセージを入力してください (キャンセルは空文字): ');
                if (msg.trim()) {
                    const confirm = await ask(`以下のメッセージを全サーバーに送信しますか？\n---\n${msg}\n---\n(y/n): `);
                    if (confirm.toLowerCase() === 'y') {
                        await broadcast(client, msg);
                    } else {
                        console.log('キャンセルしました。');
                    }
                }
                break;
            case '3':
                await blacklistMenu();
                break;
            case '4':
                await analyzeLogs();
                break;
            case 'q':
            case 'exit':
                console.log('終了します...');
                await closeDatabase();
                client.destroy();
                rl.close();
                process.exit(0);
                return;
            default:
                console.log('無効な選択です。');
        }
    } catch (error) {
        console.error('エラーが発生しました:', error);
    }
    
    mainMenu();
}

async function blacklistMenu() {
    console.log('\n--- Blacklist Management ---');
    console.log('1. 一覧を表示 (List)');
    console.log('2. 追加 (Add)');
    console.log('3. 削除 (Remove)');
    console.log('b. 戻る (Back)');

    const answer = await ask('選択してください: ');
    
    try {
        switch (answer.trim()) {
            case '1':
                await handleBlacklistCommand('list');
                break;
            case '2':
                const idToAdd = await ask('追加するID (User/Guild): ');
                if (!idToAdd) break;
                const type = await ask('タイプ (user/guild): ');
                if (!['user', 'guild'].includes(type.toLowerCase())) {
                    console.log('無効なタイプです。user または guild を指定してください。');
                    break;
                }
                const reason = await ask('理由 (任意): ');
                await handleBlacklistCommand('add', idToAdd, type, reason);
                break;
            case '3':
                const idToRemove = await ask('削除するID: ');
                if (!idToRemove) break;
                await handleBlacklistCommand('remove', idToRemove);
                break;
            case 'b':
                return;
            default:
                console.log('無効な選択です。');
        }
    } catch (error) {
        console.error('ブラックリスト操作エラー:', error);
    }
}

// Start
console.log('Botにログイン中...');
client.once('ready', () => {
    console.log(`ログイン完了: ${client.user.tag}`);
    mainMenu();
});

client.login(process.env.BOT_TOKEN).catch(err => {
    console.error('ログイン失敗:', err.message);
    process.exit(1);
});
