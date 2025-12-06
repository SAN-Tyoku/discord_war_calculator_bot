# WAR Calculator Bot

野球のWARを計算するためのDiscord botです。

対話形式で選手の成績を入力すると、指定したAPIサーバーと通信して計算結果を返します。計算セッションはスレッド内で行われるため、メインチャンネルが散らかることはありません。

## 目次

- [主な機能](#主な機能)
- [主な使用技術](#主な使用技術)
- [セットアップ方法](#セットアップ方法)
- [環境変数](#環境変数)
- [必要なDiscord Gateway Intents](#必要なdiscord-gateway-intents)
- [Botに必要な権限](#botに必要な権限)
- [実行方法](#実行方法)
- [コマンド一覧](#コマンド一覧)
- [ホスト管理者向け機能](#ホスト管理者向け機能)
- [ログ](#ログ)
- [ライセンス](#ライセンス)

## 主な機能

* **対話形式のWAR計算**: スラッシュコマンドから、野手または投手のWAR計算を対話形式で開始します。
* **成績一括登録**: 外部サイト等からコピーした成績テキストをペーストするだけで、自動解析してWARを計算します。
* **スレッド利用**: 計算セッションごとにプライベートスレッドを自動で作成・アーカイブし、チャンネルを綺麗に保ちます。
* **サーバーごとの設定**: 管理者コマンドにより、botの利用を特定のチャンネルに制限したり、通知用のロールを指定したりできます。
* **自動年度更新**: ゲーム内年度（現実の2日で1年進行）は、botの再起動なしに常に最新の日付に基づいて計算・判定されます。`/calculate_war` コマンドの`年度`オプションは、Botの実行時ロジックで未来の年度をチェックし、拒否します。コマンド定義の`年度`オプションの入力上限は動的に更新されません。
* **柔軟なログ出力**: `NODE_ENV`（開発/本番）に応じて、ログの出力レベルや形式を切り替えられます。
* **計算結果の修正・再計算**: 対話形式のWAR計算完了後、結果画面に表示されるメニューから一部の数値を修正し、すぐに再計算を行えます。
* **計算結果の共有**: 計算結果画面に表示されるボタンから、結果をメインチャンネルに共有できます。共有機能はデフォルトでは無効で、管理者設定により有効化できます。
* **テスト**: `Jest`によるユニットテストが導入されており、主要な機能の品質を保証します。

## 主な使用技術

* [Node.js](https://nodejs.org/)
* [discord.js](https://discord.js.org/) - Discord APIとの通信
* [Jest](https://jestjs.io/) - テスティングフレームワーク
* [SQLite](https://www.sqlite.org/index.html) - サーバーごとの設定保存
* [Winston](https://github.com/winstonjs/winston) - ログ出力
* [axios](https://axios-http.com/) - APIサーバーとの通信
* [dotenv](https://github.com/motdotla/dotenv) - 環境変数の管理

## セットアップ方法

1. **リポジトリのクローン**:
    ```bash
    git clone https://github.com/SAN-Tyoku/discord_war_calculator_bot.git
    cd discord_war_calculator_bot
    ```

2. **依存関係のインストール**:
    ```bash
    npm install
    ```

3. **スラッシュコマンドの登録**:
    botがDiscordサーバーでスラッシュコマンド (`/calculate_war`) を利用できるように登録します。
    このコマンドはbot起動前に一度実行する必要があります。

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

| 変数 | 説明 |
| :--- | :--- |
| `BOT_TOKEN` | Discord botのトークン。 |
| `APPLICATION_ID` | Discord botのアプリケーションID。 |
| `API_URL` | WAR計算APIのエンドポイントURL。 |
| `BASIC_ID` | APIにBasic認証が必要な場合のユーザーID。 |
| `BASIC_PASS` | APIにBasic認証が必要な場合のパスワード。 |
| `NODE_ENV` | `development` または `production` を指定します。`development` の場合、コンソール出力が有効になります。 |
| `LOG_LEVEL` | ログの詳細度を指定します (`error`, `warn`, `info`, `debug` など)。デフォルトは `info` です。この設定はコンソール出力だけでなく、`logs/combined.log` への出力レベルも制御します。`debug` に設定すると、API通信の内容やユーザー入力などの詳細なデバッグ情報が記録されます。 |
| `API_TIMEOUT` | WAR計算APIとの通信時のタイムアウト設定 (ミリ秒)。デフォルトは `10000` (10秒) です。 |

## 必要なDiscord Gateway Intents

このbotは以下のDiscord Gateway Intentsを使用します。これらのインテントは、botアプリケーション設定ページ（Developer Portal）で有効にする必要があります。

* **Message Content Intent**: botがユーザーのメッセージ内容を読み取るために必要です（`!コマンド`や対話セッションでの数値入力のため）。
* **Guild Members Intent**: botがサーバーのメンバー情報にアクセスするために必要です（管理者権限のチェックのため）。

## Botに必要な権限

botがDiscordサーバーで正しく動作するために、以下の権限が必要です。

* `チャンネルを見る`
* `メッセージを送信`
* `埋め込みリンク`
* `プライベートスレッドを作成`
* `スレッドでメッセージを送信`
* `スレッドを管理`
* `メッセージ履歴を読む`

**注意**: 上記はbotのロールに与えるべき基本的な権限です。これらに加えて、botが特定のチャンネルで動作するためには、そのチャンネルで`チャンネルを見る`、`メッセージを送信`、`プライベートスレッドを作成`などが許可されている必要があります。チャンネルの権限設定でbotやbotのロールが拒否されていないかご確認ください。

## Botの招待

以下のリンクからあなたのサーバーにbotを招待できます。
<a href="https://discord.com/oauth2/authorize?client_id=1442533151862689854&permissions=360777337856&integration_type=0&scope=bot" target="_blank">Botを招待する</a>

※botに必要な権限は、上記リンクに含まれていますが、詳細は[Botに必要な権限](#botに必要な権限)セクションをご確認ください。

## 実行方法

```bash
npm start
```
botが起動し、コンソールにログイン情報が表示されます。

## コマンド一覧

### 一般ユーザー用
| コマンド | 説明 |
| :--- | :--- |
| **/help** | コマンド一覧や使い方を表示します。 |
| **/calculate_war** | WAR計算を開始します。専用のスレッドが作成されます。<br>※未来の年度は選択できません。 |
| **/seiseki_paste** | 成績テキストを貼り付けてWARを計算します。野手/投手を自動判別します。 |
| **!end** | (スレッド内専用) 入力を中断し、強制終了してスレッドを閉じます。 |
| **!back** | (スレッド内専用) 一つ前の質問に戻ります。 |
| **/feedback** | 開発者やサーバー管理者にフィードバックやバグ報告を送信します。利用にはサーバー管理者の設定が必要です。 |

---

### 管理者用 (サーバー所有者 / 管理者権限のみ)
| コマンド | 使用法・説明 |
| :--- | :--- |
| **/config mode** | **動作モード設定**<br>botが動作するチャンネルのモードを設定します。<br>・`allow-all`: 全てのチャンネルで許可（デフォルト）<br>・`restricted`: 指定チャンネルのみ許可 |
| **/config allow** | **チャンネル許可**<br>`restricted`モード時に、botの使用を許可するチャンネルを追加します。<br>使用法: `/config allow #channel` |
| **/config disallow** | **チャンネル禁止**<br>`restricted`モード時に、許可リストからチャンネルを削除します。<br>使用法: `/config disallow #channel` |
| **/config list** | **設定リスト確認**<br>現在の動作モードと、許可されているチャンネルの一覧を表示します。 |
| **/config role** | **通知ロール設定**<br>スレッド作成時にメンションするロールを設定/解除します。<br>設定: `/config role @Role`<br>解除: `/config role` |
| **/cleanup_threads** | **計算用スレッド一括アーカイブ**<br>このチャンネルにある、Botが作成したWAR計算用スレッドを一括でロック・アーカイブします。サーバー管理者のみ実行可能です。 |
| **/status** | **システム診断**<br>APIサーバーへの接続テストや、権限チェック、現在設定の診断を行います。 |
| **!force_war** | **強制計算開始 (従来コマンド)**<br>年度制限を無視して計算を開始します。<br>使用法: `!force_war <fielder/pitcher> <year> <league>` |
| **/config feedback** | **フィードバック受信設定**<br>ユーザーからのフィードバックを受け取るチャンネルを設定します。<br>設定: `/config feedback #channel`<br>解除: `/config feedback` |
| **/config share** | **計算結果の共有機能設定**<br>ユーザーが計算結果をメインチャンネルに共有できる機能をON/OFFします。<br>設定: `/config share enabled:True/False` (デフォルト: False) |

## ホスト管理者向け機能

botのホスト（運用者）向けのCLIツールが `tools/` ディレクトリに用意されています。
bot本体とは独立して実行可能です。

### 統合管理ツール (推奨)

複数の管理機能をまとめた対話型ツールです。メニューから機能を選択して実行できます。

```bash
node tools/admin.js
```
*   サーバー一覧の表示
*   お知らせの一斉送信
*   ブラックリスト管理
*   ログ分析

### 個別ツール

各機能は個別のスクリプトとしても実行可能です。

#### メンテナンスモード管理

botの稼働状態をメンテナンスモードに切り替えます。
メンテナンスモード中は、`HOST_USER_ID` で指定されたユーザー以外の一般ユーザーからのコマンド実行をブロックします。
また、botのステータスが自動的に`メンテナンス中`に変更されます。(メンテナンスモードを解除すると、もとの状態に戻ります)

*   **状態確認**
    ```bash
    node tools/maintenance.js status
    ```
*   **有効化**
    ```bash
    node tools/maintenance.js on
    ```
*   **無効化**
    ```bash
    node tools/maintenance.js off
    ```

#### データベースバックアップ

botが使用するSQLiteデータベース (`config.db`) のバックアップを作成します。
指定された数（デフォルト7個）のバックアップを保持し、古いものから自動的に削除されます。
定期的な実行には `cron` やタスクスケジューラをご利用ください。

```bash
node tools/backup_db.js
```

#### サーバー管理
* **参加サーバー一覧の表示**
    ```bash
    node tools/list_guilds.js
    ```
    botが参加している全サーバー、メンバー数、bot導入日、オーナー情報などを表示します。

* **特定のサーバーから退出**
    ```bash
    node tools/leave_guild.js <GUILD_ID>
    ```
    指定したIDのサーバーからbotを強制的に退出させます。IDは `list_guilds.js` で確認してください。

* **設定データの掃除 (DB Prune)**
    ```bash
    node tools/prune_db.js
    ```
    botが既に退出したサーバーの設定データがデータベースに残っている場合、それを検知して削除します。

#### 運用サポート
* **一斉アナウンス送信**
    ```bash
    node tools/broadcast.js "ここにメッセージを入力"
    ```
    導入されている全サーバーに対し、メッセージを一斉送信します。
    送信先は「許可されたチャンネル」または「システムチャンネル」が自動的に選択されます。送信先が見つからないサーバーはスキップされます。

* **ブラックリスト管理**
    Botの利用を禁止するユーザーまたはサーバーを管理します。

    ```bash
    # 一覧表示
    node tools/blacklist.js list

    # 追加 (タイプは user または guild)
    node tools/blacklist.js add <ID> <type> [理由]
    # 例: node tools/blacklist.js add 123456789012345678 user "荒らし行為のため"

    # 削除
    node tools/blacklist.js remove <ID>
    ```

* **フィードバック内容の確認**
    ユーザーから送信されたフィードバック内容をCLIで確認できます。

    ```bash
    # 最新20件のフィードバックを表示
    node tools/check_feedback.js

    # 全てのフィードバックを表示
    node tools/check_feedback.js --all
    ```

* **Botステータス(Activity)の変更**

    設定はデータベースに保存され、稼働中のbotは約10分間隔で自動的に反映します。botの再起動は不要です。

    **プリセットモード**
    ```bash
    # (例: "Playing 〇〇 servers") 現在参加しているサーバー数を表示
    node tools/set_status.js preset servers

    # (例: "Watching 〇〇 members") 現在アクセス可能なメンバー数を表示
    node tools/set_status.js preset members
    ```

    **カスタムモード (任意のテキスト)**
    ```bash
    # (例: "Watching メンテナンス中")
    # "メンテナンス中" の部分が bot のステータスとして表示されるメッセージです。
    # 末尾の watching はステータスの種類です。
    # (playing, watching, listening, competing から選択。省略時は playing)
    node tools/set_status.js custom "メンテナンス中" watching

    # タイプを省略した例 (例: "Playing みんなのWARを計算中")
    node tools/set_status.js custom "みんなのWARを計算中"
    ```

* **ログ分析**
    ```bash
    node tools/analyze_logs.js
    ```
    `logs/` ディレクトリ内のログファイルを集計し、エラー発生数やAPIエラー数などを表示します。
    また、**ユーザーごとおよびサーバーごとのコマンド実行回数（計算成功数）**も確認できます。

## ログ

* ログはプロジェクトルートの `logs` ディレクトリ内に保存されます。
* `error.log`: エラーレベルのログのみ記録されます。
* `combined.log`: 設定された `LOG_LEVEL` 以上のすべてのログが記録されます。
* 環境変数 `LOG_LEVEL` を設定することで、コンソール出力および `combined.log` への出力の詳細度を制御できます（例: `LOG_LEVEL=debug`）。

## ライセンス

このプロジェクトはMITライセンスです。詳細は[LICENSE](LICENSE)ファイルをご覧ください。