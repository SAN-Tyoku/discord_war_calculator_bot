# WAR Calculator Bot

野球のWARを計算するためのDiscord botです。

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
- [ホスト管理者向け機能](#ホスト管理者向け機能)
- [ログ](#ログ)
- [ライセンス](#ライセンス)

## 主な機能

* **対話形式のWAR計算**: スラッシュコマンドから、野手または投手のWAR計算を対話形式で開始します。
* **成績一括登録**: 外部サイト等からコピーした成績テキストをペーストするだけで、自動解析してWARを計算します。
* **スレッド利用**: 計算セッションごとにプライベートスレッドを自動で作成・アーカイブし、チャンネルを綺麗に保ちます。
* **サーバーごとの設定**: 管理者コマンドにより、botの利用を特定のチャンネルに制限したり、通知用のロールを指定したりできます。
* **自動年度更新**: ゲーム内年度（現実の2日で1年進行）は、botの再起動なしに常に最新の日付に基づいて計算・判定されます。<br>**注**: スラッシュコマンドの定義更新は毎日自動実行されますが、Discordの仕様上、変更が反映されるまでに数分から数時間かかる場合があります。

* **柔軟なログ出力**: `NODE_ENV`（開発/本番）に応じて、ログの出力レベルや形式が自動で切り替わります。
* **テスト**: `Jest`によるユニットテストが導入されており、主要な機能の品質を保証します。

## 主な使用技術

* [Node.js](https://nodejs.org/)
* [discord.js](https://discord.js.org/) - Discord APIとの通信
* [Jest](https://jestjs.io/) - テスティングフレームワーク
* [SQLite](https://www.sqlite.org/index.html) - サーバーごとの設定保存
* [Winston](https://github.com/winstonjs/winston) - ログ出力
* [axios](https://axios-http.com/) - APIサーバーとの通信
* [dotenv](https://github.com/motdotla/dotenv) - 環境変数の管理
* [node-schedule](https://github.com/node-schedule/node-schedule) - コマンドの定期更新 (毎日21:01)

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
| `LOG_LEVEL` | ログの詳細度を指定します (`error`, `warn`, `info`, `debug` など)。デフォルトは `info` です。`debug` に設定すると、API通信の内容やユーザー入力などの詳細なデバッグ情報が出力されます。 |

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

**注意**: 上記はbotのロールに与えるべき基本的な権限です。これらに加えて、botが特定のチャンネルで動作するためには、そのチャンネルで**「チャンネルを見る」**、**「メッセージを送信」**、**「プライベートスレッドを作成」**などが許可されている必要があります。チャンネルの権限設定でbotやbotのロールが拒否されていないかご確認ください。

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
| **/calculate_war** | WAR計算を開始します。専用のスレッドが作成されます。<br>※未来の年度は選択できません。 |
| **/seiseki_paste** | 成績テキストを貼り付けてWARを計算します。野手/投手を自動判別します。 |
| **!end** | (スレッド内専用) 入力を中断し、強制終了してスレッドを閉じます。 |
| **!back** | (スレッド内専用) 一つ前の質問に戻ります。 |

---

### 管理者用 (サーバー所有者 / 管理者権限のみ)
| コマンド | 使用法・説明 |
| :--- | :--- |
| **/config mode** | **動作モード設定**<br>botが動作するチャンネルのモードを設定します。<br>・`allow-all`: 全てのチャンネルで許可（デフォルト）<br>・`restricted`: 指定チャンネルのみ許可 |
| **/config allow** | **チャンネル許可**<br>`restricted`モード時に、botの使用を許可するチャンネルを追加します。<br>使用法: `/config allow #channel` |
| **/config disallow** | **チャンネル禁止**<br>`restricted`モード時に、許可リストからチャンネルを削除します。<br>使用法: `/config disallow #channel` |
| **/config list** | **設定リスト確認**<br>現在の動作モードと、許可されているチャンネルの一覧を表示します。 |
| **/config role** | **通知ロール設定**<br>スレッド作成時にメンションするロールを設定/解除します。<br>設定: `/config role @Role`<br>解除: `/config role` |
| **!force_war** | **強制計算開始 (従来コマンド)**<br>年度制限を無視して計算を開始します。<br>使用法: `!force_war <fielder/pitcher> <year> <league>` |

## ホスト管理者向け機能

botのホスト（運用者）向けのCLIツールが `tools/` ディレクトリに用意されています。
bot本体とは独立して実行可能です。

### サーバー管理
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

### 運用サポート
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

## ログ

* ログはプロジェクトルートの `logs` ディレクトリ内に保存されます。
* `error.log`: エラーレベルのログのみ記録されます。
* `debug.log`: すべてのレベルのログが記録されます。
* 環境変数 `LOG_LEVEL` を設定することで、コンソール出力の詳細度を制御できます（例: `LOG_LEVEL=debug`）。
* `NODE_ENV=development` の場合、または `LOG_LEVEL` が設定されている場合、コンソールにもログが出力されます。

## ライセンス

このプロジェクトはMITライセンスです。詳細は[LICENSE](LICENSE)ファイルをご覧ください。