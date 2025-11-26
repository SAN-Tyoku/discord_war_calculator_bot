# WAR Calculator Bot

野球のWARを計算するためのDiscord Botです。

対話形式で選手の成績を入力すると、指定したAPIサーバーと通信して計算結果を返します。計算セッションはスレッド内で行われるため、メインチャンネルが散らかることはありません。

## 目次

- [主な機能](#主な機能)
- [動作デモ](#動作デモ)
- [主な使用技術](#主な使用技術)
- [セットアップ方法](#セットアップ方法)
- [環境変数](#環境変数)
- [必要なDiscord Gateway Intents](#必要なdiscord-gateway-intents)
- [Botに必要な権限](#botに必要な権限)
- [実行方法](#実行方法)
- [コマンド一覧](#コマンド一覧)
- [ログ](#ログ)
- [ライセンス](#ライセンス)

## 主な機能

* **対話形式のWAR計算**: スラッシュコマンドから、野手または投手のWAR計算を対話形式で開始します。
* **成績一括登録**: 外部サイト等からコピーした成績テキストをペーストするだけで、自動解析してWARを計算します。
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
    cd discord_war_calculator_bot
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

## 必要なDiscord Gateway Intents

このBotは以下のDiscord Gateway Intentsを使用します。これらのインテントは、Botアプリケーション設定ページ（Developer Portal）で有効にする必要があります。

*   **Message Content Intent**: Botがユーザーのメッセージ内容を読み取るために必要です（`!コマンド`や対話セッションでの数値入力のため）。
*   **Guild Members Intent**: Botがサーバーのメンバー情報にアクセスするために必要です（管理者権限のチェックのため）。

## Botに必要な権限

BotがDiscordサーバーで正しく動作するために、以下の権限が必要です。

* `チャンネルを見る`
* `メッセージを送信`
* `埋め込みリンク`
* `プライベートスレッドを作成`
* `スレッドでメッセージを送信`
* `スレッドを管理`
* `メッセージ履歴を読む`

**注意**: 上記はBotのロールに与えるべき基本的な権限です。これらに加えて、Botが特定のチャンネルで動作するためには、そのチャンネルで**「チャンネルを見る」**、**「メッセージを送信」**、**「プライベートスレッドを作成」**などが許可されている必要があります。チャンネルの権限設定でBotやBotのロールが拒否されていないかご確認ください。

## Botの招待

以下のリンクからあなたのサーバーにBotを招待できます。

[Botを招待する](https://discord.com/oauth2/authorize?client_id=1442533151862689854&permissions=360777337856&integration_type=0&scope=bot)

※Botに必要な権限は、上記リンクに含まれていますが、詳細は[Botに必要な権限](#botに必要な権限)セクションをご確認ください。

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
| **/seiseki_paste** | 成績テキストを貼り付けてWARを計算します。野手/投手を自動判別します。 |
| **!end** | (スレッド内専用) 入力を中断し、強制終了してスレッドを閉じます。 |

---

### 管理者用 (サーバー所有者 / 管理者権限のみ)
| コマンド | 使用法・説明 |
| :--- | :--- |
| **/config mode** | **動作モード設定**<br>Botが動作するチャンネルのモードを設定します。<br>・`allow-all`: 全てのチャンネルで許可（デフォルト）<br>・`restricted`: 指定チャンネルのみ許可 |
| **/config allow** | **チャンネル許可**<br>`restricted`モード時に、Botの使用を許可するチャンネルを追加します。<br>使用法: `/config allow #channel` |
| **/config disallow** | **チャンネル禁止**<br>`restricted`モード時に、許可リストからチャンネルを削除します。<br>使用法: `/config disallow #channel` |
| **/config list** | **設定リスト確認**<br>現在の動作モードと、許可されているチャンネルの一覧を表示します。 |
| **/config role** | **通知ロール設定**<br>スレッド作成時にメンションするロールを設定/解除します。<br>設定: `/config role @Role`<br>解除: `/config role` |
| **!force_war** | **強制計算開始 (従来コマンド)**<br>年度制限を無視して計算を開始します。<br>使用法: `!force_war <fielder/pitcher> <year> <league>` |

## ログ

* ログはプロジェクトルートの `logs` ディレクトリ内に保存されます。
* `error.log`: エラーレベルのログのみ記録されます。
*   `debug.log`: すべてのレベルのログが記録されます。
*   `NODE_ENV=development` に設定すると、コンソールにも詳細なログが表示されます。

## ライセンス

このプロジェクトはMITライセンスです。詳細は[LICENSE](LICENSE)ファイルをご覧ください。