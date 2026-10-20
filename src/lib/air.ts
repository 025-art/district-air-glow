export type Grade = 1 | 2 | 3 | 4;

export interface AirData {
  district: string;
  stationName: string;
  dataTime: string | null;
  pm10: number | null;
  pm25: number | null;
  o3: number | null;
  no2: number | null;
  co: number | null;
  so2: number | null;
  khai: number | null;
  khaiGrade: Grade | null;
  pm10Grade: Grade | null;
  pm25Grade: Grade | null;
  maintenance: boolean;
  fetchedAt: number;
}

export function parseNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseGrade(v: unknown): Grade | null {
  const n = parseNum(v);
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : null;
}

/** PM10 grade by Korean standard (㎍/㎥) */
export function pm10ToGrade(v: number | null): Grade | null {
  if (v === null) return null;
  if (v <= 30) return 1;
  if (v <= 80) return 2;
  if (v <= 150) return 3;
  return 4;
}

/** PM2.5 grade by Korean standard (㎍/㎥) */
export function pm25ToGrade(v: number | null): Grade | null {
  if (v === null) return null;
  if (v <= 15) return 1;
  if (v <= 35) return 2;
  if (v <= 75) return 3;
  return 4;
}

/** Mask guidance uses the worse of the received PM10 / PM2.5 grades. */
export function maskGrade(d: Pick<AirData, "pm10" | "pm25" | "pm10Grade" | "pm25Grade">): Grade | null {
  const a = d.pm10Grade ?? pm10ToGrade(d.pm10);
  const b = d.pm25Grade ?? pm25ToGrade(d.pm25);
  if (a === null && b === null) return null;
  return Math.max(a ?? 0, b ?? 0) as Grade;
}

export const GRADE_INFO: Record<Grade, { label: string; tone: string; mask: string; tips: string[] }> = {
  1: {
    label: "좋음",
    tone: "good",
    mask: "마스크 없이 상쾌한 외출이 가능해요! 🌿",
    tips: ["환기와 야외활동 모두 좋아요.", "실내 공기를 환기하기에 적합합니다."],
  },
  2: {
    label: "보통",
    tone: "moderate",
    mask: "일반적인 야외활동이 가능해요. 민감군은 마스크 준비 권장 🙂",
    tips: ["일반적인 야외활동이 가능합니다.", "민감군은 장시간 야외활동을 줄이세요."],
  },
  3: {
    label: "나쁨",
    tone: "bad",
    mask: "KF80 이상의 보건용 마스크를 반드시 착용하세요! 😷",
    tips: ["환기는 짧게 끝내세요.", "어린이·노약자는 실외 활동을 자제하세요."],
  },
  4: {
    label: "매우나쁨",
    tone: "verybad",
    mask: "외출을 자제하고, 외출 시 KF94 마스크 착용 필수 🚨",
    tips: ["창문을 닫고 실내에 머무르세요.", "외출 후에는 손과 얼굴을 깨끗이 씻으세요."],
  },
};

/** LRU recent list, max 3, no duplicates. */
export function pushRecent(list: string[], name: string, max = 3): string[] {
  return [name, ...list.filter((x) => x !== name)].slice(0, max);
}

export function relativeLabel(fetchedAt: number, now: number): string {
  const mins = Math.floor((now - fetchedAt) / 60000);
  return mins < 1 ? "방금 전 갱신" : `${mins}분 전 갱신`;
}

/** dataTime "2026-10-20 16:00" -> "16시" */
export function hourLabel(dataTime: string | null): string {
  if (!dataTime) return "-";
  const m = dataTime.match(/(\d{1,2}):\d{2}$/);
  return m ? `${Number(m[1])}시` : dataTime;
}
