import { useState, useMemo } from "react";
import { isMobile } from "react-device-detect";

import "../Styles/ReportsMain.css";

/* ---------------------------------------------------------------------- */
/*  Date range presets                                                    */
/* ---------------------------------------------------------------------- */
const RANGE_PRESETS = [
  { id: "last7", label: "Last 7 Days" },
  { id: "last30", label: "Last 30 Days" },
  { id: "thisMonth", label: "This Month" },
  { id: "month", label: "Particular Month" },
  { id: "custom", label: "Custom Range" },
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_RANGE_DAYS = 366; // safety cap so a bad custom range can't loop forever

function ReportsMain({ goalsList = [] }) {
  const [rangeType, setRangeType] = useState("last7");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  /* -------------------------- date helpers ----------------------------- */

  const getLocalISODate = (d = new Date()) => {
    const offsetMs = d.getTimezoneOffset() * 60000; // e.g. -330 min for IST
    return new Date(d.getTime() - offsetMs).toISOString().split("T")[0];
  };

  const parseLocalDate = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const addDays = (dateStr, delta) => {
    const d = parseLocalDate(dateStr);
    d.setDate(d.getDate() + delta);
    return getLocalISODate(d);
  };

  const formatDateShort = (dateStr) => {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const pad2 = (n) => String(n).padStart(2, "0");

  const today = getLocalISODate();
  const currentMonthStr = today.slice(0, 7); // "YYYY-MM"

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr); // for "Particular Month"

  /* -------------------------- calendar month meta ------------------------ */

  const isCalendarMode = rangeType === "thisMonth" || rangeType === "month";

  const calendarMeta = useMemo(() => {
    if (!isCalendarMode) return null;

    const monthStr = rangeType === "thisMonth" ? currentMonthStr : (selectedMonth || currentMonthStr);
    const [yearStr, monStr] = monthStr.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monStr) - 1; // 0-based

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const leadingBlanks = new Date(year, monthIndex, 1).getDay(); // 0 = Sun
    const label = new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    const monthStart = `${yearStr}-${pad2(monthIndex + 1)}-01`;
    const monthEnd = `${yearStr}-${pad2(monthIndex + 1)}-${pad2(daysInMonth)}`;

    return { year, monthIndex, daysInMonth, leadingBlanks, label, monthStart, monthEnd };
  }, [isCalendarMode, rangeType, selectedMonth, currentMonthStr]);

  /* -------------------------- resolved range ---------------------------- */

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (calendarMeta) return { rangeStart: calendarMeta.monthStart, rangeEnd: calendarMeta.monthEnd };

    switch (rangeType) {
      case "last7":
        return { rangeStart: addDays(today, -6), rangeEnd: today };
      case "last30":
        return { rangeStart: addDays(today, -29), rangeEnd: today };
      case "custom":
        return { rangeStart: customStart, rangeEnd: customEnd };
      default:
        return { rangeStart: today, rangeEnd: today };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeType, customStart, customEnd, today, calendarMeta]);

  const dateList = useMemo(() => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return [];
    const dates = [];
    let cursor = rangeStart;
    let guard = 0;
    while (cursor <= rangeEnd && guard < MAX_RANGE_DAYS) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
      guard++;
    }
    return dates;
  }, [rangeStart, rangeEnd]);

  /* -------------------------- goal helpers ------------------------------ */

  const isGoalOnDate = (goal, dateStr) => {
    const { type, days, dates, from, to } = goal.schedule || {};
    switch (type) {
      case "everyday":
        return true;
      case "days": {
        const dow = parseLocalDate(dateStr).getDay(); // 0 = Sun ... 6 = Sat
        return (days || []).includes(dow);
      }
      case "dates":
        return (dates || []).includes(dateStr);
      case "range": {
        if (!from) return false;
        const afterStart = dateStr >= from;
        const beforeEnd = !to || dateStr <= to;
        return afterStart && beforeEnd;
      }
      default:
        return true; // fall back to "everyday" for goals without a schedule
    }
  };

  const isGoalCompletedOnDate = (goal, dateStr) => {
    if ((goal.goalType || "checklist") === "tracker") {
      const val = (goal.trackerValues || {})[dateStr];
      return val !== undefined && val !== null && val !== "" && Number(val) > 0;
    }
    return (goal.completedDates || []).includes(dateStr);
  };

  /* -------------------------------------------------------------------- */

  const rangeIsValid = dateList.length > 0;

  return (
    <div className={`reportsMainWidget ${isMobile ? "mobile" : "desk"}`}>
      <div className="reportsRangePicker">
        <div className="repeatSegment reportsRangeSegment" role="tablist" aria-label="Report date range">
          {RANGE_PRESETS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={rangeType === opt.id}
              className={`repeatSegBtn reportsRangeBtn ${rangeType === opt.id ? "repeatSegBtnActive reportsRangeBtnActive" : ""}`}
              onClick={() => setRangeType(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {rangeType === "month" && (
          <div className="repeatSubPanel reportsCustomRange">
            <input
              type="month"
              className="repeatInput repeatDateInput"
              max={currentMonthStr}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || currentMonthStr)}
            />
          </div>
        )}

        {rangeType === "custom" && (
          <div className="repeatSubPanel repeatRangeRow reportsCustomRange">
            <div className="repeatRangeField">
              <span className="repeatRangeLabel" style={{fontSize:"12px",marginRight:"10px"}}>From</span>
              <input
                type="date"
                className="repeatInput repeatDateInput"
                max={customEnd || undefined}
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="repeatRangeField" style={{margin:"10px 0"}}>
              <span className="repeatRangeLabel" style={{fontSize:"12px",marginRight:"10px"}}>To</span>
              <input
                type="date"
                className="repeatInput repeatDateInput"
                min={customStart || undefined}
                max={today}
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}

        {rangeIsValid && (
          <span className="reportsRangeSummary">
            {calendarMeta ? calendarMeta.label : `${formatDateShort(rangeStart)} – ${formatDateShort(rangeEnd)}`}
          </span>
        )}
      </div>

      <div className="reportsGoalsList">
        {!rangeIsValid ? (
          <div className="reportsEmptyState">
            {rangeType === "custom"
              ? "Pick a start and end date to see the report."
              : "No data for this range."}
          </div>
        ) : goalsList.length === 0 ? (
          <div className="reportsEmptyState">No goals to report on yet.</div>
        ) : (
          <>
            <GoodDaysCard
              goalsList={goalsList}
              dateList={dateList}
              calendarMeta={calendarMeta}
              isGoalOnDate={isGoalOnDate}
              isGoalCompletedOnDate={isGoalCompletedOnDate}
              formatDateShort={formatDateShort}
            />
            {goalsList.map((goal) =>
            (goal.goalType || "checklist") === "tracker" ? (
              <TrackerGoalReport
                key={goal.id}
                goal={goal}
                dateList={dateList}
                isGoalOnDate={isGoalOnDate}
                formatDateShort={formatDateShort}
              />
            ) : (
              <ChecklistGoalReport
                key={goal.id}
                goal={goal}
                dateList={dateList}
                calendarMeta={calendarMeta}
                isGoalOnDate={isGoalOnDate}
                isGoalCompletedOnDate={isGoalCompletedOnDate}
                formatDateShort={formatDateShort}
              />
            )
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Shared calendar-style block grid (used for both goal types in month   */
/*  view) — leading blanks align the 1st of the month to its weekday.     */
/* ---------------------------------------------------------------------- */

function CalendarBlockGrid({ calendarMeta, dateList, getCellState }) {
  return (
    <div className="calendarGrid">
      <div className="calendarWeekdayRow">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="calendarWeekdayLabel">
            {d}
          </span>
        ))}
      </div>
      <div className="calendarDaysGrid">
        {Array.from({ length: calendarMeta.leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} className="reportSquare reportSquareBlank" />
        ))}
        {dateList.map((dateStr) => {
          const { status, title } = getCellState(dateStr);
          const dayNum = Number(dateStr.split("-")[2]);
          return (
            <div
              key={dateStr}
              className={`reportSquare reportSquareCal reportSquare-${status}`}
              title={title}
            >
              <span className="reportSquareDayNum">{dayNum}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Checkbox goal report                                                  */
/* ---------------------------------------------------------------------- */

function ChecklistGoalReport({ goal, dateList, calendarMeta, isGoalOnDate, isGoalCompletedOnDate, formatDateShort }) {
  const scheduledDates = useMemo(
    () => dateList.filter((d) => isGoalOnDate(goal, d)),
    [dateList, goal, isGoalOnDate]
  );

  const completedCount = useMemo(
    () => scheduledDates.filter((d) => isGoalCompletedOnDate(goal, d)).length,
    [scheduledDates, goal, isGoalCompletedOnDate]
  );

  const getCellState = (dateStr) => {
    if (!isGoalOnDate(goal, dateStr)) {
      return { status: "inactive", title: `${formatDateShort(dateStr)} · Not scheduled` };
    }
    const done = isGoalCompletedOnDate(goal, dateStr);
    return {
      status: done ? "done" : "missed",
      title: `${formatDateShort(dateStr)} · ${done ? "Done" : "Not done"}`,
    };
  };

  return (
    <div className="reportGoalCard">
      <div className="reportGoalHeader">
        <span className="reportGoalTitle">{goal.title}</span>
        <span className="reportGoalStat">
          {scheduledDates.length === 0 ? "—" : `${completedCount} / ${scheduledDates.length}`}
        </span>
      </div>

      {calendarMeta ? (
        <CalendarBlockGrid calendarMeta={calendarMeta} dateList={dateList} getCellState={getCellState} />
      ) : scheduledDates.length === 0 ? (
        <div className="reportsEmptyState small">Not scheduled in this range</div>
      ) : (
        <div className="reportSquareGrid">
          {scheduledDates.map((d) => {
            const done = isGoalCompletedOnDate(goal, d);
            return (
              <div
                key={d}
                className={`reportSquare ${done ? "reportSquareFilled" : ""}`}
                title={`${formatDateShort(d)} · ${done ? "Done" : "Not done"}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Tracker goal report — always an SVG bar chart (checkbox goals get the */
/*  calendar grid in month views, but a chart tells you far more for a    */
/*  count/time goal, so trackers keep the chart in every range mode).     */
/* ---------------------------------------------------------------------- */

function TrackerGoalReport({ goal, dateList, isGoalOnDate, formatDateShort }) {
  const scheduledDates = useMemo(
    () => dateList.filter((d) => isGoalOnDate(goal, d)),
    [dateList, goal, isGoalOnDate]
  );

  const values = useMemo(
    () => scheduledDates.map((d) => Number((goal.trackerValues || {})[d]) || 0),
    [scheduledDates, goal]
  );

  // Min/avg/max are computed from days that actually have a logged value —
  // days that were scheduled but never logged would otherwise drag min to 0
  // and make the stats meaningless.
  const loggedValues = values.filter((v) => v > 0);
  const hasLoggedValues = loggedValues.length > 0;
  const avgVal = hasLoggedValues
    ? (loggedValues.reduce((sum, v) => sum + v, 0) / loggedValues.length).toFixed(1)
    : null;
  const minVal = hasLoggedValues ? Math.min(...loggedValues) : null;
  const maxVal = hasLoggedValues ? Math.max(...loggedValues) : null;

  const chartScaleMax = Math.max(1, ...values);
  const unit = goal.trackerUnit === "time" ? "mins" : "";
  const fmtStat = (n) => `${n}${unit ? ` ${unit}` : ""}`;

  // chart geometry
  const barGap = 4;
  const barWidth = 14;
  const chartHeight = 90;
  const chartWidth = Math.max(scheduledDates.length * (barWidth + barGap), 100);
  const labelEvery = Math.max(1, Math.ceil(scheduledDates.length / 8));

  return (
    <div className="reportGoalCard">
      <div className="reportGoalHeader">
        <span className="reportGoalTitle">{goal.title}</span>
        <span className="reportGoalStat">
          {hasLoggedValues ? `avg ${fmtStat(avgVal)}` : "—"}
        </span>
      </div>

      {hasLoggedValues && (
        <div className="reportTrackerStatsRow">
          <span className="reportTrackerStatChip">Min: {fmtStat(minVal)}</span>
          <span className="reportTrackerStatChip">Max: {fmtStat(maxVal)}</span>
        </div>
      )}

      {scheduledDates.length === 0 ? (
        <div className="reportsEmptyState small">Not scheduled in this range</div>
      ) : (
        <div className="reportChartScroll">
          <svg
            className="reportTrackerChart"
            width={chartWidth}
            height={chartHeight + 24}
            viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`}
          >
            {scheduledDates.map((d, i) => {
              const val = values[i];
              const barHeight = val === 0 ? 0 : Math.max(2, (val / chartScaleMax) * chartHeight);
              const x = i * (barWidth + barGap);
              const y = chartHeight - barHeight;
              const showLabel = i % labelEvery === 0 || i === scheduledDates.length - 1;

              return (
                <g key={d}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={3}
                    className={val > 0 ? "reportBar" : "reportBarEmpty"}
                  >
                    <title>{`${formatDateShort(d)}: ${val}${unit ? ` ${unit}` : ""}`}</title>
                  </rect>
                  {showLabel && (
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight + 16}
                      textAnchor="middle"
                      className="reportBarLabel"
                    >
                      {formatDateShort(d)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Good Days — days where every goal scheduled for that day was          */
/*  completed (checkbox goals: checked; tracker goals: logged > 0).       */
/* ---------------------------------------------------------------------- */

function GoodDaysCard({ goalsList, dateList, calendarMeta, isGoalOnDate, isGoalCompletedOnDate, formatDateShort }) {
  const dayStatuses = useMemo(() => {
    return dateList.map((dateStr) => {
      const scheduledGoals = goalsList.filter((g) => isGoalOnDate(g, dateStr));
      const applicable = scheduledGoals.length > 0;
      const allDone = applicable && scheduledGoals.every((g) => isGoalCompletedOnDate(g, dateStr));
      return { dateStr, applicable, allDone };
    });
  }, [goalsList, dateList, isGoalOnDate, isGoalCompletedOnDate]);

  const applicableDays = dayStatuses.filter((d) => d.applicable);
  const goodDays = applicableDays.filter((d) => d.allDone);

  const getCellState = (dateStr) => {
    const status = dayStatuses.find((d) => d.dateStr === dateStr);
    if (!status || !status.applicable) {
      return { status: "inactive", title: `${formatDateShort(dateStr)} · No goals scheduled` };
    }
    return {
      status: status.allDone ? "done" : "missed",
      title: `${formatDateShort(dateStr)} · ${status.allDone ? "Good day! All goals met" : "Not all goals met"}`,
    };
  };

  return (
    <div className="reportGoalCard reportsGoodDaysCard">
      <div className="reportGoalHeader">
        <span className="reportGoalTitle">🎯 Good Days</span>
        <span className="reportGoalStat">
          {applicableDays.length === 0 ? "—" : `${goodDays.length} / ${applicableDays.length}`}
        </span>
      </div>

      {applicableDays.length === 0 ? (
        <div className="reportsEmptyState small">No goals scheduled in this range</div>
      ) : calendarMeta ? (
        <CalendarBlockGrid calendarMeta={calendarMeta} dateList={dateList} getCellState={getCellState} />
      ) : (
        <div className="reportSquareGrid">
          {applicableDays.map(({ dateStr, allDone }) => (
            <div
              key={dateStr}
              className={`reportSquare ${allDone ? "reportSquareFilled" : ""}`}
              title={`${formatDateShort(dateStr)} · ${allDone ? "Good day!" : "Not all goals met"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ReportsMain;