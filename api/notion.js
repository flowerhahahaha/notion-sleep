const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DB_ID;
const headers = {
  "Authorization": `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  res.setHeader("Cache-Control", "no-store");

  try {
    // GET - 查询某周数据
    if (req.method === "GET") {
      const { start, end } = req.query;
      const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filter: {
            and: [
              { property: "日期", date: { on_or_after: start } },
              { property: "日期", date: { on_or_before: end } },
            ]
          },
          page_size: 100,
        }),
      });
      const data = await response.json();
      if (data.object === "error") return res.status(400).json({ error: data.message });

      const result = {};
      for (const page of data.results || []) {
        const props = page.properties;
        const dateVal = props["日期"]?.date?.start;
        if (!dateVal) continue;
        const sleepStart = props["入睡时间"]?.rich_text?.[0]?.text?.content || "";
        const sleepEnd   = props["起床时间"]?.rich_text?.[0]?.text?.content || "";
        const score      = props["评分"]?.number ?? "";
        result[dateVal] = { pageId: page.id, start: sleepStart, end: sleepEnd, score };
      }
      return res.status(200).json(result);
    }

    // POST - 新建或更新
    if (req.method === "POST") {
      const { pageId, date, sleepStart, sleepEnd, score } = req.body;
      const properties = {
        "日期":     { date: { start: date } },
        "入睡时间": { rich_text: [{ text: { content: sleepStart } }] },
        "起床时间": { rich_text: [{ text: { content: sleepEnd } }] },
        "评分":     { number: score !== "" ? Number(score) : null },
      };

      let response;
      if (pageId) {
        response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ properties }),
        });
      } else {
        response = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers,
          body: JSON.stringify({ parent: { database_id: DATABASE_ID }, properties }),
        });
      }
      const data = await response.json();
      if (data.object === "error") return res.status(400).json({ error: data.message });
      return res.status(200).json({ success: true, pageId: data.id });
    }

    // DELETE - 归档
    if (req.method === "DELETE") {
      const { pageId } = req.body;
      const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ archived: true }),
      });
      const data = await response.json();
      if (data.object === "error") return res.status(400).json({ error: data.message });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("服务器错误:", err);
    return res.status(500).json({ error: err.message });
  }
}
