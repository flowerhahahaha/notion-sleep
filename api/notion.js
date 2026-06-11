export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const TOKEN = process.env.NOTION_TOKEN;
  const DB_ID = process.env.NOTION_DB_ID;
  const NOTION = 'https://api.notion.com/v1';
  const HEADERS = {
    'Authorization': `Bearer ${TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  try {
    // GET: 查询某周的记录
    if (req.method === 'GET') {
      const { start, end } = req.query;
      const body = {
        filter: {
          and: [
            { property: '日期', date: { on_or_after: start } },
            { property: '日期', date: { on_or_before: end } },
          ]
        }
      };
      const r = await fetch(`${NOTION}/databases/${DB_ID}/query`, {
        method: 'POST', headers: HEADERS, body: JSON.stringify(body)
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // POST: 新建或更新记录
    if (req.method === 'POST') {
      const { pageId, date, sleepStart, sleepEnd, score } = req.body;

      const properties = {
        '日期':     { date: { start: date } },
        '入睡时间': { rich_text: [{ text: { content: sleepStart } }] },
        '起床时间': { rich_text: [{ text: { content: sleepEnd } }] },
        '评分':     { number: score !== '' ? Number(score) : null },
      };

      let r;
      if (pageId) {
        // 更新已有页面
        r = await fetch(`${NOTION}/pages/${pageId}`, {
          method: 'PATCH', headers: HEADERS,
          body: JSON.stringify({ properties })
        });
      } else {
        // 新建页面
        r = await fetch(`${NOTION}/pages`, {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({ parent: { database_id: DB_ID }, properties })
        });
      }
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // DELETE: 归档记录
    if (req.method === 'DELETE') {
      const { pageId } = req.body;
      const r = await fetch(`${NOTION}/pages/${pageId}`, {
        method: 'PATCH', headers: HEADERS,
        body: JSON.stringify({ archived: true })
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
