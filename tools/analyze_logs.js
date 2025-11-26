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
    }

    return stats;
}

async function main() {
    console.log('--- ログ分析ツール ---\n');
    
    if (!fs.existsSync(LOG_DIR)) {
        console.error(`ログディレクトリが見つかりません: ${LOG_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log'));
    
    if (files.length === 0) {
        console.log('ログファイルが見つかりませんでした。');
        process.exit(0);
    }

    let grandTotalErrors = 0;
    let grandTotalApiErrors = 0;

    for (const file of files) {
        const filePath = path.join(LOG_DIR, file);
        console.log(`${file} を分析中...`);
        
        const stats = await analyzeLogFile(filePath);
        if (!stats) continue;

        console.log(`  期間:     ${stats.firstLog || 'N/A'} から ${stats.lastLog || 'N/A'}`);
        console.log(`  行数:     ${stats.lines}`);
        console.log(`  起動数:   ${stats.starts > 0 ? Math.ceil(stats.starts / 5) : 0} (およそ再起動回数)`); // Assuming ~5 commands loaded per start
        console.log(`  DB操作:   ${stats.dbOps}`);
        console.log(`  エラー数: ${stats.errors}`);
        if (stats.apiErrors > 0) {
            console.log(`  APIエラー: ${stats.apiErrors} (エラー数に含む)`);
        }
        console.log('');

        grandTotalErrors += stats.errors;
        grandTotalApiErrors += stats.apiErrors;
    }

    console.log('--- サマリー ---');
    console.log(`合計ログファイル数: ${files.length}`);
    console.log(`総エラー数:         ${grandTotalErrors}`);
    console.log(`総API障害数:        ${grandTotalApiErrors}`);
}

main();
