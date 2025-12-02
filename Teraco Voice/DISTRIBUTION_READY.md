# Teraco Voice - 配布準備完了 🎉

## ✅ 完了した作業

### 1. ビルド成功
- macOS版（Apple Silicon & Intel）のインストーラー作成完了
- 署名なしでのリリース方針を決定

### 2. 配布用ファイル準備
以下のファイルが `dist/` フォルダに用意されています：

```
dist/
├── TeracoVoice-macOS-AppleSilicon-1.0.0.dmg  (432 MB) ← Apple Silicon用
├── TeracoVoice-macOS-Intel-1.0.0.dmg         (433 MB) ← Intel Mac用
└── checksums.txt                              ← SHA-256チェックサム
```

### 3. チェックサム（改ざん防止）
```
0ec3cfc6bbc16b9266d143212287be0ca4efb1624a8e65a32d051943872b7815  TeracoVoice-macOS-AppleSilicon-1.0.0.dmg
e1e24d321b8bf462adfbb6518b9c7f44dafd64c120d071523b53dd3de87265ca  TeracoVoice-macOS-Intel-1.0.0.dmg
```

### 4. ドキュメント更新
- ✅ USER_GUIDE.md - 署名なしアプリの起動手順を詳しく記載
- ✅ DOWNLOAD_PAGE_TEMPLATE.html - ダウンロードページのHTMLテンプレート作成

## 📋 配布の流れ

### ステップ1: ファイルのアップロード
以下のファイルをサーバーにアップロード：
```
dist/TeracoVoice-macOS-AppleSilicon-1.0.0.dmg
dist/TeracoVoice-macOS-Intel-1.0.0.dmg
dist/checksums.txt
build/icon_source.png (ダウンロードページ用)
```

### ステップ2: ダウンロードページの公開
`DOWNLOAD_PAGE_TEMPLATE.html` をベースにダウンロードページを作成：
- TERACO.LABOのサイトデザインに合わせてカスタマイズ
- ファイルへのリンクを設定
- アイコン画像を配置

### ステップ3: ユーザーサポート準備
- USER_GUIDE.mdの内容をサポートページに掲載
- FAQ作成（よくある質問）
- お問い合わせ窓口の設置

## 🎯 ユーザーへの重要な案内

### 初回起動手順（必ず伝える）
```
1. DMGファイルをダウンロード
2. アプリケーションフォルダにインストール
3. 【重要】右クリック→「開く」で起動
4. 2回目以降は通常通り起動可能
```

### なぜこの手順が必要？
- 個人開発者のため、Appleのコード署名を取得していない
- セキュリティ上の理由で、macOSが初回起動を制限
- アプリ自体は安全

## 📊 今後の展開

### フェーズ1: 無料配布（現在）
- 署名なしでリリース
- ユーザーの反応を確認
- フィードバック収集

### フェーズ2: 有料化検討
- ユーザー数が増えたら
- 収益が見込めるようになったら
- Apple Developer Program ($99/年) に登録
- コード署名を追加

### フェーズ3: 機能拡張
- 自動アップデート機能
- 設定画面の追加
- Windows版のリリース

## 🚀 次にやること

### すぐにできること
1. **動作確認**
   ```bash
   open "dist/TeracoVoice-macOS-AppleSilicon-1.0.0.dmg"
   ```
   実際にインストールして動作確認

2. **ファイルのアップロード**
   - サーバーに配布用ファイルをアップロード

3. **ダウンロードページの作成**
   - DOWNLOAD_PAGE_TEMPLATE.htmlをカスタマイズ

### 準備ができたら
- SNSでの告知
- メールマガジンでの案内
- ブログ記事の公開

## 📞 サポート体制

### 想定される質問
1. **「開発元を確認できません」と表示される**
   → 右クリック→「開く」で起動してください

2. **「マイクへのアクセス許可」が表示される**
   → 「OK」をクリックしてください

3. **音声が認識されない**
   → システム環境設定でマイク権限を確認

4. **どちらのバージョンをダウンロードすればいい？**
   → 2020年以降のMac: Apple Silicon版
   → 2019年以前のMac: Intel版

## 🎊 おめでとうございます！

Teraco Voiceのリリース準備が完了しました。
あとは配布するだけです！

---

**作成日**: 2024年11月26日
**バージョン**: 1.0.0
**ビルド環境**: macOS (Apple Silicon & Intel)
