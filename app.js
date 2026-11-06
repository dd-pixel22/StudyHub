
/* ==========================================
   STUDYHUB - STUDENT MANAGEMENT PORTAL
   Singly Linked List + LocalStorage
========================================== */

const STORAGE_KEY = "studyhub_portal_v1";

const $ = id => document.getElementById(id);

function uid() {
  return "SH" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function money(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function initials(name) {
  return String(name || "Student").trim().split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase();
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function dateLabel(date) {
  if (!date) return "";
  return new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

/* SINGLY LINKED LIST */

class StudentNode {
  constructor(data) {
    this.data = data;
    this.next = null;
  }
}

class StudentLinkedList {
  constructor() {
    this.head = null;
    this.length = 0;
  }

  add(data) {
    const node = new StudentNode(data);

    if (!this.head) {
      this.head = node;
    } else {
      let current = this.head;
      while (current.next) current = current.next;
      current.next = node;
    }

    this.length++;
    return node;
  }

  find(regNo) {
    let current = this.head;
    while (current) {
      if (current.data.regNo.toLowerCase() === String(regNo).toLowerCase()) {
        return current;
      }
      current = current.next;
    }
    return null;
  }

  delete(regNo) {
    if (!this.head) return false;

    if (this.head.data.regNo.toLowerCase() === String(regNo).toLowerCase()) {
      this.head = this.head.next;
      this.length--;
      return true;
    }

    let current = this.head;
    while (current.next) {
      if (current.next.data.regNo.toLowerCase() === String(regNo).toLowerCase()) {
        current.next = current.next.next;
        this.length--;
        return true;
      }
      current = current.next;
    }

    return false;
  }

  update(regNo, newData) {
    const node = this.find(regNo);
    if (!node) return false;
    node.data = newData;
    return true;
  }

  toArray() {
    const result = [];
    let current = this.head;
    while (current) {
      result.push(current.data);
      current = current.next;
    }
    return result;
  }

  get size() {
    return this.length;
  }
}

/* APPLICATION DATA */

let students = new StudentLinkedList();
let attendanceRecords = {};
let timetable = [];
let announcements = [];
let activityLog = [];
let institution = {
  name: "StudyHub Institution",
  year: "2026–2027"
};

let currentChart = null;
let editingId = null;
let modalMode = "";

function saveData() {
  const data = {
    students: students.toArray(),
    attendanceRecords,
    timetable,
    announcements,
    activityLog,
    institution
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    showToast("Unable to save data in this browser.");
    console.error(error);
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);

    students = new StudentLinkedList();
    (Array.isArray(data.students) ? data.students : []).forEach(s => students.add(s));

    attendanceRecords = data.attendanceRecords || {};
    timetable = Array.isArray(data.timetable) ? data.timetable : [];
    announcements = Array.isArray(data.announcements) ? data.announcements : [];
    activityLog = Array.isArray(data.activityLog) ? data.activityLog : [];
    institution = data.institution || institution;
  } catch (error) {
    console.error("Unable to load saved records:", error);
    students = new StudentLinkedList();
    attendanceRecords = {};
    timetable = [];
    announcements = [];
    activityLog = [];
  }
}

function recordActivity(message) {
  activityLog.unshift({
    id: uid(),
    message,
    time: new Date().toISOString()
  });

  activityLog = activityLog.slice(0, 100);
  saveData();
}

/* COMMON UI */

function showToast(message) {
  const container = $("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<i data-lucide="check-circle"></i><span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);

  if (window.lucide) lucide.createIcons();
  setTimeout(() => toast.remove(), 3000);
}

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

function showPage(page) {
  const target = $("page-" + page);
  if (!target) return;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  target.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  $("currentSection").textContent =
    document.querySelector(`.nav-link[data-page="${page}"]`)?.textContent.trim() || "Dashboard";

  $("sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });

  renderAll();
  refreshIcons();
}

function showEmpty(id, visible) {
  const element = $(id);
  if (element) element.classList.toggle("show", visible);
}

function openModal(title, fields, mode, id = null, submitText = "Save Record") {
  modalMode = mode;
  editingId = id;

  $("modalTitle").textContent = title;
  $("modalEyebrow").textContent = "STUDYHUB / MANAGEMENT";
  $("modalSubmit").textContent = submitText;

  $("modalBody").innerHTML = fields.map(field => {
    const full = field.full ? "full" : "";
    let control = "";

    if (field.type === "select") {
      control = `<select name="${field.name}" ${field.required === false ? "" : "required"}>
        ${field.options.map(option => {
          const value = typeof option === "string" ? option : option.value;
          const label = typeof option === "string" ? option : option.label;
          return `<option value="${escapeHTML(value)}" ${String(value) === String(field.value ?? "") ? "selected" : ""}>${escapeHTML(label)}</option>`;
        }).join("")}
      </select>`;
    } else if (field.type === "textarea") {
      control = `<textarea name="${field.name}" placeholder="${escapeHTML(field.placeholder || "")}" ${field.required === false ? "" : "required"}>${escapeHTML(field.value || "")}</textarea>`;
    } else {
      control = `<input name="${field.name}" type="${field.type || "text"}" value="${escapeHTML(field.value ?? "")}" placeholder="${escapeHTML(field.placeholder || "")}" ${field.required === false ? "" : "required"} ${field.min !== undefined ? `min="${field.min}"` : ""} ${field.max !== undefined ? `max="${field.max}"` : ""} ${field.step ? `step="${field.step}"` : ""}>`;
    }

    return `<div class="form-field ${full}">
      <label>${escapeHTML(field.label)}</label>${control}
    </div>`;
  }).join("");

  $("modalOverlay").classList.add("show");
  refreshIcons();
}

function closeModal() {
  $("modalOverlay").classList.remove("show");
  $("modalForm").reset();
  editingId = null;
  modalMode = "";
}

function fieldValue(form, name) {
  return form.elements[name]?.value.trim() ?? "";
}

function addStudentFields(student = {}) {
  return [
    { name:"regNo", label:"Registration Number", value:student.regNo, placeholder:"e.g. 251FA19001" },
    { name:"name", label:"Full Name", value:student.name, placeholder:"Student full name" },
    { name:"email", label:"Email Address", type:"email", value:student.email, placeholder:"student@example.com" },
    { name:"phone", label:"Phone Number", type:"tel", value:student.phone, placeholder:"Contact number" },
    { name:"course", label:"Course", type:"select", value:student.course || "B.Tech CSE", options:["B.Tech CSE","B.Tech ECE","B.Tech EEE","B.Tech IT","B.Tech Mechanical","B.Tech Civil","BCA","MCA","Other"] },
    { name:"year", label:"Academic Year", type:"select", value:student.year || "1st Year", options:["1st Year","2nd Year","3rd Year","4th Year"] },
    { name:"gender", label:"Gender", type:"select", value:student.gender || "Not specified", options:["Not specified","Female","Male","Other"] },
    { name:"dob", label:"Date of Birth", type:"date", value:student.dob || "", required:false },
    { name:"address", label:"Address", type:"textarea", value:student.address || "", placeholder:"Enter student address", full:true, required:false },
    { name:"totalFee", label:"Total Course Fee (₹)", type:"number", value:student.totalFee ?? 50000, min:0 },
    { name:"paidFee", label:"Fee Paid (₹)", type:"number", value:student.paidFee ?? 0, min:0 }
  ];
}

function openAddStudent() {
  openModal("Register New Student", addStudentFields(), "student");
}

function openEditStudent(regNo) {
  const node = students.find(regNo);
  if (!node) return;
  openModal("Edit Student Details", addStudentFields(node.data), "editStudent", regNo, "Update Student");
}

/* STUDENT OPERATIONS */

function createStudent(form) {
  const regNo = fieldValue(form, "regNo");
  const name = fieldValue(form, "name");
  const email = fieldValue(form, "email");
  const phone = fieldValue(form, "phone");
  const totalFee = Number(fieldValue(form, "totalFee"));
  const paidFee = Number(fieldValue(form, "paidFee"));

  if (students.find(regNo)) {
    showToast("Registration number already exists.");
    return false;
  }

  if (paidFee > totalFee) {
    showToast("Paid fee cannot exceed total fee.");
    return false;
  }

  const student = {
    id: uid(),
    regNo,
    name,
    email,
    phone,
    course: fieldValue(form, "course"),
    year: fieldValue(form, "year"),
    gender: fieldValue(form, "gender"),
    dob: fieldValue(form, "dob"),
    address: fieldValue(form, "address"),
    totalFee,
    paidFee,
    marks: [],
    createdAt: new Date().toISOString()
  };

  students.add(student);
  recordActivity(`Registered student ${name} (${regNo})`);
  return true;
}

function updateStudent(form) {
  const oldNode = students.find(editingId);
  if (!oldNode) return false;

  const regNo = fieldValue(form, "regNo");
  const duplicate = students.find(regNo);

  if (duplicate && regNo.toLowerCase() !== editingId.toLowerCase()) {
    showToast("This registration number is already in use.");
    return false;
  }

  const totalFee = Number(fieldValue(form, "totalFee"));
  const paidFee = Number(fieldValue(form, "paidFee"));

  if (paidFee > totalFee) {
    showToast("Paid fee cannot exceed total fee.");
    return false;
  }

  const updated = {
    ...oldNode.data,
    regNo,
    name: fieldValue(form, "name"),
    email: fieldValue(form, "email"),
    phone: fieldValue(form, "phone"),
    course: fieldValue(form, "course"),
    year: fieldValue(form, "year"),
    gender: fieldValue(form, "gender"),
    dob: fieldValue(form, "dob"),
    address: fieldValue(form, "address"),
    totalFee,
    paidFee
  };

  students.update(editingId, updated);
  recordActivity(`Updated student profile: ${updated.name}`);
  return true;
}

function deleteStudent(regNo) {
  const node = students.find(regNo);
  if (!node) return;

  if (!confirm(`Delete ${node.data.name} (${regNo})? This will also remove their related records.`)) return;

  students.delete(regNo);

  Object.keys(attendanceRecords).forEach(date => {
    delete attendanceRecords[date][regNo];
  });

  recordActivity(`Deleted student ${node.data.name} (${regNo})`);
  renderAll();
  showToast("Student record deleted.");
}

function studentCell(student) {
  return `<div class="student-cell">
    <div class="student-avatar">${escapeHTML(initials(student.name))}</div>
    <div><div class="student-name">${escapeHTML(student.name)}</div><div class="student-sub">${escapeHTML(student.email || "No email added")}</div></div>
  </div>`;
}

function feeStatus(student) {
  if (student.paidFee >= student.totalFee) return ["Paid","paid"];
  if (student.paidFee > 0) return ["Partial","partial"];
  return ["Pending","pending"];
}

function attendanceStats(student) {
  let present = 0, absent = 0;
  Object.values(attendanceRecords).forEach(day => {
    if (day[student.regNo] === "Present") present++;
    if (day[student.regNo] === "Absent") absent++;
  });

  const total = present + absent;
  return {
    present,
    absent,
    total,
    rate: total ? Math.round(present / total * 100) : 0
  };
}

function averageMarks(student) {
  if (!student.marks.length) return 0;
  return Math.round(student.marks.reduce((sum, m) => sum + Number(m.score), 0) / student.marks.length);
}

/* DASHBOARD */

function renderDashboard() {
  const list = students.toArray();
  const total = list.length;

  const avgAttendance = total
    ? Math.round(list.reduce((sum,s) => sum + attendanceStats(s).rate,0) / total)
    : 0;

  const scores = list.flatMap(s => s.marks.map(m => Number(m.score)));
  const avgMarks = scores.length
    ? Math.round(scores.reduce((a,b) => a+b,0) / scores.length)
    : 0;

  const pending = list.reduce((sum,s) => sum + Math.max(0,s.totalFee-s.paidFee),0);

  $("totalStudents").textContent = total;
  $("averageAttendance").textContent = avgAttendance;
  $("averageMarks").textContent = avgMarks;
  $("pendingFees").textContent = money(pending);

  let present = 0, absent = 0;
  list.forEach(s => {
    const a = attendanceStats(s);
    present += a.present;
    absent += a.absent;
  });

  const rate = present + absent ? Math.round(present / (present + absent) * 100) : 0;
  $("attendanceRingValue").textContent = rate + "%";
  $("attendanceRing").style.background =
    `conic-gradient(var(--primary) ${rate * 3.6}deg, #eeeaf7 0deg)`;
  $("presentTotal").textContent = present;
  $("absentTotal").textContent = absent;

  const recent = [...list].reverse().slice(0,5);
  $("recentStudentsTable").innerHTML = recent.map(s => {
    const a = attendanceStats(s);
    const f = feeStatus(s);
    return `<tr>
      <td>${studentCell(s)}</td>
      <td>${escapeHTML(s.regNo)}</td>
      <td>${escapeHTML(s.course)}</td>
      <td>${a.rate}%</td>
      <td><span class="status ${f[1]}">${f[0]}</span></td>
    </tr>`;
  }).join("");

  showEmpty("recentEmpty", total === 0);
  renderChart();
}

function renderChart() {
  const canvas = $("performanceChart");
  if (!canvas || !window.Chart) return;

  const list = students.toArray();
  const scores = list.flatMap(s => s.marks.map(m => Number(m.score)));
  const groups = [
    scores.filter(x => x >= 80).length,
    scores.filter(x => x >= 60 && x < 80).length,
    scores.filter(x => x >= 40 && x < 60).length,
    scores.filter(x => x < 40).length
  ];

  if (currentChart) currentChart.destroy();

  currentChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["80–100","60–79","40–59","Below 40"],
      datasets: [{
        label: "Subject scores",
        data: groups,
        backgroundColor: ["#7657dc","#79a0e9","#54b99b","#e58b9b"],
        borderRadius: 7,
        maxBarThickness: 42
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display:false } },
      scales: {
        y: { beginAtZero:true, ticks:{ precision:0 }, grid:{ color:"rgba(130,120,160,.10)" } },
        x: { grid:{ display:false } }
      }
    }
  });
}

/* STUDENT DIRECTORY */

function renderStudents() {
  const query = ($("studentSearch")?.value || "").toLowerCase();
  const course = $("courseFilter")?.value || "";
  const year = $("yearFilter")?.value || "";

  const filtered = students.toArray().filter(s => {
    const matches = s.name.toLowerCase().includes(query) || s.regNo.toLowerCase().includes(query);
    return matches && (!course || s.course === course) && (!year || s.year === year);
  });

  $("studentCount").textContent = filtered.length;

  $("studentsTable").innerHTML = filtered.map(s => {
    const a = attendanceStats(s);
    const f = feeStatus(s);
    return `<tr>
      <td>${studentCell(s)}</td>
      <td>${escapeHTML(s.regNo)}</td>
      <td>${escapeHTML(s.course)}<div class="student-sub">${escapeHTML(s.year)}</div></td>
      <td>${escapeHTML(s.email || "—")}</td>
      <td>${a.rate}%</td>
      <td><span class="status ${f[1]}">${f[0]}</span></td>
      <td><div class="action-buttons">
        <button class="action-btn" data-edit-student="${escapeHTML(s.regNo)}" title="Edit"><i data-lucide="pencil"></i></button>
        <button class="action-btn delete" data-delete-student="${escapeHTML(s.regNo)}" title="Delete"><i data-lucide="trash-2"></i></button>
      </div></td>
    </tr>`;
  }).join("");

  showEmpty("studentsEmpty", filtered.length === 0);
}

/* ATTENDANCE */

function renderAttendance() {
  const date = $("attendanceDate").value || today();
  const list = students.toArray();
  const records = attendanceRecords[date] || {};

  let present = 0, absent = 0, unmarked = 0;

  $("attendanceTable").innerHTML = list.map(s => {
    const status = records[s.regNo] || "";
    if (status === "Present") present++;
    else if (status === "Absent") absent++;
    else unmarked++;

    return `<tr>
      <td>${studentCell(s)}</td>
      <td>${escapeHTML(s.regNo)}</td>
      <td>${escapeHTML(s.course)}</td>
      <td><select class="attendance-select" data-attendance-id="${escapeHTML(s.regNo)}">
        <option value="" ${!status ? "selected" : ""}>Not marked</option>
        <option value="Present" ${status === "Present" ? "selected" : ""}>Present</option>
        <option value="Absent" ${status === "Absent" ? "selected" : ""}>Absent</option>
      </select></td>
    </tr>`;
  }).join("");

  $("todayPresent").textContent = present;
  $("todayAbsent").textContent = absent;
  $("notMarked").textContent = unmarked;
  $("todayRate").textContent = present + absent ? Math.round(present/(present+absent)*100) : 0;

  showEmpty("attendanceEmpty", list.length === 0);
}

function saveAttendance() {
  const date = $("attendanceDate").value;
  if (!date) return showToast("Select an attendance date.");

  const records = { ...(attendanceRecords[date] || {}) };

  document.querySelectorAll("[data-attendance-id]").forEach(select => {
    if (select.value) records[select.dataset.attendanceId] = select.value;
    else delete records[select.dataset.attendanceId];
  });

  attendanceRecords[date] = records;
  recordActivity(`Attendance saved for ${dateLabel(date)}`);
  renderAll();
  showToast("Attendance saved successfully.");
}

/* MARKS & RESULTS */

function grade(score) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  if (score >= 40) return "E";
  return "F";
}

function openMarksModal(regNo = "") {
  if (!students.size) return showToast("Register a student first.");

  const fields = [
    { name:"student", label:"Select Student", type:"select", options:students.toArray().map(s => ({value:s.regNo,label:`${s.name} (${s.regNo})`})), value:regNo || students.head.data.regNo },
    { name:"subject", label:"Subject", placeholder:"e.g. Data Structures" },
    { name:"exam", label:"Examination", type:"select", options:["Internal Assessment 1","Internal Assessment 2","Mid Examination","Semester Examination","Practical Examination"] },
    { name:"score", label:"Marks Obtained", type:"number", min:0, max:100, placeholder:"0 - 100" },
    { name:"date", label:"Examination Date", type:"date", value:today() }
  ];

  openModal("Update Examination Marks", fields, "marks");
}

function renderMarks() {
  const list = students.toArray();
  const entries = list.flatMap(s => s.marks.map((m,index) => ({...m,student:s,index})));
  const scores = entries.map(m => Number(m.score));
  const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;

  $("marksAverage").textContent = avg;
  $("marksHighest").textContent = scores.length ? Math.max(...scores) : 0;
  $("marksPassed").textContent = scores.filter(x=>x>=40).length;
  $("marksFailed").textContent = scores.filter(x=>x<40).length;

  $("marksTable").innerHTML = entries.map(m => `
    <tr>
      <td>${studentCell(m.student)}</td>
      <td>${escapeHTML(m.student.regNo)}</td>
      <td>${escapeHTML(m.subject)}<div class="student-sub">${escapeHTML(m.exam)}</div></td>
      <td><strong>${m.score}/100</strong></td>
      <td><strong>${grade(Number(m.score))}</strong></td>
      <td><span class="status ${m.score>=40?"passed":"failed"}">${m.score>=40?"Pass":"Fail"}</span></td>
      <td><div class="action-buttons"><button class="action-btn delete" data-delete-mark="${escapeHTML(m.student.regNo)}" data-mark-index="${m.index}" title="Delete marks"><i data-lucide="trash-2"></i></button></div></td>
    </tr>`).join("");

  showEmpty("marksEmpty", entries.length === 0);
}

/* FEES */

function openFeeModal(regNo = "") {
  if (!students.size) return showToast("Register a student first.");

  const options = students.toArray().map(s => ({
    value:s.regNo, label:`${s.name} (${s.regNo})`
  }));

  openModal("Record Fee Payment", [
    {name:"student",label:"Select Student",type:"select",options,value:regNo || students.head.data.regNo},
    {name:"amount",label:"Payment Amount (₹)",type:"number",min:1,placeholder:"Enter payment amount"},
    {name:"method",label:"Payment Method",type:"select",options:["Cash","UPI","Bank Transfer","Card","Other"]},
    {name:"date",label:"Payment Date",type:"date",value:today()},
    {name:"reference",label:"Transaction Reference",placeholder:"Optional reference",required:false}
  ], "payment");
}

function renderFees() {
  const list = students.toArray();
  const total = list.reduce((a,s)=>a+Number(s.totalFee),0);
  const paid = list.reduce((a,s)=>a+Number(s.paidFee),0);
  const balance = Math.max(0,total-paid);

  $("totalFees").textContent = money(total);
  $("collectedFees").textContent = money(paid);
  $("outstandingFees").textContent = money(balance);
  $("fullyPaidCount").textContent = list.filter(s=>s.paidFee>=s.totalFee).length;

  $("feesTable").innerHTML = list.map(s => {
    const remaining = Math.max(0,s.totalFee-s.paidFee);
    const f = feeStatus(s);

    return `<tr>
      <td>${studentCell(s)}</td>
      <td>${escapeHTML(s.regNo)}</td>
      <td>${money(s.totalFee)}</td>
      <td>${money(s.paidFee)}</td>
      <td><strong>${money(remaining)}</strong></td>
      <td><span class="status ${f[1]}">${f[0]}</span></td>
      <td><button class="action-btn" data-record-payment="${escapeHTML(s.regNo)}" title="Record payment"><i data-lucide="plus"></i></button></td>
    </tr>`;
  }).join("");

  showEmpty("feesEmpty", list.length===0);
}

/* TIMETABLE */

function renderTimetable() {
  const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const sorted = [...timetable].sort((a,b)=>days.indexOf(a.day)-days.indexOf(b.day) || a.time.localeCompare(b.time));

  $("timetableTable").innerHTML = sorted.map(item => `
    <tr>
      <td><strong>${escapeHTML(item.day)}</strong></td>
      <td>${escapeHTML(item.time)}</td>
      <td>${escapeHTML(item.subject)}</td>
      <td>${escapeHTML(item.faculty)}</td>
      <td>${escapeHTML(item.room)}</td>
      <td><button class="action-btn delete" data-delete-class="${escapeHTML(item.id)}"><i data-lucide="trash-2"></i></button></td>
    </tr>`).join("");

  showEmpty("timetableEmpty", sorted.length===0);
}

function openClassModal() {
  openModal("Add Timetable Entry", [
    {name:"day",label:"Day",type:"select",options:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]},
    {name:"time",label:"Time",type:"text",placeholder:"09:00 AM - 10:00 AM"},
    {name:"subject",label:"Subject",placeholder:"Subject name"},
    {name:"faculty",label:"Faculty",placeholder:"Faculty name"},
    {name:"room",label:"Room",placeholder:"Room number"}
  ],"class");
}

/* ANNOUNCEMENTS */

function renderAnnouncements() {
  $("announcementList").innerHTML = announcements.map(a => `
    <article class="announcement-card">
      <div class="announcement-icon"><i data-lucide="megaphone"></i></div>
      <div class="announcement-content">
        <h3>${escapeHTML(a.title)}</h3>
        <p>${escapeHTML(a.message)}</p>
        <small>${escapeHTML(a.category)} · ${escapeHTML(dateLabel(a.date))}</small>
      </div>
      <button class="action-btn delete" data-delete-announcement="${escapeHTML(a.id)}"><i data-lucide="trash-2"></i></button>
    </article>`).join("");

  showEmpty("announcementsEmpty", announcements.length===0);
}

function openAnnouncementModal() {
  openModal("Publish Announcement", [
    {name:"title",label:"Announcement Title",placeholder:"Enter notice title",full:true},
    {name:"category",label:"Category",type:"select",options:["General Notice","Examination","Holiday","Fees","Events","Academic Update"]},
    {name:"date",label:"Publish Date",type:"date",value:today()},
    {name:"message",label:"Announcement Details",type:"textarea",full:true,placeholder:"Write your announcement..."}
  ],"announcement");
}

/* REPORTS AND ACTIVITY */

function renderReports() {
  const list = students.toArray();
  const scores = list.flatMap(s=>s.marks.map(m=>Number(m.score)));
  const attendance = list.length ? Math.round(list.reduce((a,s)=>a+attendanceStats(s).rate,0)/list.length) : 0;
  const avgMarks = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
  const total = list.reduce((a,s)=>a+s.totalFee,0);
  const paid = list.reduce((a,s)=>a+s.paidFee,0);
  const collection = total ? Math.round(paid/total*100) : 0;

  $("reportStudents").textContent = list.length;
  $("reportAttendance").textContent = attendance;
  $("reportMarks").textContent = avgMarks;
  $("reportCollection").textContent = collection + "%";

  $("reportTable").innerHTML = list.map(s => {
    const a = attendanceStats(s);
    const balance = s.totalFee-s.paidFee;
    const avg = averageMarks(s);
    const status = balance===0 && a.rate>=75 && avg>=40;
    return `<tr>
      <td>${studentCell(s)}</td>
      <td>${escapeHTML(s.regNo)}</td>
      <td>${a.rate}%</td>
      <td>${s.marks.length ? avg : "—"}</td>
      <td>${money(balance)}</td>
      <td><span class="status ${status?"paid":"pending"}">${status?"On Track":"Review"}</span></td>
    </tr>`;
  }).join("");
}

function renderActivity() {
  const page = $("page-activity");
  if (!page) return;

  let container = $("activityContent");
  if (!container) {
    container = document.createElement("div");
    container.id = "activityContent";
    container.className = "panel";
    page.appendChild(container);
  }

  container.innerHTML = activityLog.length
    ? activityLog.map(a=>`<div style="padding:13px 3px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px">
        <span style="font-size:11px">${escapeHTML(a.message)}</span>
        <small style="font-size:9px;color:var(--muted)">${new Date(a.time).toLocaleString("en-IN")}</small>
      </div>`).join("")
    : `<div class="empty-state show"><i data-lucide="history"></i><strong>No activity recorded</strong><span>Your management actions will appear here.</span></div>`;
}

/* EXPORTS */

function downloadFile(filename, content, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  const rows = [
    ["Registration ID","Name","Email","Phone","Course","Year","Attendance %","Average Marks","Total Fees","Paid Fees","Balance","Fee Status"]
  ];

  students.toArray().forEach(s=>{
    const a = attendanceStats(s);
    rows.push([
      s.regNo,s.name,s.email,s.phone,s.course,s.year,a.rate,
      averageMarks(s),s.totalFee,s.paidFee,s.totalFee-s.paidFee,feeStatus(s)[0]
    ]);
  });

  const csv = rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  downloadFile("StudyHub_Student_Report.csv","\uFEFF"+csv,"text/csv;charset=utf-8");
  showToast("Student report exported.");
}

function exportBackup() {
  const data = {
    students:students.toArray(),
    attendanceRecords,timetable,announcements,activityLog,institution
  };
  downloadFile("StudyHub_Backup.json",JSON.stringify(data,null,2),"application/json");
  showToast("Workspace backup downloaded.");
}

/* RENDER ALL */

function renderAll() {
  renderDashboard();
  renderStudents();
  renderAttendance();
  renderMarks();
  renderFees();
  renderTimetable();
  renderAnnouncements();
  renderReports();
  renderActivity();
  refreshIcons();
}

/* FORM SUBMISSION */

$("modalForm").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;

  if (!form.reportValidity()) return;

  let success = false;

  if (modalMode === "student") {
    success = createStudent(form);
  }

  if (modalMode === "editStudent") {
    success = updateStudent(form);
  }

  if (modalMode === "marks") {
    const regNo = fieldValue(form,"student");
    const node = students.find(regNo);
    const score = Number(fieldValue(form,"score"));

    if (!node || score < 0 || score > 100) {
      showToast("Please enter valid marks between 0 and 100.");
      return;
    }

    node.data.marks.push({
      id:uid(),
      subject:fieldValue(form,"subject"),
      exam:fieldValue(form,"exam"),
      score,
      date:fieldValue(form,"date")
    });

    recordActivity(`Updated ${fieldValue(form,"subject")} marks for ${node.data.name}`);
    success = true;
  }

  if (modalMode === "payment") {
    const node = students.find(fieldValue(form,"student"));
    const amount = Number(fieldValue(form,"amount"));

    if (!node || amount <= 0) {
      showToast("Enter a valid payment.");
      return;
    }

    if (node.data.paidFee + amount > node.data.totalFee) {
      showToast("Payment exceeds the student's outstanding balance.");
      return;
    }

    node.data.paidFee += amount;
    recordActivity(`Recorded ${money(amount)} fee payment for ${node.data.name}`);
    success = true;
  }

  if (modalMode === "class") {
    timetable.push({
      id:uid(),
      day:fieldValue(form,"day"),
      time:fieldValue(form,"time"),
      subject:fieldValue(form,"subject"),
      faculty:fieldValue(form,"faculty"),
      room:fieldValue(form,"room")
    });
    recordActivity("Added a timetable entry.");
    success = true;
  }

  if (modalMode === "announcement") {
    announcements.unshift({
      id:uid(),
      title:fieldValue(form,"title"),
      category:fieldValue(form,"category"),
      date:fieldValue(form,"date"),
      message:fieldValue(form,"message")
    });
    recordActivity("Published a new announcement.");
    success = true;
  }

  if (success) {
    closeModal();
    saveData();
    renderAll();
    showToast("Changes saved successfully.");
  }
});

/* EVENT LISTENERS */

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click",()=>showPage(button.dataset.page));
});

document.querySelectorAll("[data-goto]").forEach(button=>{
  button.addEventListener("click",()=>showPage(button.dataset.goto));
});

$("topAddBtn").addEventListener("click",openAddStudent);
$("addStudentBtn").addEventListener("click",openAddStudent);
$("closeModal").addEventListener("click",closeModal);
$("cancelModal").addEventListener("click",closeModal);

$("modalOverlay").addEventListener("click",event=>{
  if (event.target === $("modalOverlay")) closeModal();
});

document.addEventListener("keydown",event=>{
  if (event.key==="Escape") closeModal();
});

$("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));

$("studentSearch").addEventListener("input",renderStudents);
$("courseFilter").addEventListener("change",renderStudents);
$("yearFilter").addEventListener("change",renderStudents);

$("clearFilters").addEventListener("click",()=>{
  $("studentSearch").value="";
  $("courseFilter").value="";
  $("yearFilter").value="";
  renderStudents();
});

$("attendanceDate").addEventListener("change",renderAttendance);
$("saveAttendanceBtn").addEventListener("click",saveAttendance);

$("addMarksBtn").addEventListener("click",()=>openMarksModal());
$("recordPaymentBtn").addEventListener("click",()=>openFeeModal());
$("addClassBtn").addEventListener("click",openClassModal);
$("addAnnouncementBtn").addEventListener("click",openAnnouncementModal);

$("exportBtn").addEventListener("click",exportCSV);
$("studentExportBtn").addEventListener("click",exportCSV);
$("reportExportBtn").addEventListener("click",exportCSV);
$("backupBtn").addEventListener("click",exportBackup);

document.querySelectorAll("[data-action]").forEach(button=>{
  button.addEventListener("click",()=>{
    const action = button.dataset.action;
    if (action==="add") openAddStudent();
    else if (action==="attendance") showPage("attendance");
    else if (action==="marks") showPage("marks");
    else if (action==="fees") showPage("fees");
    else if (action==="linkedlist") showPage("students");
    else if (action==="search") {
      showPage("students");
      $("studentSearch").focus();
    }
    else if (action==="export") exportCSV();
  });
});

document.addEventListener("click",event=>{
  const edit = event.target.closest("[data-edit-student]");
  const remove = event.target.closest("[data-delete-student]");
  const payment = event.target.closest("[data-record-payment]");
  const markDelete = event.target.closest("[data-delete-mark]");
  const classDelete = event.target.closest("[data-delete-class]");
  const announcementDelete = event.target.closest("[data-delete-announcement]");

  if (edit) openEditStudent(edit.dataset.editStudent);

  if (remove) deleteStudent(remove.dataset.deleteStudent);

  if (payment) openFeeModal(payment.dataset.recordPayment);

  if (markDelete) {
    const node = students.find(markDelete.dataset.deleteMark);
    const index = Number(markDelete.dataset.markIndex);
    if (node && confirm("Delete this examination result?")) {
      node.data.marks.splice(index,1);
      recordActivity(`Deleted an examination result for ${node.data.name}`);
      renderAll();
      showToast("Result deleted.");
    }
  }

  if (classDelete) {
    if (confirm("Delete this timetable entry?")) {
      timetable = timetable.filter(item=>item.id!==classDelete.dataset.deleteClass);
      recordActivity("Deleted a timetable entry.");
      renderAll();
      showToast("Class entry deleted.");
    }
  }

  if (announcementDelete) {
    if (confirm("Delete this announcement?")) {
      announcements = announcements.filter(item=>item.id!==announcementDelete.dataset.deleteAnnouncement);
      recordActivity("Deleted an announcement.");
      renderAll();
      showToast("Announcement deleted.");
    }
  }
});

/* SETTINGS */

$("saveSettingsBtn").addEventListener("click",()=>{
  institution.name = $("institutionName").value.trim() || "StudyHub Institution";
  institution.year = $("academicYear").value.trim() || "2026–2027";
  saveData();
  recordActivity("Updated institution preferences.");
  showToast("Preferences saved.");
});

$("resetBtn").addEventListener("click",()=>{
  if (!confirm("Are you sure? This will permanently delete ALL StudyHub data saved in this browser.")) return;

  localStorage.removeItem(STORAGE_KEY);
  students = new StudentLinkedList();
  attendanceRecords = {};
  timetable = [];
  announcements = [];
  activityLog = [];
  institution = {name:"StudyHub Institution",year:"2026–2027"};

  renderAll();
  showToast("Portal data has been reset.");
});

$("themeBtn").addEventListener("click",()=>{
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  localStorage.setItem("studyhub_theme",dark?"dark":"light");
  $("themeBtn").innerHTML = dark
    ? '<i data-lucide="sun"></i>'
    : '<i data-lucide="moon"></i>';
  refreshIcons();
});

$("notificationBtn").addEventListener("click",()=>{
  const unpaid = students.toArray().filter(s=>s.paidFee<s.totalFee).length;
  const unmarked = students.toArray().filter(s=>!attendanceRecords[today()]?.[s.regNo]).length;

  alert(
    "STUDYHUB NOTIFICATIONS\n\n" +
    "Students with pending fees: " + unpaid + "\n" +
    "Students awaiting today's attendance: " + unmarked + "\n" +
    "Announcements: " + announcements.length
  );
});

/* INITIALIZATION */

function initializePortal() {
  loadData();

  $("todayDate").textContent = new Date().toLocaleDateString("en-IN",{
    weekday:"long",day:"numeric",month:"long",year:"numeric"
  });

  $("attendanceDate").value = today();
  $("institutionName").value = institution.name;
  $("academicYear").value = institution.year;

  const savedTheme = localStorage.getItem("studyhub_theme");
  if (savedTheme==="dark") {
    document.body.classList.add("dark");
    $("themeBtn").innerHTML='<i data-lucide="sun"></i>';
  }

  const courseFilter = $("courseFilter");
  const courses = [...new Set(students.toArray().map(s=>s.course))];

  courses.forEach(course=>{
    const option = document.createElement("option");
    option.value=course;
    option.textContent=course;
    courseFilter.appendChild(option);
  });

  renderAll();
}

initializePortal();
