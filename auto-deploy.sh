#!/bin/bash

# TERACO.LABO Website自動デプロイスクリプト
# 使用方法: ./auto-deploy.sh "コミットメッセージ"

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

# 引数チェック
if [ $# -eq 0 ]; then
    COMMIT_MESSAGE="ウェブサイトを更新しました"
    print_warning "コミットメッセージが指定されていません。デフォルトメッセージを使用します: $COMMIT_MESSAGE"
else
    COMMIT_MESSAGE="$1"
fi

print_status "=== TERACO.LABO Website 自動デプロイ開始 ==="

# 現在のディレクトリを確認
if [ ! -f "index.html" ]; then
    print_error "index.htmlが見つかりません。正しいディレクトリで実行してください。"
    exit 1
fi

# Git状態を確認
print_status "Git状態を確認中..."
git status --porcelain

# gitignoreされたファイルを除いて追加
print_status "変更されたファイルを追加中（画像含む全変更）..."
git add -A

# 変更があるかチェック
if git diff --cached --quiet; then
    print_warning "コミットする変更がありません。"
    exit 0
fi

# コミット作成
print_status "コミットを作成中..."
if git commit -m "$COMMIT_MESSAGE"; then
    print_status "コミットが作成されました。"
else
    print_error "コミットの作成に失敗しました。"
    exit 1
fi

# 強制プッシュでリモートとの同期問題を回避
print_status "GitHubにプッシュ中..."
push_with_token() {
    if [ -n "$GITHUB_TOKEN" ]; then
        REMOTE_URL=$(git remote get-url --push origin 2>/dev/null || echo "https://github.com/anomalocaress/teraco-labo-website-v2.git")
        case "$REMOTE_URL" in
            https://*) REMOTE_HTTPS="$REMOTE_URL" ;;
            git@github.com:*) REMOTE_HTTPS="https://github.com/${REMOTE_URL#git@github.com:}" ;;
            *) REMOTE_HTTPS="https://github.com/anomalocaress/teraco-labo-website-v2.git" ;;
        esac
        USERNAME=${GITHUB_USERNAME:-anomalocaress}
        git push "https://${USERNAME}:${GITHUB_TOKEN}@${REMOTE_HTTPS#https://}" main
        return $?
    else
        git push origin main
        return $?
    fi
}

if push_with_token; then
    print_status "✅ GitHubへのプッシュが完了しました！"
    print_status "🌐 ウェブサイトが更新されました: https://anomalocaress.github.io/teraco-labo-website-v2/"
    print_status "⏳ GitHub Pagesが更新されるまで少しお待ちください..."
    sleep 5
    print_status "🎉 更新完了！ブラウザをリフレッシュしてご確認ください。"
else
    print_warning "通常のプッシュが失敗しました。リベースを試行中..."
    if git pull --rebase origin main && push_with_token; then
        print_status "✅ リベース後のプッシュが完了しました！"
        print_status "🌐 ウェブサイトが更新されました: https://anomalocaress.github.io/teraco-labo-website-v2/"
    else
        print_error "GitHubへのプッシュに失敗しました。手動で確認してください。"
        exit 1
    fi
fi

print_status "=== 自動デプロイ完了 ==="
