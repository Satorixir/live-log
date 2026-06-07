# ライブ参戦記録サイト

GitHub Pagesで公開するための静的サイトです。

## 更新手順

1. `Live Log/Live記録 310f761cd0b980718203f48524874968_all.csv` を更新します。
2. 次のコマンドでサイト用データを再生成します。

```sh
python3 "Live Log/site/scripts/build_site_data.py"
```

3. GitHub Pagesで公開します。

## 公開方法

新規リポジトリを作る場合は、`Live Log/site/` の中身をリポジトリのルートに置くのが一番シンプルです。

```text
repo-root/
  index.html
  styles.css
  app.js
  data/
  scripts/
```

GitHub Pagesの設定では、`main` ブランチの `/root` を公開対象にします。

このフォルダを既存リポジトリの一部として置く場合は、GitHub Pagesの標準設定だけでは任意のサブフォルダを直接公開できないため、`docs/` に移すか、GitHub Actionsで公開します。

## 構成

- `index.html`: サイト本体
- `styles.css`: 表示スタイル
- `app.js`: 検索・フィルタ機能
- `data/lives.json`: CSVから生成したサイト用JSON
- `data/lives.js`: ローカル直開きでも読めるサイト用データ
- `scripts/build_site_data.py`: CSVからJSONを生成するスクリプト
