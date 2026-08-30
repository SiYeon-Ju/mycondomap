const ALLOWED_ORIGINS = [
  "https://siyeon-ju.github.io",
  "http://localhost:8080",
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers });
    }

    const stops = body.stops;
    if (!Array.isArray(stops) || stops.length === 0) {
      return new Response(JSON.stringify({ error: "stops가 필요합니다" }), { status: 400, headers });
    }

    const seedText = stops.map(s => `${s.name} (${s.lat}, ${s.lng})`).join(", ");
    const prompt = `다음은 한국 여행 일정에 이미 담긴 장소들이야: ${seedText}
이 장소들 근처에 실제로 존재하는 관광지, 맛집, 카페 중 딱 3곳을 추천해줘.
반드시 아래 JSON 배열 형식으로만 답해. 다른 설명 문장은 절대 쓰지 마:
[{"name": "정확한 상호명", "reason": "한국어로 한 문장 추천 이유", "suggestedTime": "HH:MM"}]`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
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
      return new Response(JSON.stringify({ error: `Gemini API 오류 ${geminiRes.status}`, detail: errText.slice(0, 300) }), {
        status: 502, headers,
      });
    }

    const data = await geminiRes.json();
    const text = data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;

    let suggestions;
    try {
      suggestions = JSON.parse(text || "[]");
    } catch (e) {
      return new Response(JSON.stringify({ error: "AI 응답 해석 실패" }), { status: 502, headers });
    }

    return new Response(JSON.stringify({ suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 3) : [] }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  },
};
