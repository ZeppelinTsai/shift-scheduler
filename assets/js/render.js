function renderAll() {
  seedMonth();
  document.getElementById("month-label").textContent =
    `${cursor.getFullYear()} ${T.months[cursor.getMonth()]}`;
  renderStats();
  renderMonthGrid("dashboard-grid", true);
  renderMonthGrid("schedule-grid", false);
  renderStaff();
  renderShifts();
  renderHolidayList();
  renderLeaveList();
  renderLeaveStaffOptions();
}

function renderMonthGrid(id, compact) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = "";
  T.days.forEach((d) => {
    const h = document.createElement("div");
    h.className = "dow";
    h.textContent = d;
    el.appendChild(h);
  });
  monthDates(false).forEach((cell) => {
    const div = document.createElement("div");
    div.className = "day-card" + (!cell ? " muted" : "");
    if (!cell) {
      el.appendChild(div);
      return;
    }
    const date = ymd(cell.date);
    const ds = getDaySchedule(date);
    let badges = "";
    if (isHoliday(date))
      badges += `<span class="holiday-chip">${T.holiday}</span>`;
    const lf = leavesForDate(date);
    if (lf.length)
      badges += `<span class="leave-chip">${T.leave} ${lf.length}</span>`;
    div.innerHTML = `<div class="day-head"><div class="day-num">${cell.date.getDate()}</div><div>${badges}</div></div>`;
    shifts.forEach((s) => {
      const assigned = ds[s.id] || [];
      const isHol = !!isHoliday(date);
      const missing = isHol
        ? 0
        : Math.max(0, Number(s.required) - assigned.length);
      const holidayConflict = isHol && assigned.length > 0;
      const leaveConflict = assigned.some((id) =>
        leaves.some((l) => l.date === date && Number(l.staffId) === Number(id)),
      );
      const names =
        assigned
          .map((id) => staffById(id)?.name)
          .filter(Boolean)
          .join(", ") || T.none;
      const row = document.createElement("div");
      row.className =
        "shift-row " +
        (missing || holidayConflict || leaveConflict ? "bad" : "");
      row.innerHTML = `
      <span class="shift-name"
        style="background:${s.color || "#334155"};color:white;padding:2px 6px;border-radius:6px;">
        ${s.name}
      </span>
      <span class="shift-people">
        ${assigned.length}/${s.required} · ${names}
      </span>
      `;
      div.appendChild(row);
    });
    const btn = document.createElement("button");
    btn.className = "mini-btn";
    btn.textContent = T.edit;
    btn.onclick = () => openEditModal(date);
    div.appendChild(btn);
    el.appendChild(div);
  });
}
function renderStats() {
  let totalReq = 0,
    totalAss = 0,
    shiftCount = 0;
  const mk = monthKey();
  Object.keys(schedule[mk] || {}).forEach((date) => {
    shifts.forEach((s) => {
      totalReq += Number(s.required);
      const n = (schedule[mk][date][s.id] || []).length;
      totalAss += Math.min(n, Number(s.required));
      shiftCount += n;
    });
  });
  const hs = Object.keys(holidays).filter((k) => k.startsWith(mk)).length;
  document.getElementById("d-emp").textContent = isPro()
    ? `${staff.length}`
    : `${Math.min(staff.length, FREE_LIMIT)}/${FREE_LIMIT}`;
  document.getElementById("d-shifts").textContent = shiftCount;
  document.getElementById("d-holidays").textContent = hs;
  document.getElementById("d-cover").textContent = totalReq
    ? Math.round((totalAss / totalReq) * 100) + "%"
    : "—";
}
function renderStaff() {
  const tb = document.getElementById("staff-tbody");
  if (!tb) return;
  tb.innerHTML = "";
  staff.forEach((s, i) => {
    const roleOptions = ["general", "manager", "cook", "cashier"]
      .map(
        (role) =>
          `<option value="${role}" ${s.roleGroup === role ? "selected" : ""}>${roleGroupLabel(role)}</option>`,
      )
      .join("");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><div class="emp-cell"><div class="avatar">${s.name[0] || "?"}</div><div><div class="emp-name">${s.name}</div><div class="emp-role">ID ${s.id}</div></div></div></td><td><input value="${s.role || ""}" onchange="staff[${i}].role=this.value;saveAll();renderAll()" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px"></td><td><select onchange="staff[${i}].roleGroup=this.value;saveAll();renderAll()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px">${roleOptions}</select> ${!isPro() && i >= FREE_LIMIT ? '<span class="pro-chip">Pro</span>' : ""}

${
  isPro() || i < FREE_LIMIT
    ? `<span class="tag">${T.active}</span>`
    : `<span class="tag">${T.locked}</span>`
}</td><td><button class="mini-btn" onclick="removeStaff(${s.id})">${T.remove}</button></td>`;
    tb.appendChild(tr);
  });
}
function renderShifts() {
  const tb = document.getElementById("shift-tbody");
  if (!tb) return;
  tb.innerHTML = "";

  shifts.forEach((s, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
<td>
  <input value="${s.name}"
    onchange="shifts[${i}].name=this.value;saveAll();renderAll()"
    style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px">
</td>

<td>
  <input
    class="color-picker"
    type="color"
    value="${s.color || "#3b82f6"}"
    onchange="shifts[${i}].color=this.value;saveAll();renderAll()"
  />
</td>

<td>
  <input type="time" value="${s.start}"
    onchange="shifts[${i}].start=this.value;saveAll();renderAll()"
    style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px">
</td>

<td>
  <input type="time" value="${s.end}"
    onchange="shifts[${i}].end=this.value;saveAll();renderAll()"
    style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px">
</td>

<td>
  <input type="number" min="0" value="${s.required}"
    onchange="shifts[${i}].required=Number(this.value);saveAll();renderAll()"
    style="width:80px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px">
</td>

<td>
  <button class="mini-btn" onclick="removeShift(${i})">刪除</button>
</td>
`;

    tb.appendChild(tr);
  });

  tb.appendChild(tr);
}
function removeShift(index) {
  const id = shifts[index].id;

  // ❗ 清掉 schedule 裡的這個班
  const mk = monthKey();
  Object.keys(schedule[mk] || {}).forEach((date) => {
    delete schedule[mk][date][id];
  });

  shifts.splice(index, 1);

  saveAll();
  renderAll();
}
async function resetShifts() {
  const result = await Swal.fire({
    title: "恢復預設班次？",
    text: "目前班次設定與本月班表會被覆蓋。",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "恢復預設",
    cancelButtonText: "取消",
    reverseButtons: true,
  });

  if (!result.isConfirmed) return;

  shifts = [
    {
      id: 0,
      name: "早班",
      start: "08:00",
      end: "16:00",
      required: 1,
      roleGroup: "general",
      color: "#3b82f6",
    },
    {
      id: 1,
      name: "晚班",
      start: "16:00",
      end: "00:00",
      required: 1,
      roleGroup: "general",
      color: "#f97316",
    },
    {
      id: 2,
      name: "夜班",
      start: "00:00",
      end: "08:00",
      required: 1,
      roleGroup: "general",
      color: "#8b5cf6",
    },
  ];

  const mk = monthKey();
  Object.keys(schedule[mk] || {}).forEach((date) => {
    schedule[mk][date] = {};
  });

  saveAll();
  renderAll();
  showToast("已恢復預設班次");
}
function renderHolidayList() {
  const box = document.getElementById("holiday-list");
  if (!box) return;
  const entries = Object.entries(holidays)
    .filter(([d]) => d.startsWith(monthKey()))
    .sort();
  box.innerHTML = entries.length ? "" : `<div class="hint">${T.no_data}</div>`;
  entries.forEach(([date, name]) => {
    const item = document.createElement("div");
    item.className = "issue-item";
    item.innerHTML = `<b>${date}</b> · ${name}<button class="mini-btn" style="float:right" onclick="delete holidays['${date}'];saveAll();renderAll();showToast(T.toast_removed)">${T.remove}</button>`;
    box.appendChild(item);
  });
}
function renderLeaveStaffOptions() {
  const sel = document.getElementById("leave-staff");
  if (!sel) return;
  sel.innerHTML = activeStaff()
    .map((s) => `<option value="${s.id}">${s.name}</option>`)
    .join("");
}
function renderLeaveList() {
  const box = document.getElementById("leave-list");
  if (!box) return;
  const entries = leaves
    .filter((l) => l.date.startsWith(monthKey()))
    .sort((a, b) => a.date.localeCompare(b.date));
  box.innerHTML = entries.length ? "" : `<div class="hint">${T.no_data}</div>`;
  entries.forEach((l) => {
    const item = document.createElement("div");
    item.className = "issue-item";
    item.innerHTML = `<b>${l.date}</b> · ${staffById(l.staffId)?.name || l.staffId} · ${l.reason || T.leave}<button class="mini-btn" style="float:right" onclick="removeLeave(${l.id})">${T.remove}</button>`;
    box.appendChild(item);
  });
}
function addHoliday() {
  const d = document.getElementById("holiday-date").value;
  const n = document.getElementById("holiday-name").value.trim() || T.holiday;
  if (!d) return showToast(T.toast_date_required);
  holidays[d] = n;
  document.getElementById("holiday-name").value = "";
  saveAll();
  renderAll();
  showToast(T.toast_added);
}
function addLeave() {
  const d = document.getElementById("leave-date").value;
  const sid = Number(document.getElementById("leave-staff").value);
  const r = document.getElementById("leave-reason").value.trim() || T.leave;
  if (!d) return showToast(T.toast_date_required);
  leaves.push({ id: Date.now(), staffId: sid, date: d, reason: r });
  document.getElementById("leave-reason").value = "";
  saveAll();
  renderAll();
  showToast(T.toast_added);
}
function removeLeave(id) {
  leaves = leaves.filter((l) => l.id !== id);
  saveAll();
  renderAll();
  showToast(T.toast_removed);
}
function showStaffModal() {
  document.getElementById("staff-modal").classList.add("open");
}
function closeStaffModal() {
  document.getElementById("staff-modal").classList.remove("open");
}
function addStaff() {
  const name = document.getElementById("new-name").value.trim();
  if (!name) return showToast(T.toast_name_required);
  staff.push({
    id: Date.now(),
    code: "EMP-" + Date.now(),
    name,
    role: document.getElementById("new-role").value.trim() || "",
    roleGroup: document.getElementById("new-role-group").value,
    preferredShifts: [],
    avoidShifts: [],
  });
  document.getElementById("new-name").value = "";
  document.getElementById("new-role").value = "";
  closeStaffModal();
  saveAll();
  renderAll();
  showToast(T.toast_added);
}
function removeStaff(id) {
  staff = staff.filter((s) => s.id !== id);
  Object.values(schedule).forEach((month) =>
    Object.values(month).forEach((day) =>
      Object.keys(day).forEach(
        (code) => (day[code] = day[code].filter((x) => x !== id)),
      ),
    ),
  );
  leaves = leaves.filter((l) => l.staffId !== id);
  saveAll();
  renderAll();
  showToast(T.toast_removed);
}

function addShift() {
  const idx = shifts.length;

  shifts.push({
    id: idx,
    name: `${T.new_shift} ${idx + 1}`,
    start: "09:00",
    end: "17:00",
    required: 1,
    roleGroup: "general",
    color: "#22c55e",
  });

  saveAll();
  renderAll();
}
function openEditModal(date) {
  editingDate = date;
  document.getElementById("edit-title").textContent = `${T.edit} ${date}`;
  document.getElementById("edit-sub").innerHTML = [
    isHoliday(date)
      ? `<span class="holiday-chip">${holidays[date]}</span>`
      : "",
    ...leavesForDate(date).map(
      (l) =>
        `<span class="leave-chip">${staffById(l.staffId)?.name || ""} ${T.leave}</span>`,
    ),
  ].join(" ");
  const ds = getDaySchedule(date);
  const form = document.getElementById("edit-form");
  form.innerHTML = "";
  shifts.forEach((s) => {
    const wrap = document.createElement("div");
    wrap.className = "card";
    wrap.style.marginBottom = "10px";
    wrap.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b class="${shiftClasses[s.id] || ""}">${s.id} ${s.start}-${s.end}</b><span class="hint">${T.required}: ${s.required}</span></div>`;
    for (let i = 0; i < Math.max(Number(s.required), 1); i++) {
      const select = document.createElement("select");
      select.dataset.shift = s.id;
      select.style.cssText =
        "width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px;margin-bottom:7px";
      select.innerHTML =
        `<option value="">${T.none}</option>` +
        activeStaff()
          .map(
            (emp) =>
              `<option value="${emp.id}" ${(ds[s.id] || [])[i] === emp.id ? "selected" : ""}>${emp.name}</option>`,
          )
          .join("");
      wrap.appendChild(select);
    }
    form.appendChild(wrap);
  });
  document.getElementById("edit-modal").classList.add("open");
}
function closeEditModal() {
  document.getElementById("edit-modal").classList.remove("open");
}
function saveDaySchedule() {
  if (!editingDate) return;
  const ds = getDaySchedule(editingDate);
  shifts.forEach((s) => (ds[s.id] = []));
  document.querySelectorAll("#edit-form select").forEach((sel) => {
    if (sel.value) {
      const id = Number(sel.value);
      if (!ds[sel.dataset.shift].includes(id)) ds[sel.dataset.shift].push(id);
    }
  });
  saveAll();
  closeEditModal();
  renderAll();
  showToast(T.toast_saved);
}
function validateSchedule() {
  const issues = [];
  const mk = monthKey();
  let unmet = 0,
    leaveConflict = 0,
    holidayNotes = 0;

  Object.keys(schedule[mk] || {}).forEach((date) => {
    const ds = getDaySchedule(date);

    // ✅ 假日不檢查缺班，只檢查「有沒有誤排人」
    if (isHoliday(date)) {
      shifts.forEach((s) => {
        const assigned = ds[s.id] || [];
        assigned.forEach((id) => {
          holidayNotes++;
          issues.push({
            type: "bad",
            text: `${date} ${holidays[date]} · ${staffById(id)?.name} ${s.id}`,
          });
        });
      });
      return;
    }

    shifts.forEach((s) => {
      const assigned = ds[s.id] || [];
      const miss = Math.max(0, Number(s.required) - assigned.length);

      if (miss) {
        unmet++;
        issues.push({
          type: "bad",
          text: `${date} ${s.id}: ${T.missing(miss)}`,
        });
      }

      assigned.forEach((id) => {
        if (leaves.some((l) => l.date === date && l.staffId === id)) {
          leaveConflict++;
          issues.push({
            type: "bad",
            text: `${date} ${staffById(id)?.name} ${T.leave} / ${s.id}`,
          });
        }
      });
    });
  });

  const hoursByWeek = {};
  const streak = {};
  activeStaff().forEach((emp) => {
    let current = 0,
      max = 0;
    for (let day = 1; day <= daysInMonth(); day++) {
      const date = `${mk}-${pad(day)}`;
      const work = shifts.some((s) =>
        (getDaySchedule(date)[s.id] || []).includes(emp.id),
      );
      if (work) {
        current++;
        max = Math.max(max, current);
      } else current = 0;
      const d = new Date(date);
      const week = `${d.getFullYear()}-W${getISOWeek(date)}`;
      hoursByWeek[emp.id + "-" + week] =
        (hoursByWeek[emp.id + "-" + week] || 0) + (work ? 8 : 0);
    }
    if (max > 6)
      issues.push({
        type: "bad",
        text: T.consecutive_days_exceeded(emp.name, max),
      });
  });
  Object.keys(hoursByWeek).forEach((k) => {
    if (hoursByWeek[k] > 40) {
      const id = Number(k.split("-")[0]);
      issues.push({
        type: "bad",
        text: T.weekly_hours_exceeded(
          staffById(id)?.name || id,
          hoursByWeek[k],
        ),
      });
    }
  });
  const panel = document.getElementById("issue-panel");
  const list = document.getElementById("issue-list");
  list.innerHTML = "";
  if (!issues.length) {
    list.innerHTML = `<div class="issue-item">${T.valid_message}</div>`;
    showToast(T.valid_message);
  } else {
    list.innerHTML += unmet
      ? `<div class="issue-item bad"><b>${T.unmet_title(unmet)}</b></div>`
      : "";
    list.innerHTML += leaveConflict
      ? `<div class="issue-item bad"><b>${T.leave_conflict_title(leaveConflict)}</b></div>`
      : "";
    list.innerHTML += holidayNotes
      ? `<div class="issue-item"><b>${T.holiday_shift_title(holidayNotes)}</b></div>`
      : "";
    issues.slice(0, 120).forEach((i) => {
      const div = document.createElement("div");
      div.className = "issue-item " + (i.type === "bad" ? "bad" : "");
      div.textContent = i.text;
      list.appendChild(div);
    });
  }
  panel.classList.add("open");
}
function closeIssuePanel() {
  document.getElementById("issue-panel").classList.remove("open");
}

function exportCSV() {
  const rows = [[T.csv_date, T.csv_shift, T.csv_staff]];
  const mk = monthKey();
  Object.keys(schedule[mk] || {})
    .sort()
    .forEach((date) =>
      shifts.forEach((s) =>
        rows.push([
          date,
          s.id,
          (getDaySchedule(date)[s.id] || [])
            .map((id) => staffById(id)?.name || id)
            .join("|"),
        ]),
      ),
    );
  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `LumShift-${monthKey()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(T.toast_csv);
}
