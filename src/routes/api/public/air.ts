import { createFileRoute } from "@tanstack/react-router";
import { parseGrade, parseNum, type AirData } from "@/lib/air";

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: AirData }>();

function allowedHost(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.dev")
  );
}

function isAllowed(request: Request) {
  const src = request.headers.get("origin") || request.headers.get("referer");
  if (!src) return false;
  try {
    const u = new URL(src);
    const self = new URL(request.url);
    return u.host === self.host || allowedHost(u.hostname);
  } catch {
    return false;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const Route = createFileRoute("/api/public/air")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAllowed(request)) return json({ error: "forbidden" }, 403);

        const district = (new URL(request.url).searchParams.get("district") || "").trim();
        if (!district || district.length > 20) return json({ error: "자치구명을 입력해 주세요." }, 400);

        const hit = cache.get(district);
        if (hit && Date.now() - hit.at < TTL) return json({ data: hit.data, cached: true });

        const key = process.env.AIRKOREA_API_KEY;
        if (!key) return json({ error: "API 키가 설정되지 않았습니다." }, 500);

        const qs = new URLSearchParams({
          returnType: "json",
          numOfRows: "1",
          pageNo: "1",
          stationName: district,
          dataTerm: "DAILY",
          ver: "1.3",
        });
        const url = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?serviceKey=${encodeURIComponent(
          key,
        )}&${qs}`;

        try {
          const res = await fetch(url);
          if (!res.ok) return json({ error: "upstream" }, 502);
          const text = await res.text();
          let body: any;
          try {
            body = JSON.parse(text);
          } catch {
            return json({ error: "upstream" }, 502);
          }
          const item = body?.response?.body?.items?.[0];
          if (!item) return json({ error: `'${district}' 측정소를 찾을 수 없습니다.` }, 404);

          const pm10 = parseNum(item.pm10Value);
          const pm25 = parseNum(item.pm25Value);
          const flagged = [item.pm10Flag, item.pm25Flag].some((f) => f && String(f).trim() !== "");
          const data: AirData = {
            district,
            stationName: item.stationName ?? district,
            dataTime: item.dataTime ?? null,
            pm10,
            pm25,
            o3: parseNum(item.o3Value),
            no2: parseNum(item.no2Value),
            co: parseNum(item.coValue),
            so2: parseNum(item.so2Value),
            khai: parseNum(item.khaiValue),
            khaiGrade: parseGrade(item.khaiGrade),
            pm10Grade: parseGrade(item.pm10Grade),
            pm25Grade: parseGrade(item.pm25Grade),
            maintenance: (pm10 === null && pm25 === null) || (flagged && pm10 === null && pm25 === null),
            fetchedAt: Date.now(),
          };
          cache.set(district, { at: Date.now(), data });
          return json({ data, cached: false });
        } catch {
          return json({ error: "upstream" }, 502);
        }
      },
    },
  },
});
