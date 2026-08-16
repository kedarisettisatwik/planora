import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { isMobile } from "react-device-detect";

import "../Styles/Home.css";
import "../Styles/Events.css";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteField,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase";

// =============================================================
// FIRESTORE SCHEMA
// -------------------------------------------------------------
// {ownerEmail}/Events/Items/{eventId}
//     The single source of truth for an event owned/created by
//     {ownerEmail}. Holds the full recurrence rule, exceptions
//     (per-occurrence edits/cancellations) and the attendee
//     access map.
//
// {attendeeEmail}/Events/SharedWithMe/{ownerEmail__eventId}
//     A denormalized COPY of the same event, written whenever
//     the owner creates/edits/cancels it. This lets a person's
//     calendar be rendered from exactly two collection reads
//     (their own Items + their own SharedWithMe) no matter how
//     many people share events with them - we never need a
//     cross-user / collection-group query just to draw a
//     calendar. The tradeoff is a small fan-out on writes
//     (bounded by attendee count), which is cheap and rare
//     compared to reads (every render / every date change).
//
// {email}/widgets  ->  { "Events.empty": boolean }
//     Same convention as the other widgets in this app.
//
// {email}/Connections/List/{connectionId} -> { email, name }
//     Optional. If present, used to populate the "share with"
//     picker and the "viewing as" scope chips. The widget still
//     works fine (via free-text email entry) if this doesn't
//     exist.
//
// {email}/TeamMembers/List/{memberId} -> { email, name }
//     Optional. Powers the "Share with team" checkbox in the
//     create/edit form - checking it adds every team member as
//     a view-access attendee in one click.
//
// {email}/Events/OccurrenceNotes/{ownerEmail__eventId__date}
//     -> { note, updatedAt }
//     PRIVATE per-occurrence notes. Deliberately NOT fanned out
//     to attendees - it lives only under the viewing user's own
//     path, so it's naturally private even though the event
//     itself is shared. Saved manually (no autosave).
// =============================================================

// ---------------------------------------------------------
// DATE / TIME HELPERS
// ---------------------------------------------------------

const getLocalISODate = (d = new Date()) => {
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().split("T")[0];
};

const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const addDaysISO = (dateStr, n) => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return getLocalISODate(d);
};

const formatMonthLabel = (yyyy_mm) => {
  const [y, m] = yyyy_mm.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
};

const formatDayLabel = (dateStr) =>
  parseLocalDate(dateStr).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const formatTime12 = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const REMINDER_RECURRENCE_OPTIONS = [
  { id: "weekly", label: "Days of week" },
  { id: "dates", label: "Particular dates" },
  { id: "monthly", label: "Every month" },
  { id: "yearly", label: "Every year" },
];

const MEETING_RECURRENCE_OPTIONS = [
  { id: "once", label: "One-off" },
  { id: "daily", label: "Every day" },
  { id: "weekly", label: "Days of week" },
  { id: "monthly", label: "Dates in month" },
];

// ---------------------------------------------------------
// RECURRENCE EXPANSION ENGINE
//
// Pure function: given an event doc and an inclusive date
// range, returns every occurrence date that falls in range,
// after applying per-occurrence exceptions (cancel / postpone).
// ---------------------------------------------------------

const expandOccurrences = (event, rangeStart, rangeEnd) => {
  if (!event || event.seriesCancelled) return [];

  const r = event.recurrence || {};
  const exceptions = event.exceptions || {};
  const rawDates = [];

  switch (r.type) {
    case "once": {
      if (r.date >= rangeStart && r.date <= rangeEnd) rawDates.push(r.date);
      break;
    }

    case "dates": {
      (r.dates || []).forEach((d) => {
        if (d >= rangeStart && d <= rangeEnd) rawDates.push(d);
      });
      break;
    }

    case "daily":
    case "weekly": {
      const from = r.from && r.from > rangeStart ? r.from : rangeStart;
      const to = r.to && r.to < rangeEnd ? r.to : rangeEnd;
      if (r.from && r.from > rangeEnd) break;
      if (r.to && r.to < rangeStart) break;

      let cursor = from;
      let guard = 0;
      while (cursor <= to && guard < 400) {
        guard += 1;
        if (r.type === "daily") {
          rawDates.push(cursor);
        } else {
          const dow = parseLocalDate(cursor).getDay();
          if ((r.days || []).includes(dow)) rawDates.push(cursor);
        }
        cursor = addDaysISO(cursor, 1);
      }
      break;
    }

    case "monthly": {
      // Walk month by month across the range.
      const startD = parseLocalDate(rangeStart);
      const endD = parseLocalDate(rangeEnd);
      let y = startD.getFullYear();
      let m = startD.getMonth();

      let guard = 0;
      while (
        (y < endD.getFullYear() ||
          (y === endD.getFullYear() && m <= endD.getMonth())) &&
        guard < 60
      ) {
        guard += 1;
        const lastDayOfMonth = new Date(y, m + 1, 0).getDate();

        (r.datesOfMonth || []).forEach((dom) => {
          if (dom > lastDayOfMonth) return; // e.g. 31st on a 30-day month
          const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(
            dom
          ).padStart(2, "0")}`;

          if (dateStr < rangeStart || dateStr > rangeEnd) return;
          if (r.from && dateStr < r.from) return;
          if (r.to && dateStr > r.to) return;

          rawDates.push(dateStr);
        });

        m += 1;
        if (m > 11) {
          m = 0;
          y += 1;
        }
      }
      break;
    }

    case "yearly": {
      const startYear = parseLocalDate(rangeStart).getFullYear();
      const endYear = parseLocalDate(rangeEnd).getFullYear();

      for (let y = startYear; y <= endYear; y++) {
        const dateStr = `${y}-${String(r.month).padStart(2, "0")}-${String(
          r.day
        ).padStart(2, "0")}`;

        if (dateStr < rangeStart || dateStr > rangeEnd) continue;
        if (r.from && dateStr < r.from) continue;
        if (r.to && dateStr > r.to) continue;

        rawDates.push(dateStr);
      }
      break;
    }

    default:
      break;
  }

  const occurrences = [];

  rawDates.forEach((d) => {
    const ex = exceptions[d];
    if (ex?.cancelled) return; // dropped, no replacement
    if (ex?.moved) return; // handled below via its newDate

    occurrences.push({
      occId: `${event.eventId}__${d}`,
      date: d,
      startTime: event.startTime || null,
      endTime: event.endTime || null,
      title: event.title,
      isException: false,
      originalDate: d,
    });
  });

  // Postponed occurrences: they show up on their NEW date, even
  // if that new date is outside the naive recurrence pattern.
  Object.entries(exceptions).forEach(([origDate, ex]) => {
    if (!ex.moved) return;
    if (ex.newDate < rangeStart || ex.newDate > rangeEnd) return;

    occurrences.push({
      occId: `${event.eventId}__${origDate}__moved`,
      date: ex.newDate,
      startTime: ex.newStartTime || event.startTime || null,
      endTime: ex.newEndTime || event.endTime || null,
      title: ex.title || event.title,
      isException: true,
      originalDate: origDate,
    });
  });

  return occurrences.sort((a, b) =>
    (a.startTime || "").localeCompare(b.startTime || "")
  );
};

// ---------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------

function EventsWidget({
  email,
  x,
  y,
  setLoading,
  setPopup,
  setPopupContent,
}) {

  const [refreshState, setRefreshState] = useState(0);

  const [contextMenu, setContextMenu] = useState({
      visible: false,
      x: 0,
      y: 0,
  });

  const handleRightClick = (e) => {
      e.preventDefault();

      setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      });
  };

  const today = getLocalISODate();

  const [isWidgetEmpty, setIsWidgetEmpty] = useState(true);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  const [ownEvents, setOwnEvents] = useState([]); // events I own
  const [sharedEvents, setSharedEvents] = useState([]); // denormalized copies shared with me
  const [connections, setConnections] = useState([]); // [{email,name}]
  const [teamMembers, setTeamMembers] = useState([]); // [{email,name}]

  const [viewMode, setViewMode] = useState("day"); // day | week | month
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));

  const [scope, setScope] = useState("all"); // "all" | "self" | an owner email
  const [moreOptions, setMoreOptions] = useState(false);
  const [viewAllPage, setViewAllPage] = useState(false);

  // inline create/edit panel (mirrors the "View All" slide-in pattern
  // instead of using the global popup)
  const [addEventPage, setAddEventPage] = useState(false);
  const [formMode, setFormMode] = useState("create"); // create | edit
  const [formCategory, setFormCategory] = useState("meeting");
  const [editingEvent, setEditingEvent] = useState(null);
  const [viewAllTab, setViewAllTab] = useState("meeting"); // meeting | reminder

  // inline occurrence details panel (also mirrors the "View All"
  // slide-in pattern instead of a popup)
  const [occurrencePage, setOccurrencePage] = useState(false);
  const [activeOccurrence, setActiveOccurrence] = useState(null); // { event, occ }
  const [showPostponeFields, setShowPostponeFields] = useState(false);
  const [postponeDate, setPostponeDate] = useState("");
  const [postponeStart, setPostponeStart] = useState("");
  const [postponeEnd, setPostponeEnd] = useState("");

  // private, per-occurrence notes (manual save)
  const [occurrenceNoteText, setOccurrenceNoteText] = useState("");
  const [occurrenceNoteLoading, setOccurrenceNoteLoading] = useState(false);
  const [occurrenceNoteSaving, setOccurrenceNoteSaving] = useState(false);

  // -------------------------------------------------------
  // FETCH: widget empty-state
  // -------------------------------------------------------

  useEffect(() => {
    if (!email) return;

    const run = async () => {
      try {
        const snap = await getDoc(doc(db, email, "widgets"));
        if (snap.exists()) {
          const empty = snap.data()?.Events?.empty;
          if (empty !== undefined) setIsWidgetEmpty(empty);
        }
      } catch (err) {
        console.error("Error fetching Events empty state:", err);
      }
    };

    run();
  }, [email,refreshState]);

  // -------------------------------------------------------
  // FETCH: my events + events shared with me + connections
  // -------------------------------------------------------

  useEffect(() => {
    if (!email) return;

    const run = async () => {
      setLoading(true);

      try {
        const [ownSnap, sharedSnap, connSnap, teamSnap] = await Promise.all([
          getDocs(collection(db, email, "Events", "Items")),
          getDocs(collection(db, email, "Events", "SharedWithMe")),
          getDocs(collection(db, email, "Connections", "List")).catch(
            () => ({ docs: [] })
          ),
          getDocs(collection(db, email, "TeamMembers", "List")).catch(
            () => ({ docs: [] })
          ),
        ]);

        const own = ownSnap.docs.map((d) => ({
          eventId: d.id,
          ownerEmail: email,
          ...d.data(),
        }));

        const shared = sharedSnap.docs.map((d) => ({
          ...d.data(),
          pointerId: d.id,
        }));

        const conns = connSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const team = teamSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setOwnEvents(own);
        setSharedEvents(shared);
        setConnections(conns);
        setTeamMembers(team);
        setInitialFetchDone(true);

        if (own.length > 0 || shared.length > 0) setIsWidgetEmpty(false);
      } catch (err) {
        console.error("Error fetching events:", err);

        toast("Couldn't load your events.", {
          duration: 2000,
          position: "top-center",
          icon: "❌",
          style: { backgroundColor: "var(--toast_error)", color: "white" },
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [email, initialFetchDone, setLoading,refreshState]);

  // -------------------------------------------------------
  // Merged event pool, filtered by "who am I looking at"
  // -------------------------------------------------------

  const visibleEvents = useMemo(() => {
    if (scope === "self") return ownEvents;
    if (scope === "others") return sharedEvents;
    return [...ownEvents, ...sharedEvents];
  }, [ownEvents, sharedEvents, scope,refreshState]);

  const canEditEvent = (event) =>
    event.ownerEmail === email || event.access === "edit";

  // -------------------------------------------------------
  // CRUD
  // -------------------------------------------------------

  const persistEventEverywhere = async (eventData, previousAttendeeEmails = []) => {
    const batch = writeBatch(db);

    const ownerRef = doc(db, eventData.ownerEmail, "Events", "Items", eventData.eventId);
    batch.set(ownerRef, eventData, { merge: false });

    const nextAttendeeEmails = Object.keys(eventData.attendees || {});
    const pointerId = `${eventData.ownerEmail}__${eventData.eventId}`;

    // write / refresh a shared copy for every current attendee
    nextAttendeeEmails.forEach((attendeeEmail) => {
      const access = eventData.attendees[attendeeEmail];
      const ref = doc(db, attendeeEmail, "Events", "SharedWithMe", pointerId);
      batch.set(ref, { ...eventData, access, pointerId }, { merge: false });
    });

    // remove copies for attendees who were dropped from the event
    previousAttendeeEmails
      .filter((a) => !nextAttendeeEmails.includes(a))
      .forEach((attendeeEmail) => {
        const ref = doc(db, attendeeEmail, "Events", "SharedWithMe", pointerId);
        batch.delete(ref);
      });

    await batch.commit();
  };

  const createEvent = async (formEvent) => {
    setLoading(true);

    try {
      const eventId = crypto.randomUUID();

      const eventData = {
        ...formEvent,
        eventId,
        ownerEmail: email,
        ownerName: formEvent.ownerName || email,
        createdAt: new Date().toISOString(),
        exceptions: {},
        seriesCancelled: false,
      };

      await persistEventEverywhere(eventData, []);

      await updateDoc(doc(db, email, "widgets"), {
        "Events.empty": false,
      }).catch(() => {});

      setOwnEvents((prev) => [...prev, eventData]);
      setIsWidgetEmpty(false);

      toast(
        eventData.category === "meeting"
          ? "Meeting created!"
          : "Reminder created!",
        {
          duration: 2000,
          position: "top-center",
          icon: "✅",
          style: { backgroundColor: "var(--toast_success)", color: "white" },
        }
      );

      setAddEventPage(false);
      setEditingEvent(null);
    } catch (err) {
      console.error("Error creating event:", err);

      toast("Something went wrong while saving. Please try again.", {
        duration: 2500,
        position: "top-center",
        icon: "❌",
        style: { backgroundColor: "var(--toast_error)", color: "white" },
      });
    } finally {
      setLoading(false);
    }
  };

  const updateEventSeries = async (originalEvent, formEvent) => {
    setLoading(true);

    try {
      const previousAttendeeEmails = Object.keys(originalEvent.attendees || {});

      const eventData = {
        ...originalEvent,
        ...formEvent,
        eventId: originalEvent.eventId,
        ownerEmail: originalEvent.ownerEmail,
        createdAt: originalEvent.createdAt,
        exceptions: originalEvent.exceptions || {},
        seriesCancelled: false,
      };

      await persistEventEverywhere(eventData, previousAttendeeEmails);

      if (eventData.ownerEmail === email) {
        setOwnEvents((prev) =>
          prev.map((e) => (e.eventId === eventData.eventId ? eventData : e))
        );
      } else {
        setSharedEvents((prev) =>
          prev.map((e) =>
            e.eventId === eventData.eventId
              ? { ...eventData, access: originalEvent.access }
              : e
          )
        );
      }

      toast("Changes saved!", {
        duration: 2000,
        position: "top-center",
        icon: "✅",
        style: { backgroundColor: "var(--toast_success)", color: "white" },
      });

      setAddEventPage(false);
      setEditingEvent(null);
    } catch (err) {
      console.error("Error updating event:", err);

      toast("Couldn't save changes. Please try again.", {
        duration: 2500,
        position: "top-center",
        icon: "❌",
        style: { backgroundColor: "var(--toast_error)", color: "white" },
      });
    } finally {
      setLoading(false);
    }
  };

  const applyExceptionEverywhere = async (event, occurrenceDate, exceptionValue) => {
    const attendeeEmails = Object.keys(event.attendees || {});
    const pointerId = `${event.ownerEmail}__${event.eventId}`;
    const fieldPath = `exceptions.${occurrenceDate}`;

    const batch = writeBatch(db);

    const ownerRef = doc(db, event.ownerEmail, "Events", "Items", event.eventId);
    batch.update(ownerRef, {
      [fieldPath]: exceptionValue === null ? deleteField() : exceptionValue,
    });

    attendeeEmails.forEach((attendeeEmail) => {
      const ref = doc(db, attendeeEmail, "Events", "SharedWithMe", pointerId);
      batch.update(ref, {
        [fieldPath]: exceptionValue === null ? deleteField() : exceptionValue,
      });
    });

    await batch.commit();
  };

  const cancelOccurrence = async (event, occurrenceDate) => {
    setLoading(true);

    try {
      await applyExceptionEverywhere(event, occurrenceDate, { cancelled: true });

      const patch = (e) => ({
        ...e,
        exceptions: { ...(e.exceptions || {}), [occurrenceDate]: { cancelled: true } },
      });

      updateLocalEventCopy(event, patch);

      toast("Occurrence cancelled.", {
        duration: 2000,
        position: "top-center",
        icon: "🗑️",
        style: { backgroundColor: "var(--toast_success)", color: "white" },
      });
    } catch (err) {
      console.error("Error cancelling occurrence:", err);
      toast("Couldn't cancel that occurrence.", {
        duration: 2500,
        position: "top-center",
        icon: "❌",
        style: { backgroundColor: "var(--toast_error)", color: "white" },
      });
    } finally {
      setLoading(false);
    }
  };

  const postponeOccurrence = async (event, occurrenceDate, newDate, newStartTime, newEndTime) => {
    setLoading(true);

    try {
      const exceptionValue = {
        moved: true,
        newDate,
        newStartTime: newStartTime || null,
        newEndTime: newEndTime || null,
      };

      await applyExceptionEverywhere(event, occurrenceDate, exceptionValue);

      const patch = (e) => ({
        ...e,
        exceptions: { ...(e.exceptions || {}), [occurrenceDate]: exceptionValue },
      });

      updateLocalEventCopy(event, patch);

      toast("Occurrence postponed.", {
        duration: 2000,
        position: "top-center",
        icon: "✅",
        style: { backgroundColor: "var(--toast_success)", color: "white" },
      });
    } catch (err) {
      console.error("Error postponing occurrence:", err);
      toast("Couldn't postpone that occurrence.", {
        duration: 2500,
        position: "top-center",
        icon: "❌",
        style: { backgroundColor: "var(--toast_error)", color: "white" },
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelWholeSeries = async (event) => {
    setLoading(true);

    try {
      const attendeeEmails = Object.keys(event.attendees || {});
      const pointerId = `${event.ownerEmail}__${event.eventId}`;

      const batch = writeBatch(db);
      batch.delete(doc(db, event.ownerEmail, "Events", "Items", event.eventId));

      attendeeEmails.forEach((attendeeEmail) => {
        batch.delete(doc(db, attendeeEmail, "Events", "SharedWithMe", pointerId));
      });

      await batch.commit();

      if (event.ownerEmail === email) {
        setOwnEvents((prev) => prev.filter((e) => e.eventId !== event.eventId));
      } else {
        setSharedEvents((prev) => prev.filter((e) => e.eventId !== event.eventId));
      }

      toast("Cancelled.", {
        duration: 2000,
        position: "top-center",
        icon: "🗑️",
        style: { backgroundColor: "var(--toast_success)", color: "white" },
      });
    } catch (err) {
      console.error("Error cancelling series:", err);
      toast("Couldn't cancel this. Please try again.", {
        duration: 2500,
        position: "top-center",
        icon: "❌",
        style: { backgroundColor: "var(--toast_error)", color: "white" },
      });
    } finally {
      setLoading(false);
    }
  };

  const updateLocalEventCopy = (event, patchFn) => {
    if (event.ownerEmail === email) {
      setOwnEvents((prev) =>
        prev.map((e) => (e.eventId === event.eventId ? patchFn(e) : e))
      );
    } else {
      setSharedEvents((prev) =>
        prev.map((e) => (e.eventId === event.eventId ? patchFn(e) : e))
      );
    }
  };

  // -------------------------------------------------------
  // CREATE / EDIT PANEL LAUNCHERS
  // (inline slide-in panel, same pattern as "View All", rather
  // than the global popup)
  // -------------------------------------------------------

  const openCreatePanel = (category = "meeting") => {
    setFormMode("create");
    setFormCategory(category);
    setEditingEvent(null);
    setViewAllPage(false);
    setOccurrencePage(false);
    setAddEventPage(true);
  };

  const openEditPanel = (event) => {
    setFormMode("edit");
    setFormCategory(event.category);
    setEditingEvent(event);
    setViewAllPage(false);
    setOccurrencePage(false);
    setAddEventPage(true);
  };

  // -------------------------------------------------------
  // OCCURRENCE DETAILS PANEL (inline, same pattern as the
  // create/edit panel - no popup)
  // -------------------------------------------------------

  const occurrenceNoteId = (event, occ) =>
    `${event.ownerEmail}__${event.eventId}__${occ.originalDate}`;

  const openOccurrencePanel = (event, occ) => {
    setActiveOccurrence({ event, occ });
    setShowPostponeFields(false);
    setPostponeDate(occ.date);
    setPostponeStart(occ.startTime || "");
    setPostponeEnd(occ.endTime || "");
    setOccurrenceNoteText("");
    setViewAllPage(false);
    setAddEventPage(false);
    setOccurrencePage(true);

    // load this user's private note for this occurrence
    setOccurrenceNoteLoading(true);
    getDoc(doc(db, email, "Events", "OccurrenceNotes", occurrenceNoteId(event, occ)))
      .then((snap) => {
        setOccurrenceNoteText(snap.exists() ? snap.data()?.note || "" : "");
      })
      .catch((err) => {
        console.error("Error loading occurrence note:", err);
      })
      .finally(() => setOccurrenceNoteLoading(false));
  };

  const closeOccurrencePanel = () => {
    setOccurrencePage(false);
    setActiveOccurrence(null);
    setShowPostponeFields(false);
  };

  const saveOccurrenceNote = async () => {
    if (!activeOccurrence) return;
    const { event, occ } = activeOccurrence;

    setOccurrenceNoteSaving(true);
    try {
      await setDoc(
        doc(db, email, "Events", "OccurrenceNotes", occurrenceNoteId(event, occ)),
        { note: occurrenceNoteText, updatedAt: new Date().toISOString() },
        { merge: true }
      );

      toast("Note saved.", {
        duration: 1800,
        position: "top-center",
        icon: "✅",
        style: { backgroundColor: "var(--toast_success)", color: "white" },
      });
    } catch (err) {
      console.error("Error saving occurrence note:", err);
      toast("Couldn't save your note.", {
        duration: 2500,
        position: "top-center",
        icon: "❌",
        style: { backgroundColor: "var(--toast_error)", color: "white" },
      });
    } finally {
      setOccurrenceNoteSaving(false);
    }
  };

  const submitPostpone = () => {
    if (!activeOccurrence) return;
    const { event, occ } = activeOccurrence;

    postponeOccurrence(event, occ.originalDate, postponeDate, postponeStart, postponeEnd);
    closeOccurrencePanel();
  };

  // -------------------------------------------------------
  // OCCURRENCE COMPUTATION FOR CURRENT VIEW
  // -------------------------------------------------------

  const dayOccurrences = useMemo(() => {
    const list = [];
    visibleEvents.forEach((event) => {
      expandOccurrences(event, selectedDate, selectedDate).forEach((occ) => {
        list.push({ event, occ });
      });
    });
    return list.sort((a, b) =>
      (a.occ.startTime || "").localeCompare(b.occ.startTime || "")
    );
  }, [visibleEvents, selectedDate]);

  const nextSevenDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(today, i)),
    [today]
  );

  const sevenDayOccurrences = useMemo(() => {
    const map = {};
    nextSevenDays.forEach((d) => (map[d] = []));

    visibleEvents.forEach((event) => {
      expandOccurrences(event, nextSevenDays[0], nextSevenDays[6]).forEach(
        (occ) => {
          if (map[occ.date]) map[occ.date].push({ event, occ });
        }
      );
    });

    Object.keys(map).forEach((d) =>
      map[d].sort((a, b) =>
        (a.occ.startTime || "").localeCompare(b.occ.startTime || "")
      )
    );

    return map;
  }, [visibleEvents, nextSevenDays]);

  const monthGridDays = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const firstOfMonth = new Date(y, m - 1, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(y, m - 1, 1 - startOffset);

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return {
        dateStr: getLocalISODate(d),
        inMonth: d.getMonth() === m - 1,
      };
    });
  }, [selectedMonth]);

  const monthOccurrencesByDay = useMemo(() => {
    const rangeStart = monthGridDays[0]?.dateStr;
    const rangeEnd = monthGridDays[41]?.dateStr;
    const map = {};

    if (!rangeStart) return map;

    visibleEvents.forEach((event) => {
      expandOccurrences(event, rangeStart, rangeEnd).forEach((occ) => {
        if (!map[occ.date]) map[occ.date] = [];
        map[occ.date].push({ event, occ });
      });
    });

    return map;
  }, [visibleEvents, monthGridDays]);

  const monthDaySelectedOccurrences = useMemo(
    () =>
      (monthOccurrencesByDay[selectedDate] || []).sort((a, b) =>
        (a.occ.startTime || "").localeCompare(b.occ.startTime || "")
      ),
    [monthOccurrencesByDay, selectedDate]
  );

  // -------------------------------------------------------
  // "Whose calendar" scope chips: self + everyone who shares
  // events with me
  // -------------------------------------------------------

  const scopeOwners = useMemo(() => {
    const seen = new Map();
    sharedEvents.forEach((e) => {
      if (!seen.has(e.ownerEmail)) {
        seen.set(e.ownerEmail, e.ownerName || e.ownerEmail);
      }
    });
    return Array.from(seen.entries()).map(([ownerEmail, ownerName]) => ({
      ownerEmail,
      ownerName,
    }));
  }, [sharedEvents]);

  // ---------------------------------------------------------
  // RENDER HELPERS
  // ---------------------------------------------------------

  const renderOccCard = ({ event, occ }) => (
    <div
      key={occ.occId}
      className={`eventCard ${
        event.category === "reminder" ? "cardReminder" : "cardMeeting"
      } ${occ.isException ? "cardMoved" : ""}`}
    >
      <div className="eventTime">
        {occ.startTime ? formatTime12(occ.startTime) : "All day"}
      </div>

      <div className="eventBody">
        <div className="eventTitle">{occ.title}</div>
        <div className="eventMeta">
          <span className="eventTag">
            {event.category === "reminder" ? "Reminder" : "Meeting"}
          </span>
          {occ.isException && <span className="eventTag">Postponed</span>}
          {event.ownerEmail !== email && (
            <span className="eventOwnerTag">from {event.ownerEmail}</span>
          )}
        </div>
      </div>

      <i
        className="fa-solid fa-ellipsis-vertical eventKebab"
        onClick={() => openOccurrencePanel(event, occ)}
      ></i>
    </div>
  );

  const changeMonth = (delta) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  };

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div
      className={`defaultWidgetDiv EventsMain ${
        isMobile ? "mobile" : "desk"
      } ${viewAllPage ? "viewall" : ""} ${addEventPage ? "add" : ""} ${
        occurrencePage ? "occ" : ""
      }`}
      style={{ padding: "0 0px 0 10px" }}
      onContextMenu={handleRightClick} onClick={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
    >
      <div className="EventsScrollArea">
        {isWidgetEmpty ? (
          <div className="emptyWidgetAdd">
            <span style={{ opacity: 0.6, fontSize: 14 }}>
              No meetings or reminders yet.
            </span>
            <button onClick={() => openCreatePanel("meeting")}>
              Create Your First Event +
            </button>
          </div>
        ) : (
          <>
            {/* HEADER */}
            <div className="eventsHeader">
              <input
                type="date"
                value={selectedDate}
                style={{width:"auto"}}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedMonth(e.target.value.slice(0, 7));
                }}
              />

              <span
                className="eventsMoreBtn"
                onClick={() => setMoreOptions((p) => !p)}
              >
                More ..
              </span>
            </div>

            {/* VIEW SEGMENT */}
            <div className="viewSegment">
              {[
                { id: "day", label: "Day" },
                { id: "week", label: "Next 7 Days" },
                { id: "month", label: "Month" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  className={`viewSegBtn ${
                    viewMode === opt.id ? "viewSegBtnActive" : ""
                  }`}
                  onClick={() => setViewMode(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* SCOPE CHIPS: whose calendar am I looking at */}
            <div className="scopeRow">
              <span
                className={`scopeChip ${
                  scope === "all" ? "scopeChipActive" : ""
                }`}
                onClick={() => setScope("all")}
              >
                All
              </span>

              <span
                className={`scopeChip ${
                  scope === "self" ? "scopeChipActive" : ""
                }`}
                onClick={() => setScope("self")}
              >
                Created by Me
              </span>

              <span
                className={`scopeChip ${
                  scope === "others" ? "scopeChipActive" : ""
                }`}
                onClick={() => setScope("others")}
              >
                By Others
              </span>
            </div>

            {/* DAY VIEW */}
            {viewMode === "day" && (
              <div className="agendaSection">
                {dayOccurrences.length === 0 ? (
                  <div className="noEventsMsg">Nothing on this date.</div>
                ) : (
                  dayOccurrences.map(renderOccCard)
                )}
              </div>
            )}

            {/* NEXT 7 DAYS VIEW */}
            {viewMode === "week" &&
              nextSevenDays.map((d) => {
                const items = sevenDayOccurrences[d] || [];
                if (items.length === 0) return null;
                return (
                  <div className="sevenDayGroup" key={d}>
                    <div className="sevenDayDate">{formatDayLabel(d)}</div>
                    {items.map(renderOccCard)}
                  </div>
                );
              })}
            {viewMode === "week" &&
              Object.values(sevenDayOccurrences).every((v) => v.length === 0) && (
                <div className="noEventsMsg">
                  Nothing in the next 7 days.
                </div>
              )}

            {/* MONTH VIEW */}
            {viewMode === "month" && (
              <>
                <div className="monthNav">
                  <i
                    className="fa-solid fa-chevron-left"
                    onClick={() => changeMonth(-1)}
                  ></i>
                  <span className="monthNavLabel">
                    {formatMonthLabel(selectedMonth)}
                  </span>
                  <i
                    className="fa-solid fa-chevron-right"
                    onClick={() => changeMonth(1)}
                  ></i>
                </div>

                <div className="monthGrid">
                  {WEEKDAYS.map((d, i) => (
                    <div className="monthGridHeadCell" key={i}>
                      {d}
                    </div>
                  ))}

                  {monthGridDays.map(({ dateStr, inMonth }) => {
                    const items = monthOccurrencesByDay[dateStr] || [];
                    const hasMeeting = items.some(
                      (i) => i.event.category === "meeting"
                    );
                    const hasReminder = items.some(
                      (i) => i.event.category === "reminder"
                    );

                    return (
                      <div
                        key={dateStr}
                        className={`monthDayCell ${
                          !inMonth ? "monthDayCellOutside" : ""
                        } ${
                          selectedDate === dateStr
                            ? "monthDayCellSelected"
                            : ""
                        } ${dateStr === today ? "monthDayCellToday" : ""}`}
                        onClick={() => setSelectedDate(dateStr)}
                      >
                        <span>{Number(dateStr.slice(-2))}</span>
                        {(hasMeeting || hasReminder) && (
                          <div className="monthDayDots">
                            {hasMeeting && <span className="monthDayDot"></span>}
                            {hasReminder && (
                              <span className="monthDayDot dotReminder"></span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="monthDayAgenda">
                  <div className="agendaSectionTitle">
                    {formatDayLabel(selectedDate)}
                  </div>
                  {monthDaySelectedOccurrences.length === 0 ? (
                    <div className="noEventsMsg">Nothing on this date.</div>
                  ) : (
                    monthDaySelectedOccurrences.map(renderOccCard)
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* MORE OPTIONS MENU */}
        {moreOptions && (
          <div className="moreOptionsMenu">
            <span
              onClick={() => {
                setViewAllPage(true);
                setMoreOptions(false);
              }}
            >
              View All
            </span>
            <span
              onClick={() => {
                openCreatePanel("reminder");
                setMoreOptions(false);
              }}
            >
              New Reminder
            </span>
            <span
              onClick={() => {
                openCreatePanel("meeting");
                setMoreOptions(false);
              }}
            >
              New Meeting
            </span>
          </div>
        )}

        {/* VIEW ALL PANEL */}
        <div className="viewAllEvents">
          <div style={{ marginBottom: "20px" }}>
            <i
              className="fa-solid fa-chevron-left"
              onClick={() => setViewAllPage(false)}
            ></i>
            <h3>All Events</h3>
          </div>

          <div className="viewAllTabs">
            <button
              className={`viewSegBtn ${
                viewAllTab === "meeting" ? "viewSegBtnActive" : ""
              }`}
              style={{ flex: 1 }}
              onClick={() => setViewAllTab("meeting")}
            >
              Meetings
            </button>
            <button
              className={`viewSegBtn ${
                viewAllTab === "reminder" ? "viewSegBtnActive" : ""
              }`}
              style={{ flex: 1 }}
              onClick={() => setViewAllTab("reminder")}
            >
              Reminders
            </button>
          </div>

          <div className="listGoals">
            {[...ownEvents, ...sharedEvents]
              .filter((e) => e.category === viewAllTab)
              .map((event) => (
                <div key={`${event.ownerEmail}__${event.eventId}`} className={`eventCard ${
                    event.category === "reminder" ? "cardReminder" : "cardMeeting"
                  }`}>
                  <div className="eventBody">
                    <div className="eventTitle">{event.title}</div>
                    <div className="eventMeta">
                      <span className="eventTag">
                        {event.recurrence?.type || "once"}
                      </span>
                      {event.ownerEmail !== email && (
                        <span className="eventOwnerTag">
                          from {event.ownerEmail} ({event.access})
                        </span>
                      )}
                    </div>
                  </div>

                  {canEditEvent(event) && (
                    <>
                      <i
                        className="fa-solid fa-pen eventKebab"
                        onClick={() => openEditPanel(event)}
                      ></i>
                      <i
                        className="fa-solid fa-trash eventKebab"
                        onClick={() => cancelWholeSeries(event)}
                      ></i>
                    </>
                  )}
                </div>
              ))}

            {[...ownEvents, ...sharedEvents].filter(
              (e) => e.category === viewAllTab
            ).length === 0 && (
              <div className="noEventsMsg">
                No {viewAllTab === "meeting" ? "meetings" : "reminders"} yet.
              </div>
            )}
          </div>
        </div>

        {/* ADD / EDIT PANEL (inline slide-in, same pattern as View All) */}
        <div className="addEventPanel">
          <div>
            <i
              className="fa-solid fa-chevron-left"
              onClick={() => {
                setAddEventPage(false);
                setEditingEvent(null);
              }}
            ></i>
            <h3>{formMode === "create" ? "New Event" : "Edit Event"}</h3>
          </div>

          {addEventPage && (
            <EventForm
              mode={formMode}
              category={formCategory}
              email={email}
              connections={connections}
              teamMembers={teamMembers}
              initialEvent={editingEvent}
              defaultDate={selectedDate}
              onCancel={() => {
                setAddEventPage(false);
                setEditingEvent(null);
              }}
              onSubmit={
                formMode === "create"
                  ? createEvent
                  : (formEvent) => updateEventSeries(editingEvent, formEvent)
              }
            />
          )}
        </div>

        {/* OCCURRENCE DETAILS PANEL (inline slide-in, no popup) */}
        <div className="occurrencePanel">
          <div style={{display:"flex",alignItems:"center"}}>
            <i
              className="fa-solid fa-chevron-left"
              onClick={closeOccurrencePanel}
            ></i>
            <h3>Event Details</h3>
          </div>

          {occurrencePage && activeOccurrence && (() => {
            const { event, occ } = activeOccurrence;
            const isRecurring = event.recurrence?.type !== "once";
            const editable = canEditEvent(event);

            return (
              <div className="occurrenceDetails">
                <span
                  className={`eventTag ${
                    event.category === "reminder" ? "eventTagReminder" : ""
                  }`}
                >
                  {event.category === "reminder" ? "Reminder" : "Meeting"}
                </span>

                <h4 className="occDetailsTitle">{occ.title}</h4>

                <div className="occDetailsRow">
                  <i className="fa-regular fa-calendar"></i>
                  <span>{formatDayLabel(occ.date)}</span>
                </div>

                {occ.startTime && (
                  <div className="occDetailsRow">
                    <i className="fa-regular fa-clock"></i>
                    <span>
                      {formatTime12(occ.startTime)}
                      {occ.endTime ? ` – ${formatTime12(occ.endTime)}` : ""}
                    </span>
                  </div>
                )}

                {event.location && (
                  <div className="occDetailsRow">
                    <i className="fa-solid fa-location-dot"></i>
                    <span>{event.location}</span>
                  </div>
                )}

                {occ.isException && (
                  <div className="occDetailsRow">
                    <i className="fa-solid fa-clock-rotate-left"></i>
                    <span>Postponed from {formatDayLabel(occ.originalDate)}</span>
                  </div>
                )}

                <div className="occDetailsRow">
                  <i className="fa-regular fa-user"></i>
                  <span>
                    {event.ownerEmail === email
                      ? "Created by you"
                      : `From ${event.ownerName || event.ownerEmail} · ${
                          event.access === "edit" ? "Edit access" : "View only"
                        }`}
                  </span>
                </div>

                {event.description && (
                  <>
                    <span className="fieldLabel">Description</span>
                    <p className="occDescription">{event.description}</p>
                  </>
                )}

                {/* Private notes: always available, never shared with
                    the owner or other attendees. Manual save only. */}
                <span className="fieldLabel" style={{marginTop:"30px"}}>Private notes</span>
                <textarea
                  className="occNotesArea"
                  rows={4}
                  placeholder="Only visible to you..."
                  value={occurrenceNoteText}
                  disabled={occurrenceNoteLoading}
                  onChange={(e) => setOccurrenceNoteText(e.target.value)}
                />
                <button
                  type="button"
                  className="occSaveNoteBtn"
                  onClick={saveOccurrenceNote}
                  disabled={occurrenceNoteSaving || occurrenceNoteLoading}
                >
                  {occurrenceNoteSaving ? "Saving..." : "Save note"}
                </button>

                {editable && (
                  <>
                    <span className="fieldLabel" style={{marginTop:"10px"}}>Manage</span>
                    <div className="occManageActions">
                      {isRecurring && !showPostponeFields && (
                        <button
                          className="occOption"
                          onClick={() => setShowPostponeFields(true)}
                        >
                          Postpone / edit this occurrence
                        </button>
                      )}

                      {isRecurring && showPostponeFields && (
                        <div className="postponeInline">
                          <span className="fieldLabel">New date</span>
                          <input
                            type="date"
                            value={postponeDate}
                            onChange={(e) => setPostponeDate(e.target.value)}
                          />

                          {event.category === "meeting" && (
                            <div className="timeRow">
                              <div>
                                <span className="smallLabel">Start</span>
                                <input
                                  type="time"
                                  value={postponeStart}
                                  onChange={(e) => setPostponeStart(e.target.value)}
                                />
                              </div>
                              <div>
                                <span className="smallLabel">End (optional)</span>
                                <input
                                  type="time"
                                  value={postponeEnd}
                                  onChange={(e) => setPostponeEnd(e.target.value)}
                                />
                              </div>
                            </div>
                          )}

                          <div className="formActions">
                            <button
                              className="btnGhost"
                              onClick={() => setShowPostponeFields(false)}
                            >
                              Cancel
                            </button>
                            <button className="btnPrimary" onClick={submitPostpone}>
                              Save new date
                            </button>
                          </div>
                        </div>
                      )}

                      <button className="occOption" onClick={() => openEditPanel(event)}>
                        {isRecurring ? "Edit whole series" : "Edit"}
                      </button>

                      {isRecurring && (
                        <button
                          className="occOption occOptionDanger"
                          onClick={() => {
                            cancelOccurrence(event, occ.originalDate);
                            closeOccurrencePanel();
                          }}
                        >
                          Cancel this occurrence
                        </button>
                      )}

                      <button
                        className="occOption occOptionDanger"
                        onClick={() => {
                          cancelWholeSeries(event);
                          closeOccurrencePanel();
                        }}
                      >
                        {isRecurring ? "Cancel whole series" : "Cancel / delete"}
                      </button>
                    </div>
                  </>
                )}

              </div>
            );
          })()}
        </div>

        {!isWidgetEmpty && (
          <button
            className="addEventBtn"
            onClick={() => openCreatePanel("meeting")}
          >
            Add +
          </button>
        )}
      </div>

      <div className="refreshWidget" style={{ display: contextMenu.visible ? "block" : "none",left: contextMenu.x,top: contextMenu.y, cursor:"pointer", width: "auto", overflow: "hidden", padding: "10px", boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)", zIndex: 20, position: "fixed", background: "white", borderRadius: "10px", fontSize: "13px" }} onClick={() => setRefreshState(prev => prev + 1)}>Refresh</div>

    </div>
  );
}

// =============================================================
// CREATE / EDIT EVENT FORM
// Rendered inline inside .addEventPanel (a slide-in panel, same
// pattern as "View All") - no popup involved.
// =============================================================

function EventForm({
  mode,
  category: initialCategory,
  email,
  connections,
  teamMembers,
  initialEvent,
  defaultDate,
  onCancel,
  onSubmit,
}) {
  const [category, setCategory] = useState(initialCategory || "meeting");
  const [title, setTitle] = useState(initialEvent?.title || "");
  const [description, setDescription] = useState(initialEvent?.description || "");
  const [location, setLocation] = useState(initialEvent?.location || "");
  const [startTime, setStartTime] = useState(initialEvent?.startTime || "09:00");
  const [endTime, setEndTime] = useState(initialEvent?.endTime || "");

  const defaultRecType =
    initialEvent?.recurrence?.type ||
    (category === "reminder" ? "weekly" : "once");

  const [recType, setRecType] = useState(defaultRecType);

  const [days, setDays] = useState(initialEvent?.recurrence?.days || [1, 2, 3, 4, 5]);
  const [dates, setDates] = useState(
    initialEvent?.recurrence?.dates || [defaultDate || getLocalISODate()]
  );
  const [datesOfMonth, setDatesOfMonth] = useState(
    initialEvent?.recurrence?.datesOfMonth || [1]
  );
  const [yearMonth, setYearMonth] = useState(
    initialEvent?.recurrence?.month || Number(getLocalISODate().slice(5, 7))
  );
  const [yearDay, setYearDay] = useState(
    initialEvent?.recurrence?.day || Number(getLocalISODate().slice(8, 10))
  );
  const [onceDate, setOnceDate] = useState(
    initialEvent?.recurrence?.date || defaultDate || getLocalISODate()
  );
  const [fromDate, setFromDate] = useState(
    initialEvent?.recurrence?.from || defaultDate || getLocalISODate()
  );
  const [toDate, setToDate] = useState(initialEvent?.recurrence?.to || "");

  const [attendees, setAttendees] = useState(
    initialEvent?.attendees
      ? Object.entries(initialEvent.attendees).map(([em, access]) => ({
          email: em,
          access,
        }))
      : []
  );

  const recOptions =
    category === "reminder"
      ? REMINDER_RECURRENCE_OPTIONS
      : MEETING_RECURRENCE_OPTIONS;

  useEffect(() => {
    // switching category resets recurrence type to a valid default for it
    setRecType(category === "reminder" ? "weekly" : "once");
  }, [category]);

  const toggleDay = (idx) => {
    setDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()
    );
  };

  const toggleDom = (n) => {
    setDatesOfMonth((prev) =>
      prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n].sort((a, b) => a - b)
    );
  };

  const addAttendeeRow = () =>
    setAttendees((prev) => [...prev, { email: "", access: "view" }]);

  const updateAttendee = (idx, field, value) =>
    setAttendees((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a))
    );

  const removeAttendee = (idx) =>
    setAttendees((prev) => prev.filter((_, i) => i !== idx));

  // "Share with team" checkbox: on check, adds every team member
  // (that isn't already an attendee) with view access. Unchecking
  // does not remove anyone - removal stays a manual per-row action.
  const [shareWithTeam, setShareWithTeam] = useState(false);

  const toggleShareWithTeam = () => {
    const next = !shareWithTeam;
    setShareWithTeam(next);

    if (next) {
      setAttendees((prev) => {
        const existing = new Set(
          prev.map((a) => a.email.trim().toLowerCase()).filter(Boolean)
        );
        const additions = (teamMembers || [])
          .filter((m) => m.email && !existing.has(m.email.toLowerCase()))
          .map((m) => ({ email: m.email, access: "view" }));

        return [...prev, ...additions];
      });
    }
  };

  // Which attendee row (by index) currently has its connections
  // suggestion dropdown open.
  const [suggestOpenIdx, setSuggestOpenIdx] = useState(null);

  const suggestionsFor = (query) => {
    const q = (query || "").trim().toLowerCase();
    const alreadyAdded = new Set(
      attendees.map((a) => a.email.trim().toLowerCase()).filter(Boolean)
    );

    return (connections || [])
      .filter((c) => c.email && !alreadyAdded.has(c.email.toLowerCase()))
      .filter(
        (c) =>
          !q ||
          c.email.toLowerCase().includes(q) ||
          (c.name || "").toLowerCase().includes(q)
      )
      .slice(0, 6);
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast("Please enter a title.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: { backgroundColor: "var(--toast_error)", color: "white" },
      });
      return;
    }

    let recurrence = { type: recType };

    if (recType === "once") recurrence.date = onceDate;
    if (recType === "dates") recurrence.dates = dates.filter(Boolean);
    if (recType === "weekly" || recType === "daily") {
      recurrence.from = fromDate;
      recurrence.to = toDate || null;
      if (recType === "weekly") recurrence.days = days;
    }
    if (recType === "monthly") {
      recurrence.datesOfMonth = datesOfMonth;
      recurrence.from = fromDate || null;
      recurrence.to = toDate || null;
    }
    if (recType === "yearly") {
      recurrence.month = Number(yearMonth);
      recurrence.day = Number(yearDay);
      recurrence.from = fromDate || null;
      recurrence.to = toDate || null;
    }

    if (recType === "weekly" && (!recurrence.days || recurrence.days.length === 0)) {
      toast("Select at least one day.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: { backgroundColor: "var(--toast_error)", color: "white" },
      });
      return;
    }

    if (recType === "dates" && (!recurrence.dates || recurrence.dates.length === 0)) {
      toast("Add at least one date.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: { backgroundColor: "var(--toast_error)", color: "white" },
      });
      return;
    }

    const attendeeMap = {};
    attendees.forEach((a) => {
      const cleanEmail = a.email.trim().toLowerCase();
      if (cleanEmail && cleanEmail !== email) {
        attendeeMap[cleanEmail] = a.access === "edit" ? "edit" : "view";
      }
    });

    const formEvent = {
      title: title.trim(),
      category,
      description: description.trim(),
      startTime: category === "meeting" ? startTime : null,
      endTime: category === "meeting" ? endTime || null : null,
      location: category === "meeting" ? location.trim() : "",
      recurrence,
      attendees: attendeeMap,
    };

    onSubmit(formEvent);
  };

  return (
    <div className="eventForm">
      {mode === "create" && (
        <>
          <span className="fieldLabel">Type</span>
          <div className="repeatSegment">
            <button
              type="button"
              className={`repeatSegBtn ${
                category === "meeting" ? "repeatSegBtnActive" : ""
              }`}
              onClick={() => setCategory("meeting")}
            >
              Meeting
            </button>
            <button
              type="button"
              className={`repeatSegBtn ${
                category === "reminder" ? "repeatSegBtnActive" : ""
              }`}
              onClick={() => setCategory("reminder")}
            >
              Reminder
            </button>
          </div>
        </>
      )}

      <span className="fieldLabel">Title</span>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={category === "meeting" ? "Team sync" : "Pay rent"}
      />

      <span className="fieldLabel">Description (optional)</span>
      <textarea
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={
          category === "meeting"
            ? "Agenda, links, context for attendees..."
            : "Any extra detail for this reminder..."
        }
      />

      {category === "meeting" && (
        <>
          <span className="fieldLabel">Time</span>
          <div className="timeRow">
            <div>
              <span className="smallLabel">Start</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <span className="smallLabel">End (optional)</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <span className="fieldLabel">Location (optional)</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Room 4 / Zoom link"
          />
        </>
      )}

      <span className="fieldLabel">Repeats</span>
      <div className="repeatSegment">
        {recOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`repeatSegBtn ${
              recType === opt.id ? "repeatSegBtnActive" : ""
            }`}
            onClick={() => setRecType(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {recType === "once" && (
        <>
          <span className="fieldLabel">Date</span>
          <input
            type="date"
            value={onceDate}
            onChange={(e) => setOnceDate(e.target.value)}
          />
        </>
      )}

      {recType === "dates" && (
        <div className="datesList" style={{ marginTop: 10 }}>
          {dates.map((d, idx) => (
            <div className="datesRow" key={idx}>
              <input
                type="date"
                value={d}
                onChange={(e) =>
                  setDates((prev) =>
                    prev.map((p, i) => (i === idx ? e.target.value : p))
                  )
                }
              />
              <button
                type="button"
                className="removeDateBtn"
                onClick={() => setDates((prev) => prev.filter((_, i) => i !== idx))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="addDateBtn"
            onClick={() => setDates((prev) => [...prev, ""])}
          >
            + Add another date
          </button>
        </div>
      )}

      {(recType === "weekly" || recType === "daily") && (
        <>
          {recType === "weekly" && (
            <div className="angWeekdays">
              {WEEKDAYS.map((d, idx) => (
                <button
                  type="button"
                  key={idx}
                  className={`repeatDayDot ${
                    days.includes(idx) ? "repeatDayDotActive" : ""
                  }`}
                  onClick={() => toggleDay(idx)}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          <span className="fieldLabel">Active dates</span>
          <div className="rangeRow">
            <div>
              <span className="smallLabel">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <span className="smallLabel">
                Until {category === "reminder" ? "(required)" : "(optional)"}
              </span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      {recType === "monthly" && (
        <>
          <span className="fieldLabel">Day(s) of month</span>
          <div className="angWeekdays" style={{ flexWrap: "wrap", justifyContent: "flex-start" }}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
              <button
                type="button"
                key={n}
                className={`repeatDayDot ${
                  datesOfMonth.includes(n) ? "repeatDayDotActive" : ""
                }`}
                style={{ width: 26, height: 26, fontSize: 10 }}
                onClick={() => toggleDom(n)}
              >
                {n}
              </button>
            ))}
          </div>

          <span className="fieldLabel">Active range (optional)</span>
          <div className="rangeRow">
            <div>
              <span className="smallLabel">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <span className="smallLabel">Until</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      {recType === "yearly" && (
        <>
          <span className="fieldLabel">Month &amp; day</span>
          <div className="rangeRow">
            <div>
              <span className="smallLabel">Month</span>
              <select value={yearMonth} onChange={(e) => setYearMonth(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1, 1).toLocaleDateString(undefined, {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="smallLabel">Day</span>
              <input
                type="number"
                min="1"
                max="31"
                value={yearDay}
                onChange={(e) => setYearDay(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      <span className="fieldLabel">Share with</span>
      {attendees.map((a, idx) => {
        const suggestions = suggestionsFor(a.email);

        return (
          <div className="attendeeRow" key={idx}>
            <div className="attendeeInputWrap">
              <input
                type="text"
                placeholder="Search your connections or type an email"
                value={a.email}
                autoComplete="new-password"
                onChange={(e) => updateAttendee(idx, "email", e.target.value)}
                onFocus={() => setSuggestOpenIdx(idx)}
                onBlur={() =>
                  setTimeout(() => setSuggestOpenIdx((cur) => (cur === idx ? null : cur)), 150)
                }
              />

              {suggestOpenIdx === idx && suggestions.length > 0 && (
                <div className="suggestDropdown">
                  {suggestions.map((c) => (
                    <div
                      key={c.id}
                      className="suggestItem"
                      onMouseDown={() => {
                        updateAttendee(idx, "email", c.email);
                        setSuggestOpenIdx(null);
                      }}
                    >
                      <span className="suggestName">{c.name || c.email}</span>
                      {c.name && <span className="suggestEmail">{c.email}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <select
              value={a.access}
              onChange={(e) => updateAttendee(idx, "access", e.target.value)}
            >
              <option value="view">View</option>
              <option value="edit">Edit</option>
            </select>
            <button
              type="button"
              className="removeDateBtn"
              onClick={() => removeAttendee(idx)}
            >
              ×
            </button>
          </div>
        );
      })}

      {connections.length === 0 && (
        <div className="noConnectionsHint">
          No saved connections found — you can still type any email address.
        </div>
      )}

      <button type="button" className="addDateBtn" onClick={addAttendeeRow}>
        + Add person
      </button>

      {teamMembers && teamMembers.length > 0 && (
        <label className="shareTeamRow">
          <input
            type="checkbox"
            checked={shareWithTeam}
            onChange={toggleShareWithTeam}
          />
          <span>
            Share with team ({teamMembers.length} member
            {teamMembers.length === 1 ? "" : "s"}, view access)
          </span>
        </label>
      )}

      <div className="formActions">
        <button type="button" className="btnGhost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btnPrimary" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}


export default EventsWidget;