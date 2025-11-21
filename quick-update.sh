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
print_status "ウェブサイトの全変更を追加中（画像含む）..."
git add -A

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
push_with_token() {
    # GITHUB_TOKEN があれば一時的なURLでプッシュ（remoteを書き換えない）
    if [ -n "$GITHUB_TOKEN" ]; then
        REMOTE_URL=$(git remote get-url --push origin 2>/dev/null || echo "https://github.com/anomalocaress/teraco-labo-website-v2.git")
        case "$REMOTE_URL" in
            https://*) REMOTE_HTTPS="$REMOTE_URL" ;;
            git@github.com:*) REMOTE_HTTPS="https://github.com/${REMOTE_URL#git@github.com:}" ;;
            *) REMOTE_HTTPS="https://github.com/anomalocaress/teraco-labo-website-v2.git" ;;
        esac
        USERNAME=${GITHUB_USERNAME:-anomalocaress}
        # トークンがログに出ないようURLは表示しない
        if git push "https://${USERNAME}:${GITHUB_TOKEN}@${REMOTE_HTTPS#https://}" main; then
            return 0
        else
            return 1
        fi
    else
        git push origin main
        return $?
    fi
}

if push_with_token; then
    print_status "✅ 更新完了！"
    print_status "🌐 ウェブサイト: https://anomalocaress.github.io/teraco-labo-website-v2/"
    print_status "⏳ GitHub Pagesが更新されるまで少しお待ちください..."
    sleep 5
    print_status "🎉 更新完了！ブラウザをリフレッシュしてご確認ください。"
else
    print_warning "通常のプッシュが失敗しました。リベースを試行中..."
    if git pull --rebase origin main && push_with_token; then
        print_status "✅ リベース後の更新完了！"
        print_status "🌐 ウェブサイト: https://anomalocaress.github.io/teraco-labo-website-v2/"
    else
        print_error "プッシュに失敗しました。手動で確認してください。"
        exit 1
    fi
fi
