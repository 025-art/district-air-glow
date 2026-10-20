import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import {
  GRADE_INFO,
  hourLabel,
  maskGrade,
  pm10ToGrade,
  pm25ToGrade,
  pushRecent,
  relativeLabel,
  type AirData,
  type Grade,
} from "@/lib/air";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "우리 동네 대기질 알리미" },
      { name: "description", content: "자치구별 실시간 미세먼지·대기질 정보와 마스크 착용 가이드" },
      { property: "og:title", content: "우리 동네 대기질 알리미" },
      { property: "og:description", content: "자치구별 실시간 미세먼지·대기질 정보와 마스크 착용 가이드" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const RECENT_KEY = "air:recent";
const THEME_KEY = "air:theme";

function toneOf(g: Grade | null) {
  return g ? GRADE_INFO[g].tone : "none";
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    const d = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);
  const toggle = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    localStorage.setItem(THEME_KEY, d ? "dark" : "light");
  };
  return (
    <button
      onClick={toggle}
      aria-label="테마 전환"
      className="theme-t relative flex h-9 w-16 items-center rounded-full border bg-secondary px-1"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-card text-sm shadow transition-transform duration-300 ${dark ? "translate-x-7" : ""}`}
      >
        {dark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

function Index() {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [data, setData] = useState<AirData | null>(null);
  const [loading, setLoading] = useState(false);
  const [netError, setNetError] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const reqId = useRef(0);

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
    } catch {
      /* ignore */
    }
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const saveRecent = (list: string[]) => {
    setRecent(list);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  };

  const load = useCallback(
    async (name: string) => {
      const district = name.trim();
      if (!district) return;
      const id = ++reqId.current;
      setCurrent(district);
      setLoading(true);
      setMsg(null);
      try {
        const res = await fetch(`/api/public/air?district=${encodeURIComponent(district)}`);
        const body = await res.json().catch(() => ({}));
        if (id !== reqId.current) return;
        if (res.status >= 500 || !res.ok && res.status !== 404 && res.status !== 400) {
          setNetError(true);
        } else if (!res.ok) {
          setNetError(false);
          setData(null);
          setMsg(body.error || "조회에 실패했습니다.");
        } else {
          setNetError(false);
          setData(body.data);
          setNow(Date.now());
          setRecent((prev) => {
            const next = pushRecent(prev, district);
            localStorage.setItem(RECENT_KEY, JSON.stringify(next));
            return next;
          });
        }
      } catch {
        if (id === reqId.current) setNetError(true);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [],
  );

  const showStale = netError && data;
  const showEmptyError = netError && !data && !loading;

  return (
    <div className="theme-t min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">우리 동네 대기질 알리미</h1>
          <p className="text-xs text-muted-foreground">에어코리아 실시간 측정 정보</p>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-5 py-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(query);
          }}
          className="flex gap-2"
        >
          <div className="theme-t flex flex-1 items-center gap-2 rounded-xl border bg-card px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="자치구 입력 (예: 강남구)"
              className="h-11 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-xl bg-primary px-5 font-medium text-primary-foreground disabled:opacity-60"
          >
            조회
          </button>
        </form>

        {recent.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-2">
            {recent.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setQuery(r);
                  load(r);
                }}
                className="theme-t flex items-center gap-1 rounded-full border bg-card py-1 pl-3 pr-1.5 text-sm hover:bg-accent"
              >
                {r}
                <span
                  role="button"
                  aria-label={`${r} 삭제`}
                  onClick={(e) => {
                    e.stopPropagation();
                    saveRecent(recent.filter((x) => x !== r));
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        )}

        {showStale && (
          <div className="rounded-xl bg-warn px-4 py-3 text-sm text-warn-foreground">
            ⚠️ 최신 정보를 가져오지 못했습니다. 마지막으로 조회된 정보를 표시합니다.
          </div>
        )}

        {msg && <div className="rounded-xl border bg-card px-4 py-6 text-center text-muted-foreground">{msg}</div>}

        {showEmptyError && (
          <div className="rounded-2xl border bg-card px-6 py-12 text-center">
            <p className="mb-4">📡 대기질 정보를 제공하는 공공데이터 서버 응답이 지연되고 있습니다.</p>
            <button
              onClick={() => current && load(current)}
              className="rounded-xl bg-primary px-5 py-2 text-primary-foreground"
            >
              🔄 다시 시도
            </button>
          </div>
        )}

        {!data && !netError && !msg && (
          loading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground">조회할 자치구를 입력해 주세요 🌤️</div>
          )
        )}

        {data && <Result data={data} now={now} loading={loading} onRefresh={() => load(data.district)} />}
      </main>
    </div>
  );
}

function Result({
  data,
  now,
  loading,
  onRefresh,
}: {
  data: AirData;
  now: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  const refreshBtn = (label: string) => (
    <button
      onClick={onRefresh}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-60"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      {label}
    </button>
  );

  if (data.maintenance) {
    return (
      <div className="theme-t space-y-4 rounded-2xl border bg-card p-6">
        <p className="leading-relaxed">
          🛠️ 현재 {data.district} 측정소의 정기 점검 또는 통신 장애로 인해 실시간 대기질 정보를 불러올 수
          없습니다. 점검이 완료되면 자동으로 정상 반영됩니다.
        </p>
        {refreshBtn("다시 불러오기")}
      </div>
    );
  }

  const mg = maskGrade(data);
  const cai = data.khaiGrade ?? mg;
  const p10g = data.pm10Grade ?? pm10ToGrade(data.pm10);
  const p25g = data.pm25Grade ?? pm25ToGrade(data.pm25);

  return (
    <div className="space-y-4">
      <section className={`theme-t tone-${toneOf(cai)} rounded-2xl border bg-card p-6`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{data.district}</h2>
            <p className="text-xs text-muted-foreground">
              측정 기준 {hourLabel(data.dataTime)} · {relativeLabel(data.fetchedAt, now)}
            </p>
          </div>
          {refreshBtn("새로고침")}
        </div>
        <div className="mt-6 flex items-end gap-4">
          <div className="tone-text text-5xl font-bold">{cai ? GRADE_INFO[cai].label : "측정 불가"}</div>
          <div className="pb-1 text-sm text-muted-foreground">
            통합대기환경지수 {data.khai ?? "-"}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Metric name="미세먼지 PM10" value={data.pm10} unit="㎍/㎥" grade={p10g} big />
        <Metric name="초미세먼지 PM2.5" value={data.pm25} unit="㎍/㎥" grade={p25g} big />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric name="오존 O₃" value={data.o3} unit="ppm" />
        <Metric name="이산화질소 NO₂" value={data.no2} unit="ppm" />
        <Metric name="일산화탄소 CO" value={data.co} unit="ppm" />
        <Metric name="아황산가스 SO₂" value={data.so2} unit="ppm" />
      </div>

      {mg && (
        <>
          <div className={`tone-${toneOf(mg)} tone-bg rounded-2xl px-5 py-4 font-medium`}>
            {GRADE_INFO[mg].mask}
          </div>
          <div className={`tone-${toneOf(mg)} tone-soft tone-border rounded-2xl border px-5 py-4`}>
            <p className="tone-text mb-1 text-sm font-semibold">생활 행동 요령</p>
            {GRADE_INFO[mg].tips.map((t) => (
              <p key={t} className="text-sm leading-relaxed">
                {t}
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  name,
  value,
  unit,
  grade,
  big,
}: {
  name: string;
  value: number | null;
  unit: string;
  grade?: Grade | null;
  big?: boolean;
}) {
  const missing = value === null;
  return (
    <div className={`theme-t tone-${toneOf(grade ?? null)} rounded-2xl border bg-card p-4`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{name}</p>
        {missing ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">[측정 불가]</span>
        ) : (
          grade && (
            <span className="tone-bg rounded-full px-2 py-0.5 text-[10px] font-medium">
              {GRADE_INFO[grade].label}
            </span>
          )
        )}
      </div>
      <p className={`mt-2 font-bold ${big ? "tone-text text-3xl" : "text-xl"}`}>
        {missing ? "-" : value}
        <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}
