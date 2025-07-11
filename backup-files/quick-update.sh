#!/bin/bash

# TERACO.LABO Website クイック更新スクリプト
# 使用方法: ./quick-update.sh

# 色付きメッセージ用の関数
print_status() {
    echo -e "\033[1;32m[INFO]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

print_status "=== TERACO.LABO Website クイック更新 ==="

# 現在のディレクトリを確認
if [ ! -f "index.html" ]; then
    print_error "index.htmlが見つかりません。正しいディレクトリで実行してください。"
    exit 1
fi

# 変更されたファイルを表示
print_status "変更されたファイル:"
git status --porcelain

# gitignoreされたファイルを除いて追加
print_status "ウェブサイトファイルを追加中..."
git add *.html *.css *.js *.md *.sh 2>/dev/null || true
git add css/ js/ 2>/dev/null || true

# 変更があるかチェック
if git diff --cached --quiet; then
    print_warning "コミットする変更がありません。"
    exit 0
fi

# 自動コミットメッセージを生成
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
COMMIT_MESSAGE="ウェブサイトを更新しました - $TIMESTAMP"

# コミット
print_status "コミット中..."
git commit -m "$COMMIT_MESSAGE"

# プッシュ（失敗時はリベースを試行）
print_status "GitHubにプッシュ中..."
if git push origin main; then
    print_status "✅ 更新完了！"
    print_status "🌐 ウェブサイト: https://anomalocaress.github.io/teraco-labo-website-v2/"
    print_status "⏳ GitHub Pagesが更新されるまで少しお待ちください..."
    sleep 5
    print_status "🎉 更新完了！ブラウザをリフレッシュしてご確認ください。"
else
    print_warning "通常のプッシュが失敗しました。リベースを試行中..."
    if git pull --rebase origin main && git push origin main; then
        print_status "✅ リベース後の更新完了！"
        print_status "🌐 ウェブサイト: https://anomalocaress.github.io/teraco-labo-website-v2/"
    else
        print_error "プッシュに失敗しました。手動で確認してください。"
        exit 1
    fi
fi