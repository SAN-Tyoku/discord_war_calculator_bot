const { getDefaultGameYear, getQuestions } = require('./utils');

describe('utils.js', () => {

    // getQuestions関数のテストスイート
    describe('getQuestions', () => {
        it('should return an array of questions for "fielder"', () => {
            const questions = getQuestions('fielder');
            expect(Array.isArray(questions)).toBe(true);
            expect(questions.length).toBeGreaterThan(0);
            expect(questions[0]).toHaveProperty('q', '打席数を入力してください');
            expect(questions[0]).toHaveProperty('key', 'plateAppearance');
        });

        it('should return an array of questions for "pitcher"', () => {
            const questions = getQuestions('pitcher');
            expect(Array.isArray(questions)).toBe(true);
            expect(questions.length).toBeGreaterThan(0);
            expect(questions[0]).toHaveProperty('q', '投球回を入力してください (例: 143回1/3 -> 143.333)');
            expect(questions[0]).toHaveProperty('key', 'innings');
        });

        it('should return an empty array for an invalid subcommand', () => {
            const questions = getQuestions('invalid_subcommand');
            expect(Array.isArray(questions)).toBe(true);
            expect(questions.length).toBe(0);
        });

        it('should return an empty array for no subcommand', () => {
            const questions = getQuestions();
            expect(Array.isArray(questions)).toBe(true);
            expect(questions.length).toBe(0);
        });
    });

    // getDefaultGameYear関数のテストスイート
    describe('getDefaultGameYear', () => {
        const originalDate = global.Date;

        afterEach(() => {
            // 各テストの後にDateオブジェクトを元に戻す
            global.Date = originalDate;
        });

        it('should return the correct game year based on the current real date', () => {
            // テスト用の固定日時を設定 (基準日からちょうど10日後)
            const baseDate = new Date('2025-09-09T21:00:00+09:00');
            const mockDate = new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000); // 10日後
            
            // DateコンストラクタとDate.now()が固定日時を返すようにモックする
            global.Date = class extends originalDate {
                constructor(dateString) {
                    if (dateString) {
                        return super(dateString);
                    }
                    return mockDate;
                }

                static now() {
                    return mockDate.getTime();
                }
            };
            
            // 基準年: 1385
            // 経過日数: 10日
            // 経過年数: floor(10 / 2) = 5年
            // 期待されるゲーム内年度: 1385 + 5 - 1 = 1389
            const expectedGameYear = 1389;
            
            expect(getDefaultGameYear()).toBe(expectedGameYear);
        });

        it('should return the correct game year when on an odd day', () => {
             // テスト用の固定日時を設定 (基準日からちょうど11日後)
            const baseDate = new Date('2025-09-09T21:00:00+09:00');
            const mockDate = new Date(baseDate.getTime() + 11 * 24 * 60 * 60 * 1000); // 11日後
            
            global.Date = class extends originalDate {
                constructor(dateString) {
                    if (dateString) {
                        return super(dateString);
                    }
                    return mockDate;
                }

                static now() {
                    return mockDate.getTime();
                }
            };
            
            // 基準年: 1385
            // 経過日数: 11日
            // 経過年数: floor(11 / 2) = 5年
            // 期待されるゲーム内年度: 1385 + 5 - 1 = 1389
            const expectedGameYear = 1389;

            expect(getDefaultGameYear()).toBe(expectedGameYear);
        });
    });
});
