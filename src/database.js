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

    instance.run(`CREATE TABLE IF NOT EXISTS global_blacklist (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL, -- 'user' or 'guild'
        reason TEXT,
        timestamp INTEGER
    )`, (err) => {
        if (err) {
            logger.error(`[Database] ブラックリストテーブルの作成に失敗しました: ${err.message}`);
        }
    });

    instance.run(`CREATE TABLE IF NOT EXISTS feedbacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        user_tag TEXT,
        guild_id TEXT NOT NULL,
        category TEXT,
        content TEXT NOT NULL,
        timestamp INTEGER
    )`, (err) => {
        if (err) {
            logger.error(`[Database] フィードバックテーブルの作成に失敗しました: ${err.message}`);
        }
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
                    if (/^\d+$/.test(row.value)) {
                        config[row.key] = row.value;
                    } else {
                        config[row.key] = JSON.parse(row.value);
                    }
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

// --- ブラックリスト関連 ---

/**
 * ブラックリストに追加します。
 * @param {string} id - ユーザーIDまたはサーバーID。
 * @param {'user'|'guild'} type - IDの種類。
 * @param {string} reason - 追加理由。
 * @returns {Promise<void>}
 */
async function addToBlacklist(id, type, reason = '') {
    await dbReady;
    return new Promise((resolve, reject) => {
        db.run("REPLACE INTO global_blacklist (id, type, reason, timestamp) VALUES (?, ?, ?, ?)",
            [id, type, reason, Date.now()], (err) => {
                if (err) {
                    logger.error(`[Database] ブラックリストへの追加失敗: ${err.message}`);
                    return reject(err);
                }
                logger.info(`[Database] ブラックリストに追加: ${id} (${type})`);
                resolve();
            });
    });
}

/**
 * ブラックリストから削除します。
 * @param {string} id - 削除するID。
 * @returns {Promise<void>}
 */
async function removeFromBlacklist(id) {
    await dbReady;
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM global_blacklist WHERE id = ?", [id], (err) => {
            if (err) {
                logger.error(`[Database] ブラックリスト削除失敗: ${err.message}`);
                return reject(err);
            }
            logger.info(`[Database] ブラックリストから削除: ${id}`);
            resolve();
        });
    });
}

/**
 * IDがブラックリストに含まれているか確認します。
 * @param {string} id - 確認するID。
 * @returns {Promise<boolean>} 含まれている場合はtrue。
 */
async function isBlacklisted(id) {
    await dbReady;
    return new Promise((resolve, reject) => {
        db.get("SELECT 1 FROM global_blacklist WHERE id = ?", [id], (err, row) => {
            if (err) return reject(err);
            resolve(!!row);
        });
    });
}

/**
 * ブラックリストの一覧を取得します。
 * @returns {Promise<Array>}
 */
async function getBlacklist() {
    await dbReady;
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM global_blacklist", (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

/**
 * フィードバックをデータベースに追加します。
 * @param {string} userId - 送信者のID
 * @param {string} userTag - 送信者のタグ
 * @param {string} guildId - サーバーID
 * @param {string} category - カテゴリ
 * @param {string} content - 内容
 * @returns {Promise<void>}
 */
async function addFeedback(userId, userTag, guildId, category, content) {
    await dbReady;
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO feedbacks (user_id, user_tag, guild_id, category, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            [userId, userTag, guildId, category, content, Date.now()],
            (err) => {
                if (err) {
                    logger.error(`[Database] フィードバック保存失敗: ${err.message}`);
                    return reject(err);
                }
                logger.info(`[Database] 新しいフィードバック: ${userTag} (${category})`);
                resolve();
            });
    });
}

/**
 * 最新のフィードバックを取得します。
 * @param {number} limit - 取得件数
 * @returns {Promise<Array>}
 */
async function getFeedbacks(limit = 10) {
    await dbReady;
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM feedbacks ORDER BY timestamp DESC LIMIT ?", [limit], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
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
    addToBlacklist,
    removeFromBlacklist,
    isBlacklisted,
    getBlacklist,
    addFeedback,
    getFeedbacks,
    closeDatabase,
};