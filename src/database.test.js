// JSDocの型チェックを有効にする
/** @type {import('jest').Config} */

// NODE_ENVを'test'に設定
process.env.NODE_ENV = 'test';

const { dbReady, getGuildConfig, updateGuildConfig, closeDatabase } = require('./database');

describe('database.js', () => {
    let db;

    // テスト開始前に、データベースの初期化が完了するのを待つ
    beforeAll(async () => {
        db = await dbReady;
    });

    // 各テストの実行前にテーブルをクリーンアップ
    beforeEach(async () => {
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM guild_configs', (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    });

    // 全テスト終了後にデータベース接続を閉じる
    afterAll(async () => {
        await closeDatabase();
    });

    const GUILD_ID = 'test-guild-123';

    it('should save and retrieve a string value', async () => {
        const key = 'prefix';
        const value = '!';
        
        await updateGuildConfig(GUILD_ID, key, value);
        const config = await getGuildConfig(GUILD_ID);

        expect(config).toEqual({ [key]: value });
    });

    it('should save and retrieve an array value', async () => {
        const key = 'allowed_channels';
        const value = ['channel-1', 'channel-2'];

        await updateGuildConfig(GUILD_ID, key, value);
        const config = await getGuildConfig(GUILD_ID);

        expect(config).toEqual({ [key]: value });
        expect(Array.isArray(config[key])).toBe(true);
    });

    it('should update an existing value', async () => {
        const key = 'prefix';
        // 最初の値を設定
        await updateGuildConfig(GUILD_ID, key, '!');
        // 値を更新
        await updateGuildConfig(GUILD_ID, key, '$');
        
        const config = await getGuildConfig(GUILD_ID);
        expect(config).toEqual({ [key]: '$' });
    });

    it('should delete a value when null is passed', async () => {
        const key = 'prefix';
        // 値を設定
        await updateGuildConfig(GUILD_ID, key, '!');
        let config = await getGuildConfig(GUILD_ID);
        expect(config).toHaveProperty(key);

        // 値を削除
        await updateGuildConfig(GUILD_ID, key, null);
        config = await getGuildConfig(GUILD_ID);
        expect(config).not.toHaveProperty(key);
        expect(config).toEqual({});
    });

    it('should handle multiple keys for a single guild', async () => {
        await updateGuildConfig(GUILD_ID, 'prefix', '$');
        await updateGuildConfig(GUILD_ID, 'notify_role', 'role-id-456');
        
        const config = await getGuildConfig(GUILD_ID);
        expect(config).toEqual({
            prefix: '$',
            notify_role: 'role-id-456',
        });
    });

    it('should return an empty object for a guild with no config', async () => {
        const config = await getGuildConfig('non-existent-guild');
        expect(config).toEqual({});
    });
});
