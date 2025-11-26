const sqlite3 = require('sqlite3');
const path = require('path');
const logger = require('../logger');

let db;

const dbReady = new Promise((resolve, reject) => {
    const DB_PATH = process.env.NODE_ENV === 'test'
        ? ':memory:'
        : path.resolve(__dirname, '..', 'config.db');

    const instance = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            logger.error(`[Database] データベース接続に失敗しました: ${err.message}`);
            return reject(err);
        }
        if (process.env.NODE_ENV !== 'test') {
            logger.info('[Database] データベースに正常に接続しました。');
        }
    });

    instance.run(`CREATE TABLE IF NOT EXISTS guild_configs (
        guild_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        PRIMARY KEY (guild_id, key)
    )`, (err) => {
        if (err) {
            logger.error(`[Database] テーブルの作成に失敗しました: ${err.message}`);
            return reject(err);
        }
        if (process.env.NODE_ENV !== 'test') {
            logger.info('[Database] テーブルの準備が完了しました。');
        }
        db = instance;
        resolve(db);
    });
});


/**
 * 指定されたサーバー(Guild)のすべての設定を取得します。
 * @param {string} guildId - サーバーID。
 * @returns {Promise<object>} サーバー設定のキーと値のペアを持つオブジェクト。
 */
async function getGuildConfig(guildId) {
    await dbReady;
    return new Promise((resolve, reject) => {
        db.all("SELECT key, value FROM guild_configs WHERE guild_id = ?", [guildId], (err, rows) => {
            if (err) {
                logger.error(`[Database] 設定の取得に失敗 (Guild: ${guildId}): ${err.message}`);
                return reject(err);
            }
            const config = {};
            rows.forEach(row => {
                try {
                    config[row.key] = JSON.parse(row.value);
                } catch (e) {
                    config[row.key] = row.value;
                }
            });
            resolve(config);
        });
    });
}

/**
 * 指定されたサーバー(Guild)の設定を更新または挿入します。
 * @param {string} guildId - サーバーID。
 * @param {string} key - 更新する設定のキー。
 * @param {any} value - 設定する値。`null` を渡すとそのキーが削除されます。
 * @returns {Promise<void>}
 */
async function updateGuildConfig(guildId, key, value) {
    await dbReady;
    return new Promise((resolve, reject) => {
        if (value === null || value === undefined) {
            db.run("DELETE FROM guild_configs WHERE guild_id = ? AND key = ?", [guildId, key], function(err) {
                if (err) {
                    logger.error(`[Database] 設定の削除に失敗 (Guild: ${guildId}, Key: ${key}): ${err.message}`);
                    return reject(err);
                }
                if (process.env.NODE_ENV !== 'test') {
                    logger.info(`[Database] 設定を削除しました (Guild: ${guildId}, Key: ${key})`);
                }
                resolve();
            });
        } else {
            const valueToStore = typeof value === 'object' ? JSON.stringify(value) : value;
            
            const stmt = "REPLACE INTO guild_configs (guild_id, key, value) VALUES (?, ?, ?)";
            db.run(stmt, [guildId, key, valueToStore], function(err) {
                if (err) {
                    logger.error(`[Database] 設定の更新に失敗 (Guild: ${guildId}, Key: ${key}): ${err.message}`);
                    return reject(err);
                }
                if (process.env.NODE_ENV !== 'test') {
                    logger.info(`[Database] 設定を更新しました (Guild: ${guildId}, Key: ${key})`);
                }
                resolve();
            });
        }
    });
}

/**
 * (テスト用) データベース接続を閉じます。
 * @returns {Promise<void>}
 */
async function closeDatabase() {
    await dbReady;
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

module.exports = {
    dbReady,
    getGuildConfig,
    updateGuildConfig,
    closeDatabase,
};