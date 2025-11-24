# WAR Calculator Bot

野球のWAR (Wins Above Replacement) 統計を計算するためのDiscord Botです。

対話形式で選手の成績を入力すると、指定したAPIサーバーと通信して計算結果を返します。計算セッションはスレッド内で行われるため、メインチャンネルが散らかることはありません。

## 目次

- [主な機能](#主な機能)
- [動作デモ](#動作デモ)
- [主な使用技術](#主な使用技術)
- [セットアップ方法](#セットアップ方法)
- [環境変数](#環境変数)
- [Botに必要な権限](#botに必要な権限)
- [実行方法](#実行方法)
- [コマンド一覧](#コマンド一覧)
- [ログ](#ログ)
- [ライセンス](#ライセンス)

## 主な機能

* **対話形式のWAR計算**: スラッシュコマンドから、野手または投手のWAR計算を対話形式で開始します。
* **スレッド利用**: 計算セッションごとにプライベートスレッドを自動で作成・アーカイブし、チャンネルを綺麗に保ちます。
* **サーバーごとの設定**: 管理者コマンドにより、Botの利用を特定のチャンネルに制限したり、通知用のロールを指定したりできます。
* **柔軟なログ出力**: `NODE_ENV`（開発/本番）に応じて、ログの出力レベルや形式が自動で切り替わります。
* **テスト**: `Jest`によるユニットテストが導入されており、主要な機能の品質を保証します。

## 主な使用技術

*   [Node.js](https://nodejs.org/)
*   [discord.js](https://discord.js.org/) - Discord APIとの通信
*   [Jest](https://jestjs.io/) - テスティングフレームワーク
*   [SQLite](https://www.sqlite.org/index.html) - サーバーごとの設定保存
*   [Winston](https://github.com/winstonjs/winston) - ログ出力
*   [axios](https://axios-http.com/) - APIサーバーとの通信
*   [dotenv](https://github.com/motdotla/dotenv) - 環境変数の管理

## セットアップ方法

1.  **リポジトリのクローン**:
    ```bash
    git clone https://github.com/SAN-Tyoku/discord_war_calculator_bot.git
    cd war-calculator-bot
    ```

2. **依存関係のインストール**:

    ```bash
    npm install
    ```



3. **スラッシュコマンドの登録**:

    BotがDiscordサーバーでスラッシュコマンド (`/calculate_war`) を利用できるように登録します。

    このコマンドはBot起動前に一度実行する必要があります。年度指定オプションの最大値は動的に更新されるため、定期的に実行することを推奨します。

    ```bash
    npm run deploy
    ```



4. **環境変数の設定**:
    プロジェクトルートに `.env` ファイルを作成します。`.env.example` を参考に、必要な情報を入力してください。
    ```bash
    cp .env.example .env
    ```

## 環境変数

`.env` ファイルには以下の変数を設定します。

| 変数             | 説明                                           |
| :--------------- | :--------------------------------------------- |
| `BOT_TOKEN`      | Discord Botのトークン。                          |
| `APPLICATION_ID` | Discord BotのアプリケーションID。                |
| `API_URL`        | WAR計算APIのエンドポイントURL。                  |
| `BASIC_ID`       | APIにBasic認証が必要な場合のユーザーID。         |
| `BASIC_PASS`     | APIにBasic認証が必要な場合のパスワード。         |
| `NODE_ENV`       | `development` または `production` を指定します。`development` の場合、デバッグログがコンソールに出力されます。 |

## Botに必要な権限

BotがDiscordサーバーで正しく動作するために、以下の権限が必要です。

* `チャンネルを見る`
* `メッセージを送信`
* `埋め込みリンク`
* `公開スレッドを作成`
* `スレッドでメッセージを送信`
* `スレッドを管理`
* `メッセージ履歴を読む`

## 実行方法

```bash
npm start
```
Botが起動し、コンソールにログイン情報が表示されます。

## コマンド一覧

### 一般ユーザー用
| コマンド | 説明 |
| :--- | :--- |
| **/calculate_war** | WAR計算を開始します。専用のスレッドが作成されます。<br>※未来の年度は選択できません。 |
| **!end** | (スレッド内専用) 入力を中断し、強制終了してスレッドを閉じます。 |

---

### 管理者用 (サーバー所有者 / 管理者権限のみ)
| コマンド | 使用法・説明 |
| :--- | :--- |
| **/config role** | **通知ロール設定**<br>スレッド作成時にメンションするロールを設定/解除します。<br>設定: `/config role @Role`<br>解除: `/config role` |
| **/config allow** | **チャンネル許可**<br>コマンドの使用を特定のチャンネルのみに許可します。<br>使用法: `/config allow #channel` |
| **/config disallow** | **チャンネル禁止**<br>特定のチャンネルでのコマンド使用を禁止します。<br>使用法: `/config disallow #channel` |
| **/config list** | **許可リスト確認**<br>現在コマンドが許可されているチャンネルの一覧を表示します。 |
| **!force_war** | **強制計算開始**<br>年度制限を無視して計算を開始します。<br>使用法: `!force_war <fielder/pitcher> <year> <league>` |

## ログ

* ログはプロジェクトルートの `logs` ディレクトリ内に保存されます。
* `error.log`: エラーレベルのログのみ記録されます。
*   `debug.log`: すべてのレベルのログが記録されます。
*   `NODE_ENV=development` に設定すると、コンソールにも詳細なログが表示されます。

## ライセンス

このプロジェクトはMITライセンスです。詳細は[LICENSE](LICENSE)ファイルをご覧ください。