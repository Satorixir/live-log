# ライブ参戦記録サイト

GitHub Pagesで公開するための静的サイトです。

## 更新手順

1. Google Drive内の `Live Log/Live記録 310f761cd0b980718203f48524874968_all.csv` を更新します。
2. 次のコマンドでサイト用データを再生成します。

```sh
cd /Users/satorunagasawa/Documents/live-log
python3 scripts/build_site_data.py
```

3. GitHub Pagesで公開します。

## 公開方法

このリポジトリは `/Users/satorunagasawa/Documents/live-log` に置き、Google Drive同期フォルダの外でGit管理します。

```text
repo-root/
  index.html
  styles.css
  app.js
  data/
  scripts/
```

GitHub Pagesの設定では、`main` ブランチの `/root` を公開対象にします。

GitHub Pagesの設定では、`main` ブランチの `/root` を公開対象にします。

## 構成

- `index.html`: サイト本体
- `styles.css`: 表示スタイル
- `app.js`: 検索・フィルタ機能
- `data/lives.json`: CSVから生成したサイト用JSON
- `data/lives.js`: ローカル直開きでも読めるサイト用データ
- `data/artist_links.json`: アーティスト名から公式サイトURLへの対応表
- `scripts/build_site_data.py`: CSVからJSONを生成するスクリプト
