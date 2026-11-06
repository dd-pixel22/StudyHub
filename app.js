
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  initializeAuth,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

/* ==========================================
   1. FIREBASE CONFIGURATION
========================================== */

const firebaseConfig = {
  apiKey: "AIzaSyDbp7MMX5jgYgM5H2KpUGYryWMuecwaroY",
  authDomain: "studyhub-139ef.firebaseapp.com",
  projectId: "studyhub-139ef",
  storageBucket: "studyhub-139ef.firebasestorage.app",
  messagingSenderId: "747349756102",
  appId: "1:747349756102:web:cf68eeeb7b91e54ab82fc7"
};

const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const auth = initializeAuth(firebaseApp, {
  persistence: inMemoryPersistence
});

const db = getFirestore(firebaseApp);

/* ==========================================
   2. APPLICATION STATE
========================================== */

const SUBJECTS = ["DS", "DBMS", "MFCS", "FOIS", "CN", "OOPS"];

const DAYS = [
  "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday"
];

const PERIODS = [
  { start: "08:15", end: "09:00" },
  { start: "09:00", end: "09:45" },
  { start: "09:45", end: "10:00" },
  { start: "10:15", end: "11:00" },
  { start: "11:00", end: "11:45" },
  { start: "11:45", end: "12:00" },
  { start: "13:00", end: "13:45" },
  { start: "13:45", end: "14:30" },
  { start: "14:30", end: "15:15" },
  { start: "15:15", end: "16:00" }
];

let currentTeacher = null;
let teacherData = {};
let students = [];
let departments = [];
let timetable = [];
let currentSubject = "";
let toastTimer;
let loading = false;

const $ = id => document.getElementById(id);

const teacherDoc = uid => doc(db, "teachers", uid);

const studentCollection = uid =>
  collection(db, "teachers", uid, "students");

/* ==========================================
   3. HELPERS
========================================== */

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[c]);
}

function initials(name = "Teacher") {
  return name.trim().split(/\s+/).slice(0, 2)
    .map(x => x[0]?.toUpperCase() || "").join("") || "T";
}

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  });
}

function showToast(message, type = "success") {
  const toast = $("toast");
  if (!toast) return;

  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast show ${type}`;

  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

function message(id, text, type = "error") {
  const el = $(id);
  if (!el) return;

  el.textContent = text;
  el.className = `form-message ${type}`;
}

function clearMessage(id) {
  if ($(id)) $(id).textContent = "";
}

function selectedSubjects(containerId) {
  const container = $(containerId);
  if (!container) return [];

  return [...container.querySelectorAll(
    'input[type="checkbox"]:checked'
  )].map(input => input.value)
    .filter(value => SUBJECTS.includes(value));
}

function subjectPickerHTML(selected = []) {
  return SUBJECTS.map(subject => `
    <label class="subject-choice">
      <input type="checkbox" value="${subject}"
        ${selected.includes(subject) ? "checked" : ""}>
      <span>${subject}</span>
    </label>
  `).join("");
}

function setSubjectPicker(id, selected = []) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = subjectPickerHTML(selected);
}

function studentName(id) {
  return students.find(s => s.id === id)?.name || "Unknown";
}

function studentRoll(id) {
  return students.find(s => s.id === id)?.roll || "";
}

function getPercentage(held, attended) {
  if (!Number(held)) return 0;
  return Math.min(100, Number(attended) / Number(held) * 100);
}

function average(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function showError(error) {
  console.error(error);

  const errors = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email": "Please enter a valid email.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "Account not found.",
    "auth/weak-password": "Password must contain at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/network-request-failed": "Check your internet connection.",
    "permission-denied": "Firebase permission denied. Check Firestore rules."
  };

  showToast(errors[error.code] || error.message || "Something went wrong.", "error");
}

function dateToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ==========================================
   4. AUTHENTICATION
========================================== */

$("showRegister").addEventListener("click", () => {
  $("loginView").classList.add("hidden");
  $("registerView").classList.remove("hidden");
});

$("showLogin").addEventListener("click", () => {
  $("registerView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
});

document.querySelectorAll("[data-toggle]").forEach(button => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.toggle);
    if (!input) return;

    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "Show" : "Hide";
  });
});

$("rememberEmail").addEventListener("change", () => {
  if ($("rememberEmail").checked) {
    localStorage.setItem("studenthub_email", $("loginEmail").value);
  } else {
    localStorage.removeItem("studenthub_email");
  }
});

$("loginEmail").addEventListener("input", () => {
  if ($("rememberEmail").checked) {
    localStorage.setItem("studenthub_email", $("loginEmail").value);
  }
});

$("loginEmail").value = localStorage.getItem("studenthub_email") || "";
$("rememberEmail").checked = !!localStorage.getItem("studenthub_email");

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (loading) return;

  loading = true;
  const button = $("loginForm").querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Signing in...";

  try {
    await signInWithEmailAndPassword(
      auth,
      $("loginEmail").value.trim(),
      $("loginPassword").value
    );
  } catch (error) {
    message("loginError", error.code === "auth/invalid-credential"
      ? "Incorrect email or password."
      : error.message);
  } finally {
    loading = false;
    button.disabled = false;
    button.innerHTML = 'Sign In <span>→</span>';
  }
});

$("registerForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (loading) return;

  const name = $("registerName").value.trim();
  const email = $("registerEmail").value.trim();
  const password = $("registerPassword").value;
  const subjects = selectedSubjects("registerSubjects");

  if (!subjects.length) {
    message("registerError", "Select at least one subject.");
    return;
  }

  loading = true;
  const button = $("registerForm").querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Creating account...";

  try {
    const result = await createUserWithEmailAndPassword(
      auth, email, password
    );

    await updateProfile(result.user, { displayName: name });

    await setDoc(teacherDoc(result.user.uid), {
      uid: result.user.uid,
      name,
      email,
      subjects,
      departments: [],
      timetable: [],
      createdAt: serverTimestamp()
    }, { merge: true });

    showToast("Teacher account created successfully!");
  } catch (error) {
    message("registerError", error.message);
  } finally {
    loading = false;
    button.disabled = false;
    button.textContent = "Create Account →";
  }
});

async function resetPassword() {
  const email = $("loginEmail").value.trim() ||
    currentTeacher?.email;

  if (!email) {
    showToast("Enter your email address first.", "error");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Password reset email sent!");
  } catch (error) {
    showError(error);
  }
}

$("forgotPassword").addEventListener("click", resetPassword);
$("resetPasswordSettings").addEventListener("click", resetPassword);

async function logout() {
  try {
    await signOut(auth);
    showToast("Signed out successfully.");
  } catch (error) {
    showError(error);
  }
}

$("logoutButton").addEventListener("click", logout);

/* ==========================================
   5. AUTHENTICATION STATE
========================================== */

onAuthStateChanged(auth, async user => {
  currentTeacher = user;

  if (!user) {
    $("authPage").classList.remove("hidden");
    $("app").classList.add("hidden");
    currentTeacher = null;
    students = [];
    teacherData = {};
    return;
  }

  try {
    await loadWorkspace();
    $("authPage").classList.add("hidden");
    $("app").classList.remove("hidden");
    updateProfileUI();
    initializeWorkspace();
    navigate("dashboard");
  } catch (error) {
    showError(error);
    $("authPage").classList.remove("hidden");
    $("app").classList.add("hidden");
  }
});

/* ==========================================
   6. LOAD FIRESTORE DATA
========================================== */

async function loadWorkspace() {
  const profileSnapshot = await getDoc(teacherDoc(currentTeacher.uid));

  if (!profileSnapshot.exists()) {
    teacherData = {
      uid: currentTeacher.uid,
      name: currentTeacher.displayName || "Teacher",
      email: currentTeacher.email,
      subjects: [],
      departments: [],
      timetable: []
    };

    await setDoc(teacherDoc(currentTeacher.uid), {
      ...teacherData,
      createdAt: serverTimestamp()
    });
  } else {
    teacherData = profileSnapshot.data();
  }

  departments = Array.isArray(teacherData.departments)
    ? teacherData.departments : [];

  timetable = Array.isArray(teacherData.timetable)
    ? teacherData.timetable : [];

  const snapshot = await getDocs(studentCollection(currentTeacher.uid));

  students = snapshot.docs.map(item => {
    const data = item.data();

    return {
      id: item.id,
      ...data,
      subjects: Array.isArray(data.subjects) ? data.subjects : [],
      attendance: Array.isArray(data.attendance) ? data.attendance : [],
      results: Array.isArray(data.results) ? data.results : [],
      fees: Array.isArray(data.fees) ? data.fees : []
    };
  });
}

/* ==========================================
   7. PROFILE UI
========================================== */

function updateProfileUI() {
  const name = teacherData.name || currentTeacher.displayName || "Teacher";
  const email = currentTeacher.email || "";

  $("sidebarName").textContent = name;
  $("sidebarEmail").textContent = email;
  $("welcomeName").textContent = name.split(" ")[0];

  $("sidebarInitials").textContent = initials(name);
  $("topInitials").textContent = initials(name);
  $("settingsInitials").textContent = initials(name);

  $("settingsName").textContent = name;
  $("settingsEmail").textContent = email;
  $("settingsEmailDisplay").value = email;
  $("settingsNameInput").value = name;

  $("todayLabel").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  setSubjectPicker("settingsSubjects", teacherData.subjects || []);
  setSubjectPicker("studentSubjects", teacherData.subjects || []);
  setSubjectPicker("registerSubjects", []);
}

/* ==========================================
   8. INITIALIZE WORKSPACE
========================================== */

function initializeWorkspace() {
  renderAll();
  populateStudentDropdowns();
  renderDepartments();
  populateTimetableSelectors();
  initializeTimetableTimes();

  $("feeDate").value = dateToday();

  document.body.classList.toggle(
    "dark",
    localStorage.getItem("studenthub_theme") === "dark"
  );

  updateThemeButton();
}

function renderAll() {
  renderDashboard();
  renderStudents();
  renderAttendance();
  renderAcademics();
  renderSubjectNavigation();
  renderFeeRecords();
  renderTimetable();
  renderSubjectPage();
}

/* ==========================================
   9. NAVIGATION
========================================== */

function navigate(page) {
  currentPage = page;

  document.querySelectorAll(".page").forEach(section => {
    section.classList.add("hidden");
  });

  const target = $(page + "Page");
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".nav-link[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  const names = {
    dashboard: "Overview",
    students: "Students",
    attendance: "Attendance",
    academics: "Academic Results",
    departments: "Departments",
    fees: "Fee Management",
    timetable: "Timetable",
    subject: currentSubject || "Subject",
    settings: "Settings"
  };

  $("pageTitle").textContent = names[page] || page;

  if (page === "students" || page === "attendance" ||
      page === "academics" || page === "fees") {
    populateStudentDropdowns();
  }

  if (page === "departments") renderDepartments();
  if (page === "timetable") {
    populateTimetableSelectors();
    renderTimetable();
  }

  if (page === "subject") renderSubjectPage();

  $("sidebar").classList.remove("open");
  $("sidebarOverlay").classList.remove("show");
}

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => navigate(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => navigate(button.dataset.go));
});

$("openSidebar").addEventListener("click", () => {
  $("sidebar").classList.add("open");
  $("sidebarOverlay").classList.add("show");
});

$("closeSidebar").addEventListener("click", () => {
  $("sidebar").classList.remove("open");
  $("sidebarOverlay").classList.remove("show");
});

$("sidebarOverlay").addEventListener("click", () => {
  $("sidebar").classList.remove("open");
  $("sidebarOverlay").classList.remove("show");
});

/* ==========================================
   10. DARK MODE
========================================== */

function updateThemeButton() {
  const dark = document.body.classList.contains("dark");
  $("themeText").textContent = dark ? "Light mode" : "Dark mode";
  $("themeToggle").firstChild.textContent = dark ? "☀ " : "☾ ";
}

$("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");

  localStorage.setItem(
    "studenthub_theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );

  updateThemeButton();
});

/* ==========================================
   11. STUDENT DROPDOWNS
========================================== */

function populateStudentDropdowns() {
  const ids = [
    "attendanceStudent",
    "resultStudent",
    "feeStudent"
  ];

  ids.forEach(id => {
    const select = $(id);
    if (!select) return;

    const previous = select.value;

    select.innerHTML = '<option value="">Select student</option>';

    students.forEach(student => {
      const option = document.createElement("option");
      option.value = student.id;
      option.textContent = `${student.name} (${student.roll})`;
      select.appendChild(option);
    });

    if (students.some(s => s.id === previous)) {
      select.value = previous;
    }
  });

  const subjectSelect = $("attendanceSubject");
  subjectSelect.innerHTML = '<option value="">Select subject</option>';

  (teacherData.subjects || []).forEach(subject => {
    subjectSelect.add(new Option(subject, subject));
  });

  const ttSubject = $("ttSubject");
  if (ttSubject) {
    ttSubject.innerHTML = '<option value="">Select subject</option>';
    (teacherData.subjects || []).forEach(subject => {
      ttSubject.add(new Option(subject, subject));
    });
  }
}

/* ==========================================
   12. DASHBOARD
========================================== */

function renderDashboard() {
  $("totalStudents").textContent = students.length;
  $("subjectCount").textContent = (teacherData.subjects || []).length;

  const attendanceValues = students.flatMap(student =>
    student.attendance.map(record =>
      getPercentage(record.held, record.attended)
    )
  );

  const avgAttendance = average(attendanceValues);

  $("averageAttendance").textContent =
    avgAttendance === null ? "—" : avgAttendance.toFixed(1) + "%";

  const allResults = students.flatMap(student =>
    student.results.map(result => Number(result.sgpa))
  );

  const avgSGPA = average(allResults);

  $("averageSGPA").textContent =
    avgSGPA === null ? "—" : avgSGPA.toFixed(2);

  const container = $("dashboardSubjects");
  container.innerHTML = "";

  (teacherData.subjects || []).forEach(subject => {
    const count = students.filter(s => s.subjects.includes(subject)).length;

    const button = document.createElement("button");
    button.className = "subject-card";
    button.innerHTML = `
      <strong>${escapeHTML(subject)}</strong>
      <small>${count} enrolled students · Open workspace →</small>
    `;

    button.addEventListener("click", () => openSubject(subject));
    container.appendChild(button);
  });

  $("recentStudents").innerHTML = students
    .slice()
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 5)
    .map(student => `
      <tr>
        <td>${escapeHTML(student.name)}</td>
        <td>${escapeHTML(student.roll)}</td>
        <td>${escapeHTML(student.year || "—")}</td>
        <td>${escapeHTML(student.department || "—")}</td>
        <td>${escapeHTML(student.section || "—")}</td>
      </tr>
    `).join("") || '<tr><td colspan="5">No student records yet.</td></tr>';
}

/* ==========================================
   13. ADD / EDIT STUDENTS
========================================== */

$("studentForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentTeacher) return;

  const name = $("studentName").value.trim();
  const roll = $("studentRoll").value.trim();
  const email = $("studentEmail").value.trim();
  const phone = $("studentPhone").value.trim();
  const department = $("studentDepartment").value;
  const year = $("studentYear").value;
  const section = $("studentSection").value.trim().toUpperCase();
  const subjects = selectedSubjects("studentSubjects");
  const editId = $("editStudentId").value;

  if (!name || !roll || !year) {
    message("studentMessage", "Please complete the required fields.");
    return;
  }

  const duplicate = students.find(s =>
    s.roll.toLowerCase() === roll.toLowerCase() && s.id !== editId
  );

  if (duplicate) {
    message("studentMessage", "This register number already exists.");
    return;
  }

  try {
    const existing = students.find(s => s.id === editId);

    const studentData = {
      roll,
      name,
      email,
      phone,
      department,
      year,
      section,
      subjects,
      attendance: existing?.attendance || [],
      results: existing?.results || [],
      fees: existing?.fees || [],
      updatedAt: serverTimestamp()
    };

    if (editId) {
      const oldRef = doc(db, "teachers", currentTeacher.uid, "students", editId);

      if (editId !== roll) {
        const newRef = doc(db, "teachers", currentTeacher.uid, "students", roll);

        await setDoc(newRef, {
          ...studentData,
          createdAt: existing?.createdAt || serverTimestamp()
        });

        await deleteDoc(oldRef);
      } else {
        await setDoc(oldRef, studentData, { merge: true });
      }

      showToast("Student updated successfully!");
    } else {
      const newRef = doc(db, "teachers", currentTeacher.uid, "students", roll);

      await setDoc(newRef, {
        ...studentData,
        createdAt: serverTimestamp()
      });

      showToast("Student added successfully!");
    }

    $("studentForm").reset();
    $("editStudentId").value = "";
    $("studentFormTitle").textContent = "Add New Student";
    $("cancelStudentEdit").classList.add("hidden");

    await refreshData();
  } catch (error) {
    showError(error);
  }
});

function editStudent(id) {
  const student = students.find(s => s.id === id);
  if (!student) return;

  $("editStudentId").value = id;
  $("studentName").value = student.name || "";
  $("studentRoll").value = student.roll || "";
  $("studentEmail").value = student.email || "";
  $("studentPhone").value = student.phone || "";
  $("studentDepartment").value = student.department || "";
  $("studentYear").value = student.year || "";
  $("studentSection").value = student.section || "";

  setSubjectPicker("studentSubjects", student.subjects || []);

  $("studentFormTitle").textContent = "Edit Student";
  $("cancelStudentEdit").classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("cancelStudentEdit").addEventListener("click", () => {
  $("studentForm").reset();
  $("editStudentId").value = "";
  $("studentFormTitle").textContent = "Add New Student";
  $("cancelStudentEdit").classList.add("hidden");
});

async function deleteStudent(id) {
  const student = students.find(s => s.id === id);
  if (!student) return;

  if (!confirm(`Delete ${student.name}'s complete student record?`)) return;

  try {
    await deleteDoc(
      doc(db, "teachers", currentTeacher.uid, "students", id)
    );

    showToast("Student deleted.");
    await refreshData();
  } catch (error) {
    showError(error);
  }
}

function renderStudents() {
  const query = $("studentSearch").value.toLowerCase().trim();

  const filtered = students.filter(s =>
    [s.name, s.roll, s.email, s.department, s.year, s.section]
      .join(" ").toLowerCase().includes(query)
  );

  $("studentCountLabel").textContent =
    `${filtered.length} of ${students.length} records`;

  $("studentEmpty").classList.toggle("hidden", filtered.length > 0);

  $("studentTableBody").innerHTML = filtered.map(student => `
    <tr>
      <td><strong>${escapeHTML(student.name)}</strong></td>
      <td>${escapeHTML(student.roll)}</td>
      <td>${escapeHTML(student.email || "—")}</td>
      <td>${escapeHTML(student.department || "—")}</td>
      <td>${escapeHTML(student.year || "—")}</td>
      <td>${escapeHTML(student.section || "—")}</td>
      <td>
        <button class="table-action" data-edit="${escapeHTML(student.id)}">Edit</button>
        <button class="table-action delete" data-delete="${escapeHTML(student.id)}">Delete</button>
      </td>
    </tr>
  `).join("");
}

$("studentSearch").addEventListener("input", renderStudents);

$("studentTableBody").addEventListener("click", e => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");

  if (edit) editStudent(edit.dataset.edit);
  if (del) deleteStudent(del.dataset.delete);
});

/* ==========================================
   14. ATTENDANCE
========================================== */

$("attendanceForm").addEventListener("submit", async e => {
  e.preventDefault();

  const id = $("attendanceStudent").value;
  const subject = $("attendanceSubject").value;
  const held = Number($("classesHeld").value);
  const attended = Number($("classesAttended").value);

  const student = students.find(s => s.id === id);

  if (!student) {
    message("attendanceMessage", "Select a student.");
    return;
  }

  if (!subject || held < 0 || attended < 0 || attended > held) {
    message("attendanceMessage", "Enter valid attendance details.");
    return;
  }

  try {
    const records = [...student.attendance];
    const index = records.findIndex(r => r.subject === subject);

    const record = {
      subject,
      held,
      attended,
      percentage: getPercentage(held, attended),
      updatedAt: new Date().toISOString()
    };

    if (index >= 0) records[index] = record;
    else records.push(record);

    await saveStudentArray(id, "attendance", records);

    $("attendanceForm").reset();
    message("attendanceMessage", "Attendance saved successfully.", "success");

    await refreshData();
  } catch (error) {
    showError(error);
  }
});

function renderAttendance() {
  const rows = students.flatMap(student =>
    student.attendance.map((record, index) => ({
      student,
      record,
      index
    }))
  );

  $("attendanceTableBody").innerHTML = rows.map(({ student, record, index }) => `
    <tr>
      <td>${escapeHTML(student.name)}</td>
      <td>${escapeHTML(student.roll)}</td>
      <td>${escapeHTML(record.subject)}</td>
      <td>${Number(record.held)}</td>
      <td>${Number(record.attended)}</td>
      <td>${getPercentage(record.held, record.attended).toFixed(1)}%</td>
      <td><button class="table-action delete" data-delete-att="${escapeHTML(student.id)}" data-index="${index}">Delete</button></td>
    </tr>
  `).join("") || '<tr><td colspan="7">No attendance records.</td></tr>';
}

$("attendanceTableBody").addEventListener("click", async e => {
  const button = e.target.closest("[data-delete-att]");
  if (!button) return;

  const student = students.find(s => s.id === button.dataset.deleteAtt);
  if (!student || !confirm("Delete this attendance record?")) return;

  const records = [...student.attendance];
  records.splice(Number(button.dataset.index), 1);

  try {
    await saveStudentArray(student.id, "attendance", records);
    await refreshData();
    showToast("Attendance record deleted.");
  } catch (error) {
    showError(error);
  }
});

/* ==========================================
   15. ACADEMIC RESULTS
========================================== */

$("resultForm").addEventListener("submit", async e => {
  e.preventDefault();

  const id = $("resultStudent").value;
  const semester = $("resultSemester").value;
  const sgpa = Number($("resultSGPA").value);

  const student = students.find(s => s.id === id);

  if (!student || !semester || sgpa < 0 || sgpa > 10) {
    message("resultMessage", "Enter valid result details.");
    return;
  }

  try {
    const records = [...student.results];
    const index = records.findIndex(r => r.semester === semester);

    const result = {
      semester,
      sgpa,
      updatedAt: new Date().toISOString()
    };

    if (index >= 0) records[index] = result;
    else records.push(result);

    await saveStudentArray(id, "results", records);

    $("resultForm").reset();
    message("resultMessage", "Academic result saved successfully.", "success");

    await refreshData();
  } catch (error) {
    showError(error);
  }
});

function renderAcademics() {
  const records = students.flatMap(student =>
    student.results.map((result, index) => ({
      student,
      result,
      index
    }))
  );

  const filter = $("academicFilter").value;

  const filtered = filter === "all"
    ? records
    : records.filter(r => r.result.semester === filter);

  const avg = average(records.map(r => r.result.sgpa));

  $("resultCount").textContent = records.length;
  $("academicAverage").textContent = avg === null ? "—" : avg.toFixed(2);
  $("resultStudents").textContent =
    new Set(records.map(r => r.student.id)).size;

  $("academicTableBody").innerHTML = filtered.map(({ student, result }) => `
    <tr>
      <td>${escapeHTML(student.name)}</td>
      <td>${escapeHTML(student.roll)}</td>
      <td>${escapeHTML(result.semester)}</td>
      <td><strong>${Number(result.sgpa).toFixed(2)}</strong></td>
      <td><button class="table-action delete" data-delete-result="${escapeHTML(student.id)}" data-semester="${escapeHTML(result.semester)}">Delete</button></td>
    </tr>
  `).join("") || '<tr><td colspan="5">No academic records.</td></tr>';
}

$("academicFilter").addEventListener("change", renderAcademics);

$("academicTableBody").addEventListener("click", async e => {
  const button = e.target.closest("[data-delete-result]");
  if (!button) return;

  const student = students.find(s => s.id === button.dataset.deleteResult);
  if (!student || !confirm("Delete this result?")) return;

  try {
    const records = student.results.filter(
      r => r.semester !== button.dataset.semester
    );

    await saveStudentArray(student.id, "results", records);
    await refreshData();
    showToast("Result deleted.");
  } catch (error) {
    showError(error);
  }
});

/* ==========================================
   16. DEPARTMENTS AND SECTIONS
========================================== */

$("departmentForm").addEventListener("submit", async e => {
  e.preventDefault();

  const name = $("departmentName").value.trim();
  const code = $("departmentCode").value.trim().toUpperCase();
  const sections = $("departmentSections").value
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  if (!name || !code) return;

  if (departments.some(d => d.code.toLowerCase() === code.toLowerCase())) {
    message("departmentMessage", "Department code already exists.");
    return;
  }

  try {
    departments.push({
      id: crypto.randomUUID(),
      name,
      code,
      sections
    });

    await saveTeacherField("departments", departments);

    $("departmentForm").reset();
    message("departmentMessage", "Department saved.", "success");

    renderDepartments();
    populateTimetableSelectors();
  } catch (error) {
    showError(error);
  }
});

async function deleteDepartment(id) {
  const department = departments.find(d => d.id === id);
  if (!department || !confirm(`Delete ${department.name}?`)) return;

  try {
    departments = departments.filter(d => d.id !== id);
    await saveTeacherField("departments", departments);
    renderDepartments();
    populateTimetableSelectors();
    showToast("Department deleted.");
  } catch (error) {
    showError(error);
  }
}

function renderDepartments() {
  $("departmentList").innerHTML = departments.map(d => `
    <article class="record-card">
      <h3>${escapeHTML(d.name)}</h3>
      <p>Code: ${escapeHTML(d.code)}</p>
      <p>Sections: ${escapeHTML((d.sections || []).join(", ") || "None")}</p>
      <button class="table-action delete" data-delete-dept="${escapeHTML(d.id)}">Delete</button>
    </article>
  `).join("") || "<p>No departments created yet.</p>";
}

$("departmentList").addEventListener("click", e => {
  const button = e.target.closest("[data-delete-dept]");
  if (button) deleteDepartment(button.dataset.deleteDept);
});

/* ==========================================
   17. FEE MANAGEMENT
========================================== */

$("feeForm").addEventListener("submit", async e => {
  e.preventDefault();

  const id = $("feeStudent").value;
  const total = Number($("feeTotal").value);
  const paid = Number($("feePaid").value);

  const student = students.find(s => s.id === id);

  if (!student || total < 0 || paid <= 0) {
    message("feeMessage", "Enter valid payment details.");
    return;
  }

  const previousTotal = student.fees.length
    ? Number(student.fees[0].total) : total;

  const alreadyPaid = student.fees.reduce(
    (sum, item) => sum + Number(item.amount), 0
  );

  if (total !== previousTotal) {
    message("feeMessage", "The total fee must match the existing fee record. Edit it consistently before adding another payment.");
    return;
  }

  if (alreadyPaid + paid > total) {
    message("feeMessage", "Payment exceeds the remaining fee balance.");
    return;
  }

  try {
    const fees = [...student.fees, {
      id: crypto.randomUUID(),
      total,
      amount: paid,
      date: $("feeDate").value,
      method: $("feeMethod").value,
      reference: $("feeReference").value.trim(),
      createdAt: new Date().toISOString()
    }];

    await saveStudentArray(id, "fees", fees);

    $("feeForm").reset();
    $("feeDate").value = dateToday();

    message("feeMessage", "Payment recorded successfully.", "success");

    await refreshData();
  } catch (error) {
    showError(error);
  }
});

function renderFeeRecords() {
  let total = 0;
  let collected = 0;

  $("feeTableBody").innerHTML = students.map(student => {
    const studentTotal = student.fees.length
      ? Number(student.fees[0].total) : 0;

    const paid = student.fees.reduce(
      (sum, item) => sum + Number(item.amount), 0
    );

    total += studentTotal;
    collected += paid;

    return `
      <tr>
        <td>${escapeHTML(student.name)}</td>
        <td>${escapeHTML(student.roll)}</td>
        <td>${money(studentTotal)}</td>
        <td>${money(paid)}</td>
        <td>${money(Math.max(0, studentTotal - paid))}</td>
        <td><button class="table-action" data-fee-history="${escapeHTML(student.id)}">History</button></td>
      </tr>
    `;
  }).join("") || '<tr><td colspan="6">No fee records.</td></tr>';

  $("totalFees").textContent = money(total);
  $("collectedFees").textContent = money(collected);
  $("pendingFees").textContent = money(total - collected);

  const payments = students.flatMap(student =>
    student.fees.map(fee => ({ student, fee }))
  ).sort((a, b) => String(b.fee.date).localeCompare(String(a.fee.date)));

  $("paymentHistory").innerHTML = payments.map(({ student, fee }) => `
    <tr>
      <td>${escapeHTML(student.name)}</td>
      <td>${escapeHTML(fee.date)}</td>
      <td>${money(fee.amount)}</td>
      <td>${escapeHTML(fee.method)}</td>
      <td>${escapeHTML(fee.reference || "—")}</td>
    </tr>
  `).join("") || '<tr><td colspan="5">No payments recorded.</td></tr>';
}

$("feeTableBody").addEventListener("click", e => {
  const button = e.target.closest("[data-fee-history]");
  if (!button) return;

  const student = students.find(s => s.id === button.dataset.feeHistory);
  if (!student) return;

  const details = student.fees.map(f =>
    `${f.date}: ${money(f.amount)} (${f.method})`
  ).join("\n") || "No payments.";

  alert(`${student.name}\n\n${details}`);
});

/* ==========================================
   18. TIMETABLE
========================================== */

function initializeTimetableTimes() {
  const start = $("ttStart");
  const end = $("ttEnd");

  start.innerHTML = "";
  end.innerHTML = "";

  PERIODS.forEach(period => {
    start.add(new Option(period.start, period.start));
    end.add(new Option(period.end, period.end));
  });
}

function populateTimetableSelectors() {
  const departmentSelect = $("timetableDepartment");
  const sectionSelect = $("timetableSection");

  if (!departmentSelect || !sectionSelect) return;

  const previousDept = departmentSelect.value;

  departmentSelect.innerHTML = departments.map(d =>
    `<option value="${escapeHTML(d.code)}">${escapeHTML(d.name)} (${escapeHTML(d.code)})</option>`
  ).join("");

  if (!departments.length) {
    departmentSelect.innerHTML = '<option value="">Create a department first</option>';
    sectionSelect.innerHTML = '<option value="">No sections</option>';
    return;
  }

  if (departments.some(d => d.code === previousDept)) {
    departmentSelect.value = previousDept;
  }

  updateSections();
}

function updateSections() {
  const department = departments.find(
    d => d.code === $("timetableDepartment").value
  );

  $("timetableSection").innerHTML = (department?.sections || ["A"]).map(s =>
    `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`
  ).join("");
}

$("timetableDepartment").addEventListener("change", updateSections);

function timetableContext() {
  return {
    department: $("timetableDepartment").value,
    section: $("timetableSection").value
  };
}

$("timetableForm").addEventListener("submit", async e => {
  e.preventDefault();

  const context = timetableContext();

  if (!context.department || !context.section) {
    message("timetableMessage", "Create a department and section first.");
    return;
  }

  const day = $("ttDay").value;
  const start = $("ttStart").value;
  const end = $("ttEnd").value;
  const subject = $("ttSubject").value;

  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));

  if (endMinutes <= startMinutes) {
    message("timetableMessage", "End time must be after start time.");
    return;
  }

  const overlap = timetable.some(item => {
    if (
      item.department !== context.department ||
      item.section !== context.section ||
      item.day !== day
    ) return false;

    const a = Number(item.start.slice(0, 2)) * 60 + Number(item.start.slice(3));
    const b = Number(item.end.slice(0, 2)) * 60 + Number(item.end.slice(3));

    return startMinutes < b && endMinutes > a;
  });

  if (overlap) {
    message("timetableMessage", "This time overlaps another period.");
    return;
  }

  try {
    timetable.push({
      id: crypto.randomUUID(),
      ...context,
      day,
      start,
      end,
      subject,
      teacher: $("ttTeacher").value.trim(),
      room: $("ttRoom").value.trim()
    });

    await saveTeacherField("timetable", timetable);

    $("timetableForm").reset();
    message("timetableMessage", "Period added successfully.", "success");

    renderTimetable();
  } catch (error) {
    showError(error);
  }
});

async function deletePeriod(id) {
  if (!confirm("Delete this timetable period?")) return;

  try {
    timetable = timetable.filter(p => p.id !== id);
    await saveTeacherField("timetable", timetable);
    renderTimetable();
    showToast("Period deleted.");
  } catch (error) {
    showError(error);
  }
}

function renderTimetable() {
  const container = $("timetableGrid");
  if (!container) return;

  const { department, section } = timetableContext();

  const filtered = timetable.filter(item =>
    item.department === department && item.section === section
  );

  container.innerHTML = DAYS.map(day => {
    const records = filtered.filter(item => item.day === day)
      .sort((a, b) => a.start.localeCompare(b.start));

    return `
      <div class="day-schedule">
        <div class="day-title">${day}</div>
        <div class="period-list">
          ${records.map(item => `
            <div class="period-card">
              <strong>${escapeHTML(item.subject)}</strong>
              <small>${escapeHTML(item.start)} – ${escapeHTML(item.end)}</small>
              <small>${escapeHTML(item.teacher || "Faculty not specified")}</small>
              <small>Room: ${escapeHTML(item.room || "Not specified")}</small>
              <button class="table-action delete" data-delete-period="${escapeHTML(item.id)}">Remove</button>
            </div>
          `).join("") || '<p>No periods scheduled.</p>'}
        </div>
      </div>
    `;
  }).join("");
}

$("timetableGrid").addEventListener("click", e => {
  const button = e.target.closest("[data-delete-period]");
  if (button) deletePeriod(button.dataset.deletePeriod);
});

$("timetableDepartment").addEventListener("change", renderTimetable);
$("timetableSection").addEventListener("change", renderTimetable);

$("printTimetable").addEventListener("click", () => window.print());

/* ==========================================
   19. SUBJECT WORKSPACES
========================================== */

function renderSubjectNavigation() {
  $("subjectNavigation").innerHTML = (teacherData.subjects || []).map(subject => `
    <button class="nav-link" data-subject="${escapeHTML(subject)}">
      ◈ <span>${escapeHTML(subject)}</span>
    </button>
  `).join("");
}

$("subjectNavigation").addEventListener("click", e => {
  const button = e.target.closest("[data-subject]");
  if (button) openSubject(button.dataset.subject);
});

function openSubject(subject) {
  currentSubject = subject;
  navigate("subject");

  document.querySelectorAll("[data-subject]").forEach(button => {
    button.classList.toggle("active", button.dataset.subject === subject);
  });

  $("pageTitle").textContent = subject;
  $("subjectPageTitle").textContent = subject;
}

function renderSubjectPage() {
  const subject = currentSubject;
  if (!subject) return;

  const assigned = students.filter(s => s.subjects.includes(subject));

  const attendance = assigned.flatMap(s =>
    s.attendance.filter(a => a.subject === subject)
      .map(a => getPercentage(a.held, a.attended))
  );

  const results = assigned.flatMap(s => s.results.map(r => Number(r.sgpa)));

  const avgAttendance = average(attendance);
  const avgSGPA = average(results);

  $("subjectPageTitle").textContent = subject;
  $("subjectPageDescription").textContent =
    `Student records and performance for ${subject}.`;

  $("subjectStudents").textContent = assigned.length;
  $("subjectAttendance").textContent =
    avgAttendance === null ? "—" : avgAttendance.toFixed(1) + "%";

  $("subjectMarks").textContent =
    avgSGPA === null ? "—" : avgSGPA.toFixed(2);

  $("subjectTableBody").innerHTML = assigned.map(student => {
    const record = student.attendance.find(a => a.subject === subject);

    const sgpa = average(student.results.map(r => Number(r.sgpa)));

    return `
      <tr>
        <td>${escapeHTML(student.name)}</td>
        <td>${escapeHTML(student.roll)}</td>
        <td>${escapeHTML(student.year || "—")}</td>
        <td>${record ? getPercentage(record.held, record.attended).toFixed(1) + "%" : "—"}</td>
        <td>${sgpa === null ? "—" : sgpa.toFixed(2)}</td>
      </tr>
    `;
  }).join("") || '<tr><td colspan="5">No students assigned.</td></tr>';
}

/* ==========================================
   20. SETTINGS
========================================== */

$("settingsForm").addEventListener("submit", async e => {
  e.preventDefault();

  const name = $("settingsNameInput").value.trim();
  const subjects = selectedSubjects("settingsSubjects");

  if (!name || !subjects.length) {
    message("settingsMessage", "Enter a name and select at least one subject.");
    return;
  }

  try {
    await updateProfile(currentTeacher, { displayName: name });

    await setDoc(teacherDoc(currentTeacher.uid), {
      name,
      subjects,
      email: currentTeacher.email,
      updatedAt: serverTimestamp()
    }, { merge: true });

    teacherData.name = name;
    teacherData.subjects = subjects;

    updateProfileUI();
    renderAll();
    populateStudentDropdowns();

    message("settingsMessage", "Profile updated successfully.", "success");
    showToast("Settings saved.");
  } catch (error) {
    showError(error);
  }
});

/* ==========================================
   21. FIRESTORE SAVE HELPERS
========================================== */

async function saveStudentArray(id, field, values) {
  const ref = doc(
    db, "teachers", currentTeacher.uid, "students", id
  );

  await setDoc(ref, {
    [field]: values,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function saveTeacherField(field, value) {
  await setDoc(teacherDoc(currentTeacher.uid), {
    [field]: value,
    updatedAt: serverTimestamp()
  }, { merge: true });

  teacherData[field] = value;
}

/* ==========================================
   22. REFRESH DATA
========================================== */

async function refreshData() {
  await loadWorkspace();
  updateProfileUI();
  renderAll();
  populateStudentDropdowns();
  renderDepartments();
  populateTimetableSelectors();
  renderTimetable();
}

/* ==========================================
   23. FINAL INITIALIZATION
========================================== */

console.log("StudentHub initialized.");
