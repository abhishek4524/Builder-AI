import { describe, it, expect } from "vitest";

function calculateStats(countsMap, today = new Date()) {
  function formatDateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const pastYearStartDate = new Date(today);
  pastYearStartDate.setDate(today.getDate() - 365);
  const pastYearStartKey = formatDateKey(pastYearStartDate);
  const todayKey = formatDateKey(today);

  let totalEdits = 0;
  let daysActive = 0;

  for (const [key, cnt] of countsMap.entries()) {
    if (key >= pastYearStartKey && key <= todayKey && cnt > 0) {
      totalEdits += cnt;
      daysActive++;
    }
  }

  const dailyAverage = (totalEdits / 365).toFixed(1);
  const percentOfYear = Math.round((daysActive / 365) * 100);

  let currentStreak = 0;
  const streakCursor = new Date(today);
  const todayCount = countsMap.get(todayKey) || 0;

  if (todayCount > 0) {
    currentStreak++;
    streakCursor.setDate(streakCursor.getDate() - 1);
    while (true) {
      const k = formatDateKey(streakCursor);
      if ((countsMap.get(k) || 0) > 0) {
        currentStreak++;
        streakCursor.setDate(streakCursor.getDate() - 1);
      } else {
        break;
      }
    }
  } else {
    streakCursor.setDate(streakCursor.getDate() - 1);
    const yesterdayKey = formatDateKey(streakCursor);
    if ((countsMap.get(yesterdayKey) || 0) > 0) {
      while (true) {
        const k = formatDateKey(streakCursor);
        if ((countsMap.get(k) || 0) > 0) {
          currentStreak++;
          streakCursor.setDate(streakCursor.getDate() - 1);
        } else {
          break;
        }
      }
    }
  }

  return { totalEdits, dailyAverage, daysActive, percentOfYear, currentStreak };
}

describe("Activity Stats Calculation", () => {
  it("should calculate exact stats matching user screenshot (7 edits, 7 days, 2% of year)", () => {
    const today = new Date("2026-10-27T12:00:00Z");
    const counts = new Map();

    // 7 edits spread across 7 days in September / October
    const activeDates = [
      "2026-09-15",
      "2026-09-18",
      "2026-09-22",
      "2026-09-23",
      "2026-09-25",
      "2026-10-02",
      "2026-10-10",
    ];

    for (const d of activeDates) {
      counts.set(d, 1);
    }

    const res = calculateStats(counts, today);
    expect(res.totalEdits).toBe(7);
    expect(res.daysActive).toBe(7);
    expect(res.dailyAverage).toBe("0.0"); // 7 / 365 = 0.019 -> "0.0"
    expect(res.percentOfYear).toBe(2);   // 7 / 365 * 100 = 1.91% -> 2%
    expect(res.currentStreak).toBe(0);   // Last edit was Oct 10, so current streak = 0
  });

  it("should calculate active streak when edits are on consecutive recent days", () => {
    const today = new Date("2026-10-27T12:00:00Z");
    const counts = new Map();

    counts.set("2026-10-27", 3);
    counts.set("2026-10-26", 2);
    counts.set("2026-10-25", 1);

    const res = calculateStats(counts, today);
    expect(res.totalEdits).toBe(6);
    expect(res.daysActive).toBe(3);
    expect(res.currentStreak).toBe(3);
  });
});
