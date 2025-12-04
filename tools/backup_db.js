const fs = require('fs');
const path = require('path');

// 設定
const DB_FILENAME = 'config.db';
const BACKUP_DIR = 'backups';
const MAX_BACKUPS = 7; // 保持するバックアップの最大数

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(ROOT_DIR, DB_FILENAME);
const DEST_DIR = path.join(ROOT_DIR, BACKUP_DIR);

function getTimestamp() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    // ファイル名として使いやすい形式: YYYY-MM-DD_HHmm
    return `${y}-${m}-${d}_${h}${min}`;
}

async function main() {
    console.log('--- データベースバックアップ ---');

    // 1. 元ファイルの存在確認
    if (!fs.existsSync(SOURCE_PATH)) {
        console.error(`エラー: データベースファイルが見つかりません: ${SOURCE_PATH}`);
        process.exit(1);
    }

    // 2. バックアップディレクトリの作成
    if (!fs.existsSync(DEST_DIR)) {
        console.log(`ディレクトリを作成します: ${DEST_DIR}`);
        fs.mkdirSync(DEST_DIR, { recursive: true });
    }

    // 3. バックアップの実行
    const backupFilename = `config_${getTimestamp()}.db`;
    const destPath = path.join(DEST_DIR, backupFilename);

    try {
        fs.copyFileSync(SOURCE_PATH, destPath);
        console.log(`バックアップ成功: ${backupFilename}`);
    } catch (error) {
        console.error('バックアップコピー中にエラーが発生しました:', error);
        process.exit(1);
    }

    // 4. ローテーション (古いバックアップの削除)
    try {
        const files = fs.readdirSync(DEST_DIR)
            .filter(file => file.startsWith('config_') && file.endsWith('.db'))
            .map(file => {
                const filePath = path.join(DEST_DIR, file);
                return {
                    name: file,
                    path: filePath,
                    time: fs.statSync(filePath).mtime.getTime()
                };
            })
            .sort((a, b) => b.time - a.time); // 新しい順にソート

        if (files.length > MAX_BACKUPS) {
            const filesToDelete = files.slice(MAX_BACKUPS);
            console.log(`\n古いバックアップを削除します (保持設定: ${MAX_BACKUPS}個)...`);
            
            filesToDelete.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`[削除] ${file.name}`);
            });
        } else {
            console.log(`\n現在のバックアップ数: ${files.length} (最大 ${MAX_BACKUPS}個まで保持)`);
        }

    } catch (error) {
        console.error('ローテーション処理中にエラーが発生しました:', error);
        // バックアップ自体は成功しているので警告として出す
    }

    console.log('\n完了しました。');
}

main();