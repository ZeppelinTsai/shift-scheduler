// ─────────────────────────────────────────────
// LumShift — Excel-style Schedule Grid
// Replaces renderMonthGrid for the "schedule" view
// Depends on: state.js globals (staff, shifts, schedule,
//             leaves, holidays, dailyDemands, cursor)
//             render.js helpers (getDaySchedule, getRequired,
//             hexToRgba, isHoliday, leavesForDate,
//             staffById, activeStaff, isPro, pad, ymd,
//             daysInMonth, monthKey, T)
// ─────────────────────────────────────────────

/* ── public entry point ──────────────────────────────────────── */
function renderScheduleGrid() {
  const container = document.getElementById("schedule-grid-excel");
  if (!container) return;

  const dates = _scheduleGridDates();

  container.innerHTML = "";
  container.classList.toggle("mode-day", scheduleViewMode === "day");
  container.classList.toggle("mode-week", scheduleViewMode === "week");
  container.classList.toggle("mode-month", scheduleViewMode === "month");
  container.appendChild(_buildTable(dates));
  restoreSelectionUI();
}

function _scheduleGridDates() {
  if (scheduleViewMode === "day") {
    return [ymd(cursor)];
  }

  if (scheduleViewMode === "week") {
    const start = cursor.startOf("week");
    return Array.from({ length: 7 }, (_, i) => ymd(start.add(i, "day")));
  }

  const mk = monthKey();
  const dates = [];
  for (let d = 1; d <= daysInMonth(); d++) {
    dates.push(`${mk}-${pad(d)}`);
  }
  return dates;
}

/* ── build the full <table> ──────────────────────────────────── */
function _buildTable(dates) {
  const table = document.createElement("table");
  table.className = "excel-table";

  table.appendChild(_buildColgroup(dates));
  table.appendChild(_buildThead(dates));
  table.appendChild(_buildTbody(dates));

  return table;
}

/* ── colgroup: fixed name col + one col per day ──────────────── */
function _buildColgroup(dates) {
  const cg = document.createElement("colgroup");

  const nameCol = document.createElement("col");
  nameCol.className = "col-name";
  cg.appendChild(nameCol);

  dates.forEach(() => {
    const col = document.createElement("col");
    col.className = "col-day";
    cg.appendChild(col);
  });

  return cg;
}

/* ── thead: weekday row + date number row ────────────────────── */
function _buildThead(dates) {
  const thead = document.createElement("thead");

  // Row 1 — weekday abbreviations
  const trDow = document.createElement("tr");
  trDow.className = "row-dow";

  const thEmpty = document.createElement("th");
  thEmpty.className = "th-name";
  thEmpty.textContent = "";
  trDow.appendChild(thEmpty);

  const dowNames = T.days; // ['日','一','二','三','四','五','六']
  dates.forEach((dateStr) => {
    const d = dayjs(dateStr);
    const dow = d.day(); // 0=Sun
    const th = document.createElement("th");
    th.className = "th-dow";

    const isWeekend = dow === 0 || dow === 6;
    const isHol = !!isHoliday(dateStr);
    if (isHol) th.classList.add("is-holiday");
    if (isWeekend) th.classList.add("is-weekend");

    th.textContent = dowNames[dow];
    trDow.appendChild(th);
  });
  thead.appendChild(trDow);

  // Row 2 — date numbers
  const trDate = document.createElement("tr");
  trDate.className = "row-date";

  const thLabel = document.createElement("th");
  thLabel.className = "th-name th-label";
  thLabel.textContent = T.staff_label || "員工";
  trDate.appendChild(thLabel);

  dates.forEach((dateStr) => {
    const d = dayjs(dateStr);
    const dow = d.day();
    const th = document.createElement("th");
    th.className = "th-date";

    const isWeekend = dow === 0 || dow === 6;
    const isHol = !!isHoliday(dateStr);
    if (isHol) th.classList.add("is-holiday");
    if (isWeekend) th.classList.add("is-weekend");

    // Holiday label tooltip
    if (isHol) {
      th.title = holidays[dateStr];
    }

    const numEl = document.createElement("span");
    numEl.className = "date-num";
    numEl.textContent = d.date();
    th.appendChild(numEl);

    if (isHol) {
      const dot = document.createElement("span");
      dot.className = "holiday-dot";
      th.appendChild(dot);
    }

    trDate.appendChild(th);
  });
  thead.appendChild(trDate);

  return thead;
}

/* ── tbody: one <tr> per employee ────────────────────────────── */
function _buildTbody(dates) {
  const tbody = document.createElement("tbody");
  const empList = activeStaff();

  if (empList.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = dates.length + 1;
    td.className = "empty-row";
    td.textContent = T.no_data || "尚無員工資料";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return tbody;
  }

  empList.forEach((emp) => {
    const tr = document.createElement("tr");
    tr.className = "emp-row";
    tr.dataset.empId = emp.id;

    // Name cell
    const tdName = document.createElement("td");
    tdName.className = "td-name";
    tdName.innerHTML = `
      <div class="emp-cell-inner">
        <div class="emp-avatar">${escapeHTML((emp.name[0] || "?").toUpperCase())}</div>
        <span class="emp-label">${escapeHTML(emp.name)}</span>
      </div>`;
    tr.appendChild(tdName);

    // Day cells
    dates.forEach((dateStr) => {
      const td = document.createElement("td");
      td.className = "td-cell";
      td.dataset.date = dateStr;
      td.dataset.empId = emp.id;

      const isHol = !!isHoliday(dateStr);
      if (isHol) td.classList.add("cell-holiday");

      // Check if this employee has leave on this date
      const hasLeave = leaves.some(
        (l) => l.date === dateStr && Number(l.staffId) === Number(emp.id),
      );
      if (hasLeave) td.classList.add("cell-leave");

      // Find which shifts this employee is assigned to on this date
      const ds = getDaySchedule(dateStr);
      const assignedShifts = shifts.filter((s) =>
        (ds[s.id] || []).some((id) => Number(id) === Number(emp.id)),
      );

      const inner = document.createElement("div");
      inner.className = "cell-inner";

      if (hasLeave && assignedShifts.length === 0) {
        // Show leave indicator
        const chip = document.createElement("span");
        chip.className = "cell-leave-chip";
        chip.textContent = T.leave || "休";
        inner.appendChild(chip);
      } else if (assignedShifts.length > 0) {
        assignedShifts.forEach((s) => {
          const chip = document.createElement("span");
          chip.className = "cell-shift-chip";
          chip.style.backgroundColor = hexToRgba(s.color || "#3b82f6", 0.18);
          chip.style.color = s.color || "#3b82f6";
          chip.style.borderColor = hexToRgba(s.color || "#3b82f6", 0.45);
          chip.textContent = s.name;
          chip.title = `${s.name} ${s.start}–${s.end}`;
          inner.appendChild(chip);
        });
      }

      td.appendChild(inner);
      const note = scheduleNotes[noteKey(dateStr, emp.id)];
      if (note) {
        td.classList.add("cell-has-note");
        td.title = (td.title ? td.title + "\n" : "") + `備註：${note}`;

        const noteMark = document.createElement("span");
        noteMark.className = "cell-note-mark";
        noteMark.textContent = "✎";
        td.appendChild(noteMark);
      }
      // ✅ 工時檢查放這裡
      const h = getDailyHours(dateStr, emp.id);
      if (h > 8) {
        td.classList.add("cell-illegal");

        const warn = document.createElement("span");
        warn.textContent = "!";
        warn.style.color = "red";
        warn.style.fontSize = "10px";

        td.appendChild(warn);
      }
      // Click → open quick-assign popover
      td.addEventListener("mousedown", (e) => {
        if (e.shiftKey) {
          isSelecting = true;
          shiftStartCell = td;
          _selectCell(td);
          updateSelectionText();
          e.preventDefault();
          return;
        }

        if (batchMode || e.ctrlKey || e.metaKey) {
          isSelecting = true;
          _toggleCell(td);
          updateSelectionText();
          e.preventDefault();
        }
      });

      td.addEventListener("mouseenter", () => {
        if (isSelecting && shiftStartCell) {
          selectRectCells(shiftStartCell, td);
          updateSelectionText();
          return;
        }

        if (isSelecting && batchMode) {
          _selectCell(td);
          updateSelectionText();
        }
      });

      td.addEventListener("mouseup", () => {
        isSelecting = false;
        shiftStartCell = null;
      });

      td.addEventListener("click", (e) => {
        if (e.shiftKey) return;

        _toggleCell(td);
        updateSelectionText();
      });

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  // ── Demand summary rows (one per shift) ──────────────────────
  shifts.forEach((s) => {
    const tr = document.createElement("tr");
    tr.className = "demand-row";

    const tdLabel = document.createElement("td");
    tdLabel.className = "td-name td-demand-label";
    tdLabel.innerHTML = `
      <span class="demand-shift-chip"
        style="background:${hexToRgba(s.color || "#3b82f6", 0.15)};
               color:${s.color || "#3b82f6"};
               border-color:${hexToRgba(s.color || "#3b82f6", 0.4)}">
        ${escapeHTML(s.name)}
      </span>
      <span class="demand-label-text">${T.required || "需求"}</span>`;
    tr.appendChild(tdLabel);

    dates.forEach((dateStr) => {
      const td = document.createElement("td");
      td.className = "td-cell td-demand";

      const isHol = !!isHoliday(dateStr);
      const ds = getDaySchedule(dateStr);
      const req = isHol ? 0 : getRequired(dateStr, s);
      const actual = (ds[s.id] || []).length;
      const ok = isHol || actual >= req;

      td.classList.add(ok ? "demand-ok" : "demand-short");

      td.innerHTML = isHol
        ? `<span class="demand-num demand-holiday">─</span>`
        : `<span class="demand-num">${actual}<span class="demand-sep">/</span>${req}</span>`;

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  return tbody;
}

/* ── Cell popover: quick shift toggle ───────────────────────── */
let _activePopover = null;
let shiftStartCell = null;
function _openCellPopover(tdEl, dateStr, emp) {
  // Close existing
  if (_activePopover) {
    _activePopover.remove();
    _activePopover = null;
    // If clicking the same cell again just close
    if (_activePopover === null && tdEl.dataset._popoverOpen) {
      delete tdEl.dataset._popoverOpen;
      return;
    }
  }

  const isHol = !!isHoliday(dateStr);
  const ds = getDaySchedule(dateStr);

  const popover = document.createElement("div");
  popover.className = "cell-popover";
  _activePopover = popover;
  tdEl.dataset._popoverOpen = "1";

  // Header
  const header = document.createElement("div");
  header.className = "popover-header";
  header.textContent = `${emp.name} · ${dateStr.slice(5)}`;
  popover.appendChild(header);

  if (isHol) {
    const note = document.createElement("div");
    note.className = "popover-holiday-note";
    note.textContent = `🎌 ${holidays[dateStr]}`;
    popover.appendChild(note);
  }

  // Shift toggles
  shifts.forEach((s) => {
    const assigned = ds[s.id] || [];
    const isAssigned = assigned.some((id) => Number(id) === Number(emp.id));

    const btn = document.createElement("button");
    btn.className = "popover-shift-btn" + (isAssigned ? " active" : "");
    btn.style.setProperty("--shift-color", s.color || "#3b82f6");
    btn.innerHTML = `
      <span class="psb-dot" style="background:${s.color || "#3b82f6"}"></span>
      <span class="psb-name">${escapeHTML(s.name)}</span>
      <span class="psb-time">${s.start}–${s.end}</span>
      <span class="psb-check">${isAssigned ? "✓" : ""}</span>`;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      _toggleEmpShift(dateStr, emp.id, s.id);

      // Refresh popover in place
      _activePopover = null;
      delete tdEl.dataset._popoverOpen;
      popover.remove();
      renderAll();
      // Re-open updated cell
      const newTd = document.querySelector(
        `.td-cell[data-date="${dateStr}"][data-emp-id="${emp.id}"]`,
      );
      if (newTd) _openCellPopover(newTd, dateStr, emp);
    });

    popover.appendChild(btn);
  });

  // Leave toggle
  const hasLeave = leaves.some(
    (l) => l.date === dateStr && Number(l.staffId) === Number(emp.id),
  );
  const leaveBtn = document.createElement("button");
  leaveBtn.className =
    "popover-shift-btn popover-leave-btn" + (hasLeave ? " active" : "");
  leaveBtn.innerHTML = `
    <span class="psb-dot" style="background:var(--red,#fca5a5)"></span>
    <span class="psb-name">${T.leave || "休假"}</span>
    <span class="psb-time"></span>
    <span class="psb-check">${hasLeave ? "✓" : ""}</span>`;
  leaveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (hasLeave) {
      leaves = leaves.filter(
        (l) => !(l.date === dateStr && Number(l.staffId) === Number(emp.id)),
      );
    } else {
      leaves.push({
        id: dayjs().valueOf(),
        staffId: emp.id,
        date: dateStr,
        reason: T.leave || "休假",
      });
    }
    _activePopover = null;
    delete tdEl.dataset._popoverOpen;
    popover.remove();
    saveAll();
    renderAll();
  });
  popover.appendChild(leaveBtn);

  // Position popover near the cell
  document.body.appendChild(popover);
  _positionPopover(popover, tdEl);

  // Close on outside click
  const closeHandler = (e) => {
    if (!popover.contains(e.target) && e.target !== tdEl) {
      popover.remove();
      _activePopover = null;
      delete tdEl.dataset._popoverOpen;
      document.removeEventListener("click", closeHandler, true);
    }
  };
  setTimeout(() => {
    document.addEventListener("click", closeHandler, true);
  }, 0);
}

function _positionPopover(popover, anchor) {
  const rect = anchor.getBoundingClientRect();
  const pw = 220;
  const ph = popover.offsetHeight || 200;

  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 4;

  // Keep within viewport
  if (left + pw > window.innerWidth - 8) {
    left = window.innerWidth - pw - 8;
  }
  if (top + ph > window.innerHeight + window.scrollY - 8) {
    top = rect.top + window.scrollY - ph - 4;
  }

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.width = `${pw}px`;
}

/* ── toggle helper ───────────────────────────────────────────── */
function _toggleEmpShift(dateStr, empId, shiftId) {
  const ds = getDaySchedule(dateStr);
  const assigned = ds[shiftId] || [];
  const idx = assigned.findIndex((id) => Number(id) === Number(empId));

  if (idx >= 0) {
    assigned.splice(idx, 1);
  } else {
    assigned.push(Number(empId));
  }

  ds[shiftId] = assigned;
  saveAll();
}
function _assignEmpShift(dateStr, empId, shiftId) {
  const ds = getDaySchedule(dateStr);
  ds[shiftId] = ds[shiftId] || [];
  if (!ds[shiftId].some((id) => Number(id) === Number(empId))) {
    ds[shiftId].push(Number(empId));
  }
}

/* ── CSS injected once ───────────────────────────────────────── */
(function injectStyles() {
  if (document.getElementById("excel-grid-styles")) return;
  const style = document.createElement("style");
  style.id = "excel-grid-styles";
  style.textContent = `

/* ── Wrapper ── */
.excel-grid-wrapper {
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

/* ── Table base ── */
.excel-table {
  border-collapse: collapse;
  table-layout: fixed;
  width: max-content;
  min-width: 100%;
  font-size: 12px;
}

/* ── Column widths ── */
.col-name { width: 120px; }
.col-day  { width: 68px;  min-width: 68px; }

/* ── Header cells ── */
.th-name {
  position: sticky;
  left: 0;
  z-index: 4;
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
  border-right: 2px solid var(--border-hover);
  padding: 6px 10px;
  text-align: left;
  font-size: 11px;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.th-dow, .th-date {
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  text-align: center;
  padding: 5px 2px;
  color: var(--muted);
  font-weight: 600;
  user-select: none;
}
.th-dow.is-weekend, .th-date.is-weekend {
  color: var(--blue);
  background: var(--blue-dim);
}
.th-dow.is-holiday, .th-date.is-holiday {
  color: var(--amber);
  background: var(--amber-dim);
}
.th-label {
  font-weight: 700;
  color: var(--muted);
  font-size: 11px;
}
.date-num {
  display: block;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.3;
}
.holiday-dot {
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--amber);
  margin: 2px auto 0;
}

/* ── Body rows ── */
.emp-row:hover .td-cell,
.emp-row:hover .td-name {
  background: rgba(255,255,255,.025);
}
.emp-row:nth-child(even) .td-cell,
.emp-row:nth-child(even) .td-name {
  background: rgba(255,255,255,.012);
}

.td-name {
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--surface);
  border-right: 2px solid var(--border-hover);
  border-bottom: 1px solid var(--border);
  padding: 4px 8px;
  white-space: nowrap;
}
.emp-cell-inner {
  display: flex;
  align-items: center;
  gap: 7px;
}
.emp-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--surface3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  color: var(--muted);
}
.emp-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 78px;
}

/* ── Day cells ── */
.td-cell {
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 2px 3px;
  vertical-align: middle;
  cursor: pointer;
  transition: background .1s;
  height: 40px;
}
.td-cell:hover {
  background: rgba(255,255,255,.06) !important;
}
.td-cell.cell-holiday {
  background: rgba(252,211,77,.06);
}
.td-cell.cell-leave {
  background: rgba(252,165,165,.06);
}

.cell-inner {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.cell-shift-chip {
  display: block;
  width: 100%;
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 3px;
  border-radius: 4px;
  border: 1px solid transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.cell-leave-chip {
  display: block;
  width: 100%;
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 3px;
  border-radius: 4px;
  background: var(--red-dim);
  color: var(--red);
  border: 1px solid rgba(252,165,165,.35);
  line-height: 1.3;
}

/* ── Demand rows ── */
.demand-row {
  border-top: 2px solid var(--border-hover);
}
.demand-row .td-name {
  background: var(--surface2);
}
.td-demand-label {
  padding: 5px 8px;
}
.demand-shift-chip {
  display: inline-flex;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid transparent;
  margin-right: 4px;
}
.demand-label-text {
  font-size: 10px;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.td-demand {
  text-align: center;
  background: var(--surface2) !important;
  cursor: default;
}
.td-demand:hover {
  background: var(--surface3) !important;
}
.demand-num {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
}
.demand-sep {
  color: var(--dim);
  margin: 0 1px;
}
.demand-holiday {
  color: var(--dim);
}
.demand-ok  .demand-num { color: var(--accent); }
.demand-short .demand-num { color: var(--red); }

.empty-row {
  text-align: center;
  padding: 32px;
  color: var(--dim);
  font-size: 13px;
}

/* ── Popover ── */
.cell-popover {
  position: fixed;
  z-index: 999;
  background: var(--surface);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0,0,0,.45);
  overflow: hidden;
  animation: popoverIn .12s ease;
}
@keyframes popoverIn {
  from { opacity: 0; transform: translateY(-4px) scale(.97); }
  to   { opacity: 1; transform: none; }
}
.popover-header {
  padding: 9px 12px 7px;
  font-weight: 700;
  font-size: 12px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
}
.popover-holiday-note {
  padding: 5px 12px;
  font-size: 11px;
  color: var(--amber);
  background: var(--amber-dim);
  border-bottom: 1px solid var(--border);
}
.popover-shift-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  cursor: pointer;
  text-align: left;
  transition: background .1s;
  font-size: 12px;
}
.popover-shift-btn:last-child { border-bottom: 0; }
.popover-shift-btn:hover { background: var(--surface2); color: var(--text); }
.popover-shift-btn.active {
  background: rgba(var(--shift-color-rgb,110,231,183),.08);
  color: var(--text);
}
.psb-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.psb-name {
  font-weight: 600;
  flex: 1;
  font-size: 12px;
}
.psb-time {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--dim);
}
.psb-check {
  font-size: 12px;
  color: var(--accent);
  width: 14px;
  text-align: center;
}
.popover-leave-btn .psb-dot { background: var(--red, #fca5a5); }
.popover-leave-btn.active   { background: var(--red-dim); color: var(--text); }
.cell-selected {
  outline: 2px solid #3b82f6;
  background: rgba(59,130,246,0.15) !important;
}

.cell-illegal {
  background: rgba(255,0,0,0.15) !important;
}
/* ── Mobile ── */
@media (max-width: 900px) {
  .col-name { width: 80px; }
  .col-day  { width: 52px; min-width: 52px; }
  .emp-label { max-width: 50px; font-size: 11px; }
  .emp-avatar { width: 20px; height: 20px; font-size: 10px; }
  .cell-shift-chip { font-size: 9px; padding: 1px 2px; }
  .td-cell { height: 36px; }
}
  `;
  document.head.appendChild(style);
})();
let selectedCells = new Set();
let isSelecting = false;
let batchMode = false;
let copiedCells = [];
let scheduleNotes = JSON.parse(localStorage.getItem("LumShift_notes") || "{}");

function saveNotes() {
  localStorage.setItem("LumShift_notes", JSON.stringify(scheduleNotes));
}

function noteKey(date, empId) {
  return `${date}|${empId}`;
}
function _cellKey(td) {
  return `${td.dataset.date}|${td.dataset.empId}`;
}

function _selectCell(td) {
  selectedCells.add(_cellKey(td));
  td.classList.add("cell-selected");
}
function _unselectCell(td) {
  selectedCells.delete(_cellKey(td));
  td.classList.remove("cell-selected");
}

function _toggleCell(td) {
  if (selectedCells.has(_cellKey(td))) {
    _unselectCell(td);
  } else {
    _selectCell(td);
  }
}
function _clearSelection() {
  selectedCells.clear();
  document
    .querySelectorAll(".cell-selected")
    .forEach((el) => el.classList.remove("cell-selected"));

  updateSelectionText();
}
function restoreSelectionUI() {
  document
    .querySelectorAll(".td-cell[data-date][data-emp-id]")
    .forEach((td) => {
      if (selectedCells.has(_cellKey(td))) {
        td.classList.add("cell-selected");
      }
    });

  updateSelectionText();
}
function applyShiftToSelected(shiftId) {
  selectedCells.forEach((key) => {
    const [date, empId] = key.split("|");
    _assignEmpShift(date, empId, shiftId);
  });

  saveAll();
  _clearSelection();
  renderAll();
}
function shiftHours(s) {
  const [sh, sm] = s.start.split(":").map(Number);
  const [eh, em] = s.end.split(":").map(Number);

  let start = sh * 60 + sm;
  let end = eh * 60 + em;

  if (end <= start) end += 24 * 60;

  return (end - start) / 60;
}

function getDailyHours(date, empId) {
  const ds = getDaySchedule(date);
  let total = 0;

  shifts.forEach((s) => {
    if ((ds[s.id] || []).includes(Number(empId))) {
      total += shiftHours(s);
    }
  });

  return total;
}
let copied = null;

function copySelection() {
  copied = [...selectedCells];
}

function pasteSelection() {
  if (!copied) return;

  const base = copied[0];

  copied.forEach((key, i) => {
    const [date, emp] = key.split("|");
    const [targetDate, targetEmp] = [...selectedCells][i]?.split("|") || [];

    if (!targetDate) return;

    const ds = getDaySchedule(date);
    shifts.forEach((s) => {
      if ((ds[s.id] || []).includes(Number(emp))) {
        _assignEmpShift(targetDate, targetEmp, s.id);
      }
    });
  });

  saveAll();
  renderAll();
}

function toggleBatchMode() {
  batchMode = !batchMode;

  const btn = document.getElementById("batch-mode-btn");
  if (btn) {
    btn.classList.toggle("active", batchMode);
    btn.textContent = batchMode ? "關閉批次" : "啟用批次";
  }
}

function updateSelectionText() {
  const el = document.getElementById("selected-count");
  if (el) el.textContent = `已選取 ${selectedCells.size}`;
}

function clearSelectionUI() {
  _clearSelection();
  updateSelectionText();
}

function copySelectedCells() {
  copiedCells = [...selectedCells].map((key) => {
    const [date, empId] = key.split("|");
    const ds = getDaySchedule(date);

    const shiftIds = shifts
      .filter((s) => (ds[s.id] || []).includes(Number(empId)))
      .map((s) => s.id);

    const leave = leaves.some(
      (l) => l.date === date && Number(l.staffId) === Number(empId),
    );

    return { shiftIds, leave };
  });

  showToast?.(`已複製 ${copiedCells.length} 格`);
}

function pasteToSelectedCells() {
  if (!copiedCells.length || !selectedCells.size) return;

  const targets = [...selectedCells];

  targets.forEach((key, i) => {
    const source = copiedCells[i % copiedCells.length];
    const [date, empId] = key.split("|");

    // 先清掉原本班次
    shifts.forEach((s) => {
      const ds = getDaySchedule(date);
      ds[s.id] = (ds[s.id] || []).filter((id) => Number(id) !== Number(empId));
    });

    // 貼上班次
    source.shiftIds.forEach((shiftId) => {
      const ds = getDaySchedule(date);
      ds[shiftId] = ds[shiftId] || [];
      if (!ds[shiftId].includes(Number(empId))) {
        ds[shiftId].push(Number(empId));
      }
    });

    // 貼上休假
    leaves = leaves.filter(
      (l) => !(l.date === date && Number(l.staffId) === Number(empId)),
    );

    if (source.leave) {
      leaves.push({
        id: dayjs().valueOf() + i,
        staffId: Number(empId),
        date,
        reason: T.leave || "休假",
      });
    }
  });

  saveAll();
  renderAll();
}

function selectBlankCells() {
  _clearSelection();

  document
    .querySelectorAll(".emp-row .td-cell[data-date][data-emp-id]")
    .forEach((td) => {
      const date = td.dataset.date;
      const empId = Number(td.dataset.empId);
      const ds = getDaySchedule(date);

      const hasShift = shifts.some((s) =>
        (ds[s.id] || []).some((id) => Number(id) === empId),
      );

      const hasLeave = leaves.some(
        (l) => l.date === date && Number(l.staffId) === empId,
      );

      if (!hasShift && !hasLeave) {
        selectedCells.add(_cellKey(td));
        td.classList.add("cell-selected");
      }
    });

  updateSelectionText();
}

function deleteSelectedCells() {
  selectedCells.forEach((key) => {
    const [date, empId] = key.split("|");
    const ds = getDaySchedule(date);

    shifts.forEach((s) => {
      ds[s.id] = (ds[s.id] || []).filter((id) => Number(id) !== Number(empId));
    });

    leaves = leaves.filter(
      (l) => !(l.date === date && Number(l.staffId) === Number(empId)),
    );
  });

  saveAll();
  _clearSelection();
  renderAll();
}

function openBatchAssignModal() {
  if (!selectedCells.size) {
    showToast?.("請先選取格子");
    return;
  }

  const shiftSel = document.getElementById("batch-shift");
  shiftSel.innerHTML = shifts
    .map((s) => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`)
    .join("");

  document.getElementById("batch-note").value = "";

  bootstrap.Modal.getOrCreateInstance(
    document.getElementById("batchAssignModal"),
  ).show();
}
function applyBatchAssignFromModal() {
  const action = document.getElementById("batch-action").value;
  const shiftId = Number(document.getElementById("batch-shift").value);
  const note = document.getElementById("batch-note").value.trim();

  if (action === "note") {
    selectedCells.forEach((key) => {
      const [date, empId] = key.split("|");
      if (note) scheduleNotes[noteKey(date, empId)] = note;
      else delete scheduleNotes[noteKey(date, empId)];
    });

    saveNotes();
  }

  if (action === "leave") {
    selectedCells.forEach((key, i) => {
      const [date, empId] = key.split("|");

      leaves = leaves.filter(
        (l) => !(l.date === date && Number(l.staffId) === Number(empId)),
      );

      leaves.push({
        id: dayjs().valueOf() + i,
        staffId: Number(empId),
        date,
        reason: T.leave || "休假",
      });

      if (note) scheduleNotes[noteKey(date, empId)] = note;
    });

    saveNotes();
  }

  if (action === "shift") {
    selectedCells.forEach((key) => {
      const [date, empId] = key.split("|");
      const ds = getDaySchedule(date);

      ds[shiftId] = ds[shiftId] || [];

      if (!ds[shiftId].includes(Number(empId))) {
        ds[shiftId].push(Number(empId));
      }

      if (note) scheduleNotes[noteKey(date, empId)] = note;
    });

    saveNotes();
  }

  saveAll();
  bootstrap.Modal.getOrCreateInstance(
    document.getElementById("batchAssignModal"),
  ).hide();

  _clearSelection();
  renderAll();
}
function selectRectCells(startTd, endTd) {
  const cells = [
    ...document.querySelectorAll(".td-cell[data-date][data-emp-id]"),
  ];

  const startDate = startTd.dataset.date;
  const endDate = endTd.dataset.date;
  const startEmp = Number(startTd.dataset.empId);
  const endEmp = Number(endTd.dataset.empId);

  const dates = [...new Set(cells.map((td) => td.dataset.date))].sort();
  const emps = [...new Set(cells.map((td) => Number(td.dataset.empId)))];

  const d1 = dates.indexOf(startDate);
  const d2 = dates.indexOf(endDate);
  const e1 = emps.indexOf(startEmp);
  const e2 = emps.indexOf(endEmp);

  const minD = Math.min(d1, d2);
  const maxD = Math.max(d1, d2);
  const minE = Math.min(e1, e2);
  const maxE = Math.max(e1, e2);

  _clearSelection();

  cells.forEach((td) => {
    const di = dates.indexOf(td.dataset.date);
    const ei = emps.indexOf(Number(td.dataset.empId));

    if (di >= minD && di <= maxD && ei >= minE && ei <= maxE) {
      _selectCell(td);
    }
  });
}
