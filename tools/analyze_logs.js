const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LOG_DIR = path.resolve(__dirname, '..', 'logs');

async function analyzeLogFile(filePath) {
    if (!fs.existsSync(filePath)) return null;

    const stats = {
        lines: 0,
        errors: 0,
        warnings: 0,
        starts: 0, // Bot starts (Loader logs)
        dbOps: 0,  // Database operations
        apiErrors: 0, // API related errors
        usage: {
            executed: { // Command Executions (Attempted)
                users: {}, // { userId: count }
                guilds: {}, // { guildId: count }
                total: 0
            }
        },
        firstLog: null,
        lastLog: null
    };

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        stats.lines++;
        
        // Extract timestamp (Assuming format: YYYY-MM-DD HH:mm:ss [LEVEL]: message)
        const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
        if (timestampMatch) {
            if (!stats.firstLog) stats.firstLog = timestampMatch[1];
            stats.lastLog = timestampMatch[1];
        }

        const lowerLine = line.toLowerCase();

        if (lowerLine.includes('[error]')) stats.errors++;
        if (lowerLine.includes('[warn]')) stats.warnings++;
        
        // Detection heuristics
        if (line.includes('[Loader]')) stats.starts++;
        if (line.includes('[Database]')) stats.dbOps++;
        if (line.includes('APIエラー')) stats.apiErrors++;

        // Command Executions (Attempted)
        // Format: [Command] User <name> (<id>) in <guild> (<id>) executed command: ...
        if (line.includes('[Command]')) {
            const userMatch = line.match(/User .+? \((\d+)\)/);
            let guildId = 'DM';
            if (line.includes(' in ')) {
                const guildMatch = line.match(/ in .+? \((\d+)\)/);
                if (guildMatch) {
                    guildId = guildMatch[1];
                } else if (line.includes(' in DM')) {
                    guildId = 'DM';
                }
            }

            if (userMatch) {
                const userId = userMatch[1];
                stats.usage.executed.users[userId] = (stats.usage.executed.users[userId] || 0) + 1;
                stats.usage.executed.guilds[guildId] = (stats.usage.executed.guilds[guildId] || 0) + 1;
                stats.usage.executed.total++;
            }
        }
    }

    return stats;
}

async function analyzeLogs() {
    console.log('--- ログ分析ツール ---\n');
    
    if (!fs.existsSync(LOG_DIR)) {
        console.error(`ログディレクトリが見つかりません: ${LOG_DIR}`);
        return;
    }

    const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log'));
    
    if (files.length === 0) {
        console.log('ログファイルが見つかりませんでした。');
        return;
    }

    let grandTotalErrors = 0;
    let grandTotalApiErrors = 0;
    
    // Aggregated usage stats
    const aggregated = {
        executed: { users: {}, guilds: {}, total: 0 }
    };

    for (const file of files) {
        const filePath = path.join(LOG_DIR, file);
        console.log(`${file} を分析中...`);
        
        const stats = await analyzeLogFile(filePath);
        if (!stats) continue;

        console.log(`  期間:     ${stats.firstLog || 'N/A'} から ${stats.lastLog || 'N/A'}`);
        console.log(`  行数:     ${stats.lines}`);
        console.log(`  起動数:   ${stats.starts > 0 ? Math.ceil(stats.starts / 5) : 0} (およそ再起動回数)`);
        console.log(`  エラー数: ${stats.errors}`);
        console.log(`  APIエラー: ${stats.apiErrors}`);
        
        // Aggregate executed stats
        aggregated.executed.total += stats.usage.executed.total;

        for (const [id, count] of Object.entries(stats.usage.executed.users)) {
            aggregated.executed.users[id] = (aggregated.executed.users[id] || 0) + count;
        }
        for (const [id, count] of Object.entries(stats.usage.executed.guilds)) {
            aggregated.executed.guilds[id] = (aggregated.executed.guilds[id] || 0) + count;
        }

        console.log(`  コマンド実行: ${stats.usage.executed.total} 回`);
        console.log('');

        grandTotalErrors += stats.errors;
        grandTotalApiErrors += stats.apiErrors;
    }

    console.log('--- サマリー ---');
    console.log(`合計ログファイル数: ${files.length}`);
    console.log(`総エラー数:         ${grandTotalErrors}`);
    console.log(`総API障害数:        ${grandTotalApiErrors}`);
    console.log(`総コマンド実行回数: ${aggregated.executed.total}`);
    
    // --- Rankings Helper ---
    const printRanking = (title, dataObj, type = 'User') => {
        console.log(`\n--- ${title} (Top 10) ---
`);
        const sorted = Object.entries(dataObj)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);
            
        if (sorted.length === 0) {
            console.log('(データなし)');
        } else {
            sorted.forEach(([id, count], index) => {
                let label = id;
                if (type === 'Guild') {
                    label = id === 'DM' ? 'DM (Direct Message)' : `Guild ID: ${id}`;
                    label = label.padEnd(25);
                } else {
                    label = `User ID: ${id.padEnd(20)}`;
                }
                console.log(`${index + 1}. ${label} | ${count} 回`);
            });
        }
    };

    // Print Rankings
    printRanking('ユーザー別 コマンド実行数', aggregated.executed.users, 'User');
    printRanking('サーバー別 コマンド実行数', aggregated.executed.guilds, 'Guild');
}

if (require.main === module) {
    analyzeLogs();
}

module.exports = { analyzeLogs };
