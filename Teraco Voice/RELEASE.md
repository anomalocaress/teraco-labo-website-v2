# Teraco Voice - リリースガイド

## ビルド前の準備

### 1. アイコンファイルの配置
- `build/icon.icns` (macOS用)
- `build/icon.ico` (Windows用)

詳細は `build/ICON_CREATION.md` を参照してください。

### 2. 依存関係の確認
```bash
npm install
```

### 3. Python環境の確認
```bash
# venvが正しく動作することを確認
./venv/bin/python3 --version
```

## ビルドコマンド

### macOS版のビルド
```bash
npm run build:mac
```

生成されるファイル:
- `dist/TeracoVoice-macOS-AppleSilicon-1.0.0.dmg` (Apple Silicon用)
- `dist/TeracoVoice-macOS-Intel-1.0.0.dmg` (Intel Mac用)
- `dist/TeracoVoice-macOS-AppleSilicon-1.0.0-mac.zip`
- `dist/TeracoVoice-macOS-Intel-1.0.0-mac.zip`

> **⚠️ 重要: Intel版のビルドについて**
> Apple Silicon搭載Macでビルドする場合、生成されるIntel版アプリにはApple Silicon用のPython環境(venv)とffmpegが含まれてしまうため、**Intel Macでは正常に動作しません**。
> 正しいIntel版を作成するには、Intel Mac上でビルドを実行するか、GitHub ActionsなどのCI/CDサービスを利用する必要があります。
> 現時点では、Apple Silicon版のみが動作保証対象となります。

### Windows版のビルド
```bash
npm run build:win
```

生成されるファイル:
- `dist/Teraco Voice Setup 1.0.0.exe` (インストーラー)
- `dist/Teraco Voice 1.0.0.exe` (ポータブル版)

### 両方を一度にビルド
```bash
npm run build:all
```

## 配布前のテスト

### macOS
1. DMGファイルをマウント
2. アプリケーションフォルダにドラッグ&ドロップ
3. 初回起動時のマイク権限確認
4. 音声入力の動作確認
5. アンインストール確認

### Windows
1. インストーラーを実行
2. インストール先の選択
3. 初回起動時の動作確認
4. 音声入力の動作確認
5. アンインストール確認（コントロールパネルから）

## コード署名（任意だが推奨）

### macOS
Apple Developer Programに登録後:
```bash
# 環境変数を設定
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
export APPLE_ID=your@apple.id
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx

npm run build:mac
```

### Windows
コード署名証明書を取得後:
```bash
# 環境変数を設定
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your_password

npm run build:win
```

## 配布

### 自社サイトでの配布
1. ビルドされたファイルを `dist/` フォルダから取得
2. ファイル名を分かりやすく変更（例: `TeracoVoice-macOS-1.0.0.dmg`）
3. サイトにアップロード
4. ダウンロードページを作成

### 推奨ファイル構成
```
downloads/
├── mac/
│   ├── TeracoVoice-macOS-AppleSilicon-1.0.0.dmg
│   └── TeracoVoice-macOS-Intel-1.0.0.dmg
└── windows/
    ├── TeracoVoice-Windows-Setup-1.0.0.exe
    └── TeracoVoice-Windows-Portable-1.0.0.exe
```

## バージョン更新

`package.json` の `version` フィールドを更新:
```json
{
  "version": "1.0.1"
}
```

## トラブルシューティング

### ビルドエラー
- `node_modules` を削除して `npm install` を再実行
- Python環境が正しくパッケージされているか確認
- ffmpegバイナリが含まれているか確認

### macOSで「開発元を確認できません」エラー
- コード署名が必要、または
- ユーザーに「右クリック→開く」で初回起動してもらう

### Windowsで「WindowsによってPCが保護されました」
- コード署名が推奨
- 「詳細情報」→「実行」で起動可能

## 次のステップ
- 自動アップデート機能の実装（electron-updater）
- クラッシュレポート機能の追加
- 使用統計の収集（任意）
