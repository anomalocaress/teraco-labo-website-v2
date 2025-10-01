/**
 * TERACO.LABO SNS/Blog API
 * - Blog HTML generation
 * - X (Twitter) + note posting (simulated)
 * - Health check + simple web-reservations intake
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

// Load env from project root if present
try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {
  // dotenv not installed or .env missing; keep going
}

// Simple X(Twitter) client (simulated)
class TwitterClient {
  constructor({ apiKey, apiSecret, accessToken, accessTokenSecret, bearerToken }) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.accessToken = accessToken;
    this.accessTokenSecret = accessTokenSecret;
    this.bearerToken = bearerToken;
  }

  async postTweet(text) {
    // NOTE: This is a simulation placeholder. Replace with twitter-api-v2 calls.
    console.log('🐦 Simulated X post:', text);
    return {
      success: true,
      data: {
        id: 'tweet_sim_' + Date.now(),
        text,
        created_at: new Date().toISOString(),
      },
    };
  }
}

// Simple note client (simulated)
class NoteClient {
  constructor({ accessToken }) {
    this.accessToken = accessToken;
  }

  async createPost(title, content) {
    // NOTE: This is a simulation placeholder. Replace with real note API call.
    console.log('📝 Simulated note post:', title);
    return {
      success: true,
      data: {
        id: 'note_sim_' + Date.now(),
        title,
        url: `https://note.com/teraco_labo/n/${'note_sim_' + Date.now()}`,
        published_at: new Date().toISOString(),
      },
    };
  }
}

// Blog generator (basic)
class BlogGenerator {
  constructor(blogData) {
    this.blogData = blogData;
    this.slug = this.generateSlug(blogData.title || 'untitled');
    this.filename = `${this.slug}.html`;
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim('-');
  }

  async generateHTML() {
    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${this.escape(this.blogData.title)} - TERACO.LABO ブログ</title>
  <meta name="description" content="${this.escape(this.blogData.excerpt || '')}" />
</head>
<body>
  <article>
    <header>
      <h1>${this.escape(this.blogData.title)}</h1>
      <div>${new Date().toLocaleDateString('ja-JP')}</div>
    </header>
    <section>
      ${this.formatContent(this.blogData.content || '')}
    </section>
  </article>
</body>
</html>`;
    return html;
  }

  formatContent(content) {
    return content
      .replace(/\n\n/g, '</p><p>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^# (.*$)/gm, '<h2>$1</h2>')
      .replace(/^## (.*$)/gm, '<h3>$1</h3>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/^(<p>)?/g, '<p>')
      .replace(/(<\/p>)?$/g, '</p>');
  }

  escape(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async saveToFile() {
    const html = await this.generateHTML();
    const blogDir = path.join(__dirname, '..', 'blog');
    const filePath = path.join(blogDir, this.filename);

    try {
      await fs.access(blogDir);
    } catch {
      await fs.mkdir(blogDir, { recursive: true });
    }
    await fs.writeFile(filePath, html, 'utf8');
    return filePath;
  }
}

function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  // Serve project root statics so the admin/testing pages can be opened
  app.use(express.static(path.join(__dirname, '..')));

  // Health check: do we have tokens?
  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      tokens: {
        twitter: Boolean(
          process.env.TW_BEARER_TOKEN ||
            (process.env.TW_CONSUMER_KEY &&
              process.env.TW_CONSUMER_SECRET &&
              process.env.TW_ACCESS_TOKEN &&
              process.env.TW_ACCESS_SECRET)
        ),
        note: Boolean(process.env.NOTE_API_TOKEN),
      },
    });
  });

  // Minimal intake for web-reservations to support contact-form.html
  app.post('/api/web-reservations', async (req, res) => {
    const dataDir = path.join(__dirname, '..', 'data');
    const filePath = path.join(dataDir, 'web-reservations.jsonl');
    try {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.appendFile(filePath, JSON.stringify({ ...req.body, receivedAt: new Date().toISOString() }) + '\n');
      res.json({ success: true });
    } catch (err) {
      console.error('web-reservations write error:', err);
      res.status(500).json({ success: false, error: 'Failed to record reservation' });
    }
  });

  // Post to X(Twitter) (simulated)
  app.post('/api/twitter/post', async (req, res) => {
    try {
      const { text, tokens = {} } = req.body || {};
      if (!text || !text.trim()) return res.status(400).json({ success: false, error: 'text is required' });

      const client = new TwitterClient({
        apiKey: tokens.apiKey || process.env.TW_CONSUMER_KEY,
        apiSecret: tokens.apiSecret || process.env.TW_CONSUMER_SECRET,
        accessToken: tokens.accessToken || process.env.TW_ACCESS_TOKEN,
        accessTokenSecret: tokens.accessTokenSecret || process.env.TW_ACCESS_SECRET,
        bearerToken: tokens.bearerToken || process.env.TW_BEARER_TOKEN,
      });

      // Basic presence check
      if (!client.bearerToken && !(client.apiKey && client.apiSecret && client.accessToken && client.accessTokenSecret)) {
        return res.status(400).json({ success: false, error: 'Twitter tokens not provided' });
      }

      const result = await client.postTweet(text);
      res.json({ success: true, result });
    } catch (error) {
      console.error('Twitter post error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Post to note (simulated)
  app.post('/api/note/post', async (req, res) => {
    try {
      const { title, content, tokens = {} } = req.body || {};
      if (!title || !title.trim()) return res.status(400).json({ success: false, error: 'title is required' });
      if (!content || !content.trim()) return res.status(400).json({ success: false, error: 'content is required' });

      const client = new NoteClient({ accessToken: tokens.accessToken || process.env.NOTE_API_TOKEN });
      if (!client.accessToken) return res.status(400).json({ success: false, error: 'Note API token not provided' });

      const result = await client.createPost(title, content);
      res.json({ success: true, result });
    } catch (error) {
      console.error('note post error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Blog publish (HTML generate + simulated social posts)
  app.post('/api/blog/publish', async (req, res) => {
    try {
      const { blogData, socialSettings = {}, platforms = {} } = req.body || {};
      if (!blogData || !blogData.title) {
        return res.status(400).json({ success: false, error: 'blogData.title is required' });
      }

      const generator = new BlogGenerator(blogData);
      const filePath = await generator.saveToFile();

      const results = {
        blog: {
          success: true,
          file: generator.filename,
          url: `${(socialSettings.websiteUrl || '').replace(/\/$/, '')}/blog/${generator.filename}`,
        },
        social: {},
      };

      // X
      if (platforms.twitter) {
        try {
          const client = new TwitterClient({
            apiKey: socialSettings.twitterApiKey || process.env.TW_CONSUMER_KEY,
            apiSecret: socialSettings.twitterApiSecret || process.env.TW_CONSUMER_SECRET,
            accessToken: socialSettings.twitterAccessToken || process.env.TW_ACCESS_TOKEN,
            accessTokenSecret: socialSettings.twitterAccessTokenSecret || process.env.TW_ACCESS_SECRET,
            bearerToken: socialSettings.twitterBearerToken || process.env.TW_BEARER_TOKEN,
          });
          const tweetText = blogData.twitterText || blogData.title;
          const r = await client.postTweet(tweetText);
          results.social.twitter = { success: true, data: r.data };
        } catch (e) {
          results.social.twitter = { success: false, error: e.message };
        }
      }

      // note
      if (platforms.note) {
        try {
          const client = new NoteClient({ accessToken: socialSettings.noteApiToken || process.env.NOTE_API_TOKEN });
          const intro = blogData.noteIntro || '';
          const outro = blogData.noteOutro || '';
          const body = `${intro}\n\n${blogData.excerpt || ''}\n\n${outro}`;
          const r = await client.createPost(blogData.title, body);
          results.social.note = { success: true, data: r.data };
        } catch (e) {
          results.social.note = { success: false, error: e.message };
        }
      }

      res.json(results);
    } catch (error) {
      console.error('publish error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return app;
}

function start(port = process.env.PORT || 3001) {
  const app = buildApp();
  app.listen(port, () => {
    console.log(`🚀 API server running at http://localhost:${port}`);
    console.log(`🧪 Health: http://localhost:${port}/api/health`);
    console.log(`📝 Admin (if present): http://localhost:${port}/blog-admin.html or /削除推奨/blog-admin.html`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { buildApp, start, TwitterClient, NoteClient, BlogGenerator };

