const sqlite3 = require('sqlite3');
const path = require('path');

// コマンドライン引数の処理
const args = process.argv.slice(2);
const showAll = args.includes('--all');
const limit = showAll ? -1 : 20; // -1 means no limit

// データベースへのパス (Bot本体と同じ config.db を参照)
const DB_PATH = path.resolve(__dirname, '..', 'config.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error(`Error opening database: ${err.message}`);
        process.exit(1);
    }
});

const sql = `
    SELECT * FROM feedbacks 
    ORDER BY timestamp DESC 
    LIMIT ?
`;

db.all(sql, [limit], (err, rows) => {
    if (err) {
        console.error(`Error querying database: ${err.message}`);
        db.close();
        process.exit(1);
    }

    if (rows.length === 0) {
        console.log('No feedbacks found.');
    } else {
        console.log(`
--- Feedback List (${showAll ? 'All' : 'Latest 20'}) ---
`);
        rows.forEach(row => {
            const date = new Date(row.timestamp).toLocaleString('ja-JP');
            console.log(`[ID: ${row.id}] ${date}`);
            console.log(`User: ${row.user_tag} (${row.user_id})`);
            console.log(`Guild: ${row.guild_id}`);
            console.log(`Category: ${row.category}`);
            console.log(`Content:
${row.content}`);
            console.log('-'.repeat(40));
        });
        console.log(`
Total displayed: ${rows.length}`);
    }

    db.close();
});
