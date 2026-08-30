const ALLOWED_ORIGINS = [
  "https://siyeon-ju.github.io",
  "http://localhost:8080",
];

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const stops = req.body && req.body.stops;
  if (!Array.isArray(stops) || stops.length === 0) {
    return res.status(400).json({ error: "stops가 필요합니다" });
  }

  const seedText = stops.map(s => `${s.name} (${s.lat}, ${s.lng})`).join(", ");
  const prompt = `다음은 한국 여행 일정에 이미 담긴 장소들이야: ${seedText}
이 장소들 좌표 기준 반경 1km 이내(도보로 갈 수 있는 거리)에 실제로 존재하는 관광지, 액티비티, 맛집, 카페 중 최대 5곳을 추천해줘.
같은 이름의 장소가 다른 지역에도 있을 수 있으니, 반드시 위에 준 좌표와 실제로 가까운 곳만 추천해 — 이름만 비슷하고 먼 지역에 있는 곳은 절대 추천하지 마.
호텔/콘도/리조트/펜션 등 숙박시설은 절대 추천하지 마 — 숙소는 이미 다 정해져 있어서 필요 없어.
1km 이내에 추천할 만한 곳이 없으면 억지로 채우지 말고 빈 배열을 반환해.
반드시 아래 JSON 배열 형식으로만 답해. 다른 설명 문장은 절대 쓰지 마:
[{"name": "정확한 상호명", "reason": "한국어로 한 문장 추천 이유", "suggestedTime": "HH:MM"}]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const geminiRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return res.status(502).json({ error: `Gemini API 오류 ${geminiRes.status}`, detail: errText.slice(0, 300) });
  }

  const data = await geminiRes.json();
  const text = data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;

  let suggestions;
  try {
    suggestions = JSON.parse(text || "[]");
  } catch (e) {
    return res.status(502).json({ error: "AI 응답 해석 실패" });
  }

  return res.status(200).json({ suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 5) : [] });
}
