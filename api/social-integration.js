/**
 * TERACO.LABO ブログ SNS連携システム
 * X (Twitter) と note への自動投稿機能
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

// X (Twitter) API v2 クライアント（想定）
// 実際の実装では twitter-api-v2 ライブラリなどを使用
class TwitterClient {
    constructor(apiKey, apiSecret, accessToken, accessTokenSecret) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.accessToken = accessToken;
        this.accessTokenSecret = accessTokenSecret;
    }

    async postTweet(text) {
        try {
            // 実際のTwitter API v2呼び出し
            console.log('🐦 Twitter API v2で投稿:', text);
            
            /*
            const response = await fetch('https://api.twitter.com/2/tweets', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text
                })
            });
            
            const result = await response.json();
            return result;
            */
            
            // シミュレーション用
            return {
                success: true,
                data: {
                    id: '1234567890',
                    text: text,
                    created_at: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('Twitter API Error:', error);
            throw error;
        }
    }
}

// note API クライアント（想定）
class NoteClient {
    constructor(accessToken) {
        this.accessToken = accessToken;
    }

    async createPost(title, content, isPrivate = false) {
        try {
            console.log('📝 note APIで投稿:', title);
            
            /*
            const response = await fetch('https://note.com/api/v2/notes', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    content: content,
                    status: isPrivate ? 'private' : 'published'
                })
            });
            
            const result = await response.json();
            return result;
            */
            
            // シミュレーション用
            return {
                success: true,
                data: {
                    id: 'note123456',
                    title: title,
                    url: `https://note.com/teraco_labo/n/note123456`,
                    published_at: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('note API Error:', error);
            throw error;
        }
    }
}

// ブログ記事生成クラス
class BlogGenerator {
    constructor(blogData) {
        this.blogData = blogData;
        this.slug = this.generateSlug(blogData.title);
        this.filename = `${this.slug}.html`;
    }

    generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // 特殊文字除去
            .replace(/\s+/g, '-') // スペースをハイフンに
            .replace(/--+/g, '-') // 連続ハイフンを単一に
            .trim('-');
    }

    async generateHTML() {
        const template = await this.loadTemplate();
        const html = template
            .replace(/{{TITLE}}/g, this.blogData.title)
            .replace(/{{CATEGORY}}/g, this.getCategoryName(this.blogData.category))
            .replace(/{{EXCERPT}}/g, this.blogData.excerpt)
            .replace(/{{CONTENT}}/g, this.formatContent(this.blogData.content))
            .replace(/{{READ_time}}/g, this.blogData.readTime || '5')
            .replace(/{{PUBLISH_DATE}}/g, new Date().toLocaleDateString('ja-JP'))
            .replace(/{{SLUG}}/g, this.slug);

        return html;
    }

    async loadTemplate() {
        // 記事テンプレートを読み込み
        const templatePath = path.join(__dirname, 'templates', 'blog-post-template.html');
        
        // テンプレートファイルが存在しない場合のデフォルト
        const defaultTemplate = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITLE}} - TERACO.LABO ブログ</title>
    <meta name="description" content="{{EXCERPT}}">
    
    <!-- Google Analytics 4 -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-3GCZQ39LS1"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-3GCZQ39LS1');
    </script>
    <!-- 省略: CSSとHTML構造 -->
</head>
<body>
    <article>
        <header>
            <span class="category">{{CATEGORY}}</span>
            <h1>{{TITLE}}</h1>
            <div class="meta">{{PUBLISH_DATE}} | {{READ_time}}分で読める</div>
        </header>
        <div class="content">
            {{CONTENT}}
        </div>
    </article>
</body>
</html>`;

        try {
            return await fs.readFile(templatePath, 'utf8');
        } catch (error) {
            console.log('テンプレートファイルが見つかりません。デフォルトを使用します。');
            return defaultTemplate;
        }
    }

    getCategoryName(category) {
        const categoryMap = {
            'ai': 'AI・DX',
            'video': '映像制作',
            'smartphone': 'スマホ活用',
            'business': 'ビジネス',
            'education': '教育・研修'
        };
        return categoryMap[category] || 'その他';
    }

    formatContent(content) {
        // Markdownライクなテキストを簡単なHTMLに変換
        return content
            .replace(/\n\n/g, '</p><p>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^# (.*$)/gm, '<h2>$1</h2>')
            .replace(/^## (.*$)/gm, '<h3>$1</h3>')
            .replace(/^\- (.*$)/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/^(<p>)?/g, '<p>')
            .replace(/(<\/p>)?$/g, '</p>');
    }

    async saveToFile() {
        const html = await this.generateHTML();
        const blogDir = path.join(__dirname, '..', 'blog');
        const filePath = path.join(blogDir, this.filename);

        // blog ディレクトリが存在しない場合は作成
        try {
            await fs.access(blogDir);
        } catch {
            await fs.mkdir(blogDir, { recursive: true });
        }

        await fs.writeFile(filePath, html, 'utf8');
        return filePath;
    }
}

// メインのSNS連携システム
class SocialIntegrationSystem {
    constructor() {
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());
        
        this.setupRoutes();
    }

    setupRoutes() {
        // ブログ記事投稿 + SNS連携
        this.app.post('/api/blog/publish', async (req, res) => {
            try {
                const { blogData, socialSettings, platforms } = req.body;
                
                console.log('📝 新しいブログ記事の投稿開始...');
                
                // 1. ブログ記事HTMLファイル生成
                const generator = new BlogGenerator(blogData);
                const filePath = await generator.saveToFile();
                console.log(`✅ ブログファイル生成完了: ${filePath}`);

                const results = {
                    blog: {
                        success: true,
                        file: generator.filename,
                        url: `${socialSettings.websiteUrl}/blog/${generator.filename}`
                    },
                    social: {}
                };

                // 2. X (Twitter) 投稿
                if (platforms.twitter && socialSettings.twitterApiKey) {
                    try {
                        const twitterClient = new TwitterClient(
                            socialSettings.twitterApiKey,
                            socialSettings.twitterApiSecret,
                            socialSettings.twitterAccessToken,
                            socialSettings.twitterAccessTokenSecret
                        );
                        
                        const tweetResult = await twitterClient.postTweet(blogData.twitterText);
                        results.social.twitter = {
                            success: true,
                            data: tweetResult.data
                        };
                        console.log('🐦 Twitter投稿完了');
                    } catch (error) {
                        results.social.twitter = {
                            success: false,
                            error: error.message
                        };
                        console.error('🐦 Twitter投稿失敗:', error);
                    }
                }

                // 3. note 投稿
                if (platforms.note && socialSettings.noteApiToken) {
                    try {
                        const noteClient = new NoteClient(socialSettings.noteApiToken);
                        
                        const noteContent = `${blogData.noteIntro}\n\n${blogData.excerpt}\n\n${blogData.noteOutro}`;
                        const noteResult = await noteClient.createPost(
                            blogData.title,
                            noteContent
                        );
                        
                        results.social.note = {
                            success: true,
                            data: noteResult.data
                        };
                        console.log('📝 note投稿完了');
                    } catch (error) {
                        results.social.note = {
                            success: false,
                            error: error.message
                        };
                        console.error('📝 note投稿失敗:', error);
                    }
                }

                res.json(results);
                
            } catch (error) {
                console.error('投稿処理エラー:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // ブログ一覧更新
        this.app.post('/api/blog/update-index', async (req, res) => {
            try {
                const { newPost } = req.body;
                
                // blog.html の記事一覧を更新
                await this.updateBlogIndex(newPost);
                
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // RSS フィード生成
        this.app.get('/api/blog/rss', async (req, res) => {
            try {
                const rssXml = await this.generateRSSFeed();
                res.set('Content-Type', 'application/rss+xml');
                res.send(rssXml);
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    async updateBlogIndex(newPost) {
        const blogIndexPath = path.join(__dirname, '..', 'blog.html');
        const blogIndexContent = await fs.readFile(blogIndexPath, 'utf8');
        
        // 新しい記事カードのHTML生成
        const newCardHTML = this.generateBlogCardHTML(newPost);
        
        // blog-grid に新しいカードを追加
        const updatedContent = blogIndexContent.replace(
            '<div class="blog-grid" id="blogGrid">',
            `<div class="blog-grid" id="blogGrid">
                ${newCardHTML}`
        );
        
        await fs.writeFile(blogIndexPath, updatedContent, 'utf8');
        console.log('✅ ブログ一覧ページを更新しました');
    }

    generateBlogCardHTML(post) {
        const categoryEmojis = {
            'ai': '🤖',
            'video': '🎬',
            'smartphone': '📱',
            'business': '💼',
            'education': '🎓'
        };

        return `
                    <a href="blog/${post.filename}" class="blog-card" data-category="${post.category}">
                        <div class="blog-card-image">${categoryEmojis[post.category] || '📄'}</div>
                        <div class="blog-card-content">
                            <span class="blog-card-category">${this.getCategoryName(post.category)}</span>
                            <h3 class="blog-card-title">${post.title}</h3>
                            <p class="blog-card-excerpt">${post.excerpt}</p>
                            <div class="blog-card-meta">
                                <div class="blog-card-date">📅 ${new Date().toLocaleDateString('ja-JP')}</div>
                                <div class="blog-card-readtime">⏱️ ${post.readTime || 5}分</div>
                            </div>
                        </div>
                    </a>`;
    }

    getCategoryName(category) {
        const categoryMap = {
            'ai': 'AI・DX',
            'video': '映像制作',
            'smartphone': 'スマホ活用',
            'business': 'ビジネス',
            'education': '教育・研修'
        };
        return categoryMap[category] || 'その他';
    }

    async generateRSSFeed() {
        // RSS 2.0 フィード生成
        const blogDir = path.join(__dirname, '..', 'blog');
        const files = await fs.readdir(blogDir);
        const htmlFiles = files.filter(file => file.endsWith('.html'));
        
        // 最新10件の記事を取得（実際はメタデータから）
        const posts = []; // 実装省略
        
        const rssHeader = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>TERACO.LABO ブログ</title>
<description>AI・映像制作・デジタルスキルの最新情報</description>
<link>https://teraco-labo.com/blog/</link>
<language>ja</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`;

        const rssFooter = `</channel>
</rss>`;

        const rssItems = posts.map(post => `
<item>
<title>${post.title}</title>
<description>${post.excerpt}</description>
<link>https://teraco-labo.com/blog/${post.filename}</link>
<pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
<guid>https://teraco-labo.com/blog/${post.filename}</guid>
</item>`).join('');

        return rssHeader + rssItems + rssFooter;
    }

    start(port = 3001) {
        this.app.listen(port, () => {
            console.log(`🚀 SNS連携APIサーバーが http://localhost:${port} で起動しました`);
            console.log('📝 ブログ管理: http://localhost:3001/blog-admin.html');
        });
    }
}

// 使用例とエクスポート
if (require.main === module) {
    const system = new SocialIntegrationSystem();
    system.start();
}

module.exports = { SocialIntegrationSystem, TwitterClient, NoteClient, BlogGenerator };