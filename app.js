
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

/* ============================================
   1. FIREBASE CONFIGURATION
============================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDbp7MMX5jgYgM5H2KpUGYryWMuecwaroY",
  authDomain: "studyhub-139ef.firebaseapp.com",
  projectId: "studyhub-139ef",
  storageBucket: "studyhub-139ef.firebasestorage.app",
  messagingSenderId: "747349756102",
  appId: "1:747349756102:web:cf68eeeb7b91e54ab82fc7"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

await setPersistence(auth, browserSessionPersistence);

/* ============================================
   2. APPLICATION STATE
============================================ */

let currentUser = null;
let teacherData = {};
let students = [];
let attendanceRecords = [];
let resultRecords = [];
let editingStudentId = null;
let currentPage = "dashboard";

const SUBJECTS = {
  DS: "Data Structures",
  DBMS: "Database Management Systems",
  MFCS: "Mathematical Foundations of Computer Science",
  FOIS: "Fundamentals of Information Security",
  CN: "Computer Networks",
  OOPS: "Object Oriented Programming"
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const teacherRef = () =>
  doc(db, "teachers", currentUser.uid);

const studentsRef = () =>
  collection(db, "teachers", currentUser.uid, "students");

const studentRef = id =>
  doc(db, "teachers", currentUser.uid, "students", id);

const attendanceRef = id =>
  collection(
    db,
    "teachers",
    currentUser.uid,
    "students",
    id,
    "attendance"
  );

const resultsRef = id =>
  collection(
    db,
    "teachers",
    currentUser.uid,
    "students",
    id,
    "results"
  );

/* ============================================
   3. UTILITIES
============================================ */

function notify(message, type = "success") {
  const element = $("#toast");

  if (!element) return;

  element.textContent = message;
  element.className = `toast show ${type}`;

  clearTimeout(notify.timer);

  notify.timer = setTimeout(() => {
    element.className = "toast";
  }, 3200);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function getValue(form, name) {
  const field = form.elements.namedItem(name);
  return field ? String(field.value).trim() : "";
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatDate(value) {
  if (!value) return "—";

  const date = value.toDate
    ? value.toDate()
    : new Date(value);

  return isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN");
}

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset();

  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
}

function average(values) {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0;
}

function setLoading(button, loading, normalText) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? "Please wait..." : normalText;
}

function showElement(selector, visible) {
  const element = $(selector);
  if (element) element.classList.toggle("hidden", !visible);
}

function selectedSubjects(form) {
  return [...form.querySelectorAll(
    'input[name="subjects"]:checked'
  )].map(input => input.value);
}

/* ============================================
   4. THEME MANAGEMENT
============================================ */

function applyTheme(theme) {
  const dark = theme === "dark";

  document.body.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = theme;

  const text = dark ? "Light mode" : "Dark mode";
  const icon = dark ? "☀" : "☾";

  setText("themeText", text);
  setText("themeIcon", icon);
  setText("authThemeText", text);
  setText("authThemeIcon", icon);
}

function toggleTheme() {
  const current = document.body.classList.contains("dark")
    ? "dark"
    : "light";

  const next = current === "dark" ? "light" : "dark";

  localStorage.setItem("studenthub-theme", next);
  applyTheme(next);
}

function initializeTheme() {
  applyTheme(
    localStorage.getItem("studenthub-theme") || "light"
  );

  $("#themeToggle")?.addEventListener("click", toggleTheme);
  $("#authThemeToggle")?.addEventListener("click", toggleTheme);
}

/* ============================================
   5. AUTHENTICATION SCREENS
============================================ */

function showLogin() {
  showElement("#authPage", true);
  showElement("#app", false);

  showElement("#loginView", true);
  showElement("#registerView", false);
}

function showRegister() {
  showElement("#loginView", false);
  showElement("#registerView", true);
}

function showDashboard() {
  showElement("#authPage", false);
  showElement("#app", true);

  navigate("dashboard");
}

$("#showRegister")?.addEventListener("click", showRegister);
$("#showLogin")?.addEventListener("click", showLogin);

/* ============================================
   6. TEACHER REGISTRATION
============================================ */

async function registerTeacher(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');

  const name = getValue(form, "name");
  const email = getValue(form, "email");
  const password = getValue(form, "password");
  const confirmPassword = getValue(form, "confirmPassword");
  const subjects = selectedSubjects(form);

  if (!name || !email || !password) {
    return notify("Complete all required fields.", "error");
  }

  if (password.length < 8) {
    return notify("Password must contain at least 8 characters.", "error");
  }

  if (password !== confirmPassword) {
    return notify("Passwords do not match.", "error");
  }

  if (!subjects.length) {
    return notify("Select at least one teaching subject.", "error");
  }

  setLoading(button, true, "Create teacher account →");

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(credential.user, {
      displayName: name
    });

    const profile = {
      uid: credential.user.uid,
      name,
      email,
      subjects,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(
      doc(db, "teachers", credential.user.uid),
      profile
    );

    teacherData = profile;
    currentUser = credential.user;

    notify("Your teacher account has been created.");

    await loadApplication();

    showDashboard();

  } catch (error) {
    console.error(error);

    const messages = {
      "auth/email-already-in-use": "This email is already registered.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/weak-password": "Choose a stronger password.",
      "auth/network-request-failed": "Check your internet connection."
    };

    notify(messages[error.code] || error.message, "error");

  } finally {
    setLoading(button, false, "Create teacher account →");
  }
}

/* ============================================
   7. TEACHER LOGIN
============================================ */

async function loginTeacher(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');

  const email = getValue(form, "email");
  const password = getValue(form, "password");

  if (!email || !password) {
    return notify("Enter your email and password.", "error");
  }

  setLoading(button, true, "Sign in to dashboard →");

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const profile = await getDoc(
      doc(db, "teachers", credential.user.uid)
    );

    if (!profile.exists()) {
      await signOut(auth);
      throw new Error("Teacher profile does not exist.");
    }

    currentUser = credential.user;
    teacherData = profile.data();

    await loadApplication();

    showDashboard();

    notify("Welcome back!");

  } catch (error) {
    console.error(error);

    const messages = {
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/user-not-found": "Account not found.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
      "auth/network-request-failed": "Check your internet connection."
    };

    notify(messages[error.code] || error.message, "error");

  } finally {
    setLoading(button, false, "Sign in to dashboard →");
  }
}

/* ============================================
   8. PASSWORD RESET
============================================ */

async function resetPassword() {
  const email = getValue($("#loginForm"), "email");

  if (!email) {
    return notify("Enter your email address first.", "error");
  }

  try {
    await sendPasswordResetEmail(auth, email);
    notify("Password reset link sent to your email.");
  } catch (error) {
    notify(error.message, "error");
  }
}

/* ============================================
   9. LOGOUT
============================================ */

async function logout() {
  try {
    await signOut(auth);

    currentUser = null;
    teacherData = {};
    students = [];
    attendanceRecords = [];
    resultRecords = [];

    showLogin();

    notify("You have signed out successfully.");

  } catch (error) {
    notify(error.message, "error");
  }
}

/* ============================================
   10. NAVIGATION
============================================ */

const PAGE_TITLES = {
  dashboard: "Overview",
  students: "Students",
  add: "Add Student",
  attendance: "Attendance",
  results: "Examination Results",
  subjects: "My Subjects",
  settings: "Settings"
};

function navigate(page) {
  if (!currentUser) return;

  currentPage = page;

  $$(".page").forEach(element => {
    element.classList.remove("active");
  });

  const target = $(`#page-${page}`);

  if (target) {
    target.classList.add("active");
  } else {
    return;
  }

  $$("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  setText("pageTitle", PAGE_TITLES[page] || page);
  setText("breadcrumbPage", PAGE_TITLES[page] || page);

  $("#sidebar")?.classList.remove("open");

  if (page === "dashboard") renderDashboard();
  if (page === "students") renderStudents();
  if (page === "subjects") renderSubjects();
  if (page === "attendance") renderAttendance();
  if (page === "results") renderResults();
  if (page === "settings") renderSettings();
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");

  if (!button || !currentUser) return;

  event.preventDefault();

  const page = button.dataset.page;

  if (page === "add") {
    resetStudentForm();
  }

  navigate(page);
});

$("#menuToggle")?.addEventListener("click", () => {
  $("#sidebar")?.classList.toggle("open");
});

/* ============================================
   11. LOAD FIRESTORE DATA
============================================ */

async function loadApplication() {
  if (!currentUser) return;

  try {
    const profile = await getDoc(teacherRef());

    if (!profile.exists()) {
      throw new Error("Teacher profile missing.");
    }

    teacherData = profile.data();

    const snapshot = await getDocs(studentsRef());

    students = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    attendanceRecords = [];
    resultRecords = [];

    for (const student of students) {
      const [attendanceSnap, resultSnap] = await Promise.all([
        getDocs(attendanceRef(student.id)),
        getDocs(resultsRef(student.id))
      ]);

      attendanceSnap.forEach(record => {
        attendanceRecords.push({
          id: record.id,
          studentId: student.id,
          studentName: student.name,
          rollNo: student.rollNo,
          ...record.data()
        });
      });

      resultSnap.forEach(record => {
        resultRecords.push({
          id: record.id,
          studentId: student.id,
          studentName: student.name,
          rollNo: student.rollNo,
          ...record.data()
        });
      });
    }

    attendanceRecords.sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || ""))
    );

    renderProfile();
    renderDashboard();
    renderStudents();
    renderSubjects();
    renderAttendance();
    renderResults();
    populateSelects();

  } catch (error) {
    console.error("Application loading:", error);
    notify("Unable to load academic records: " + error.message, "error");
  }
}

/* ============================================
   12. TEACHER PROFILE
============================================ */

function renderProfile() {
  const name = teacherData.name || currentUser.displayName || "Teacher";
  const initial = name.charAt(0).toUpperCase();

  setText("welcomeName", name.split(" ")[0]);
  setText("teacherName", name);
  setText("sidebarName", name);
  setText("sidebarAvatar", initial);
  setText("topAvatar", initial);

  const date = new Date();

  setText(
    "currentDate",
    date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    })
  );
}

/* ============================================
   13. STUDENT FORM
============================================ */

function resetStudentForm() {
  editingStudentId = null;

  $("#studentForm")?.reset();

  setText("studentFormTitle", "Add new student");

  const button = $("#saveStudentButton");

  if (button) button.textContent = "Save student record →";
}

async function saveStudent(event) {
  event.preventDefault();

  if (!currentUser) return;

  const form = event.currentTarget;
  const button = $("#saveStudentButton");

  const student = {
    name: getValue(form, "name"),
    rollNo: getValue(form, "rollNo"),
    email: getValue(form, "email"),
    phone: getValue(form, "phone"),
    department: getValue(form, "department"),
    year: getValue(form, "year"),
    section: getValue(form, "section"),
    cgpa: Number(getValue(form, "cgpa") || 0),
    updatedAt: serverTimestamp()
  };

  if (!student.name || !student.rollNo) {
    return notify("Student name and roll number are required.", "error");
  }

  if (!Number.isFinite(student.cgpa) || student.cgpa < 0 || student.cgpa > 10) {
    return notify("CGPA must be between 0 and 10.", "error");
  }

  const duplicate = students.find(item =>
    item.rollNo.toLowerCase() === student.rollNo.toLowerCase() &&
    item.id !== editingStudentId
  );

  if (duplicate) {
    return notify("This roll number already exists.", "error");
  }

  setLoading(button, true, "Save student record →");

  try {
    if (editingStudentId) {
      await updateDoc(studentRef(editingStudentId), student);
      notify("Student record updated successfully.");
    } else {
      await addDoc(studentsRef(), {
        ...student,
        createdAt: serverTimestamp()
      });
      notify("Student added successfully.");
    }

    resetStudentForm();

    await loadApplication();

    navigate("students");

  } catch (error) {
    console.error(error);
    notify(error.message, "error");

  } finally {
    setLoading(button, false, "Save student record →");
  }
}

/* ============================================
   14. STUDENT DIRECTORY
============================================ */

function renderStudents(list = students) {
  const tbody = $("#studentTableBody");

  if (!tbody) return;

  setText("studentCountLabel", `${list.length} student records`);

  if (!list.length) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="empty-cell">
        No matching student records found.
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(student => `
    <tr>
      <td><strong>${escapeHTML(student.rollNo)}</strong></td>
      <td>${escapeHTML(student.name)}</td>
      <td>${escapeHTML(student.email || "—")}</td>
      <td>${escapeHTML(student.department || "—")}</td>
      <td>${escapeHTML(student.year || "—")}</td>
      <td>
        <button data-edit-student="${student.id}">Edit</button>
        <button data-delete-student="${student.id}">Delete</button>
      </td>
    </tr>
  `).join("");
}

/* ============================================
   15. STUDENT SEARCH
============================================ */

$("#studentSearch")?.addEventListener("input", event => {
  const search = event.target.value.toLowerCase();

  const filtered = students.filter(student => {
    const text = [
      student.name,
      student.rollNo,
      student.email,
      student.department,
      student.year
    ].join(" ").toLowerCase();

    return text.includes(search);
  });

  renderStudents(filtered);
});

/* ============================================
   16. EDIT STUDENT
============================================ */

function editStudent(id) {
  const student = students.find(item => item.id === id);

  if (!student) return;

  editingStudentId = id;

  const form = $("#studentForm");

  if (!form) return;

  [
    "name",
    "rollNo",
    "email",
    "phone",
    "department",
    "year",
    "section",
    "cgpa"
  ].forEach(key => {
    const field = form.elements.namedItem(key);

    if (field) {
      field.value = student[key] ?? "";
    }
  });

  setText("studentFormTitle", "Edit student record");

  const button = $("#saveStudentButton");

  if (button) button.textContent = "Update student record →";

  navigate("add");
}

/* ============================================
   17. DELETE STUDENT
============================================ */

async function deleteStudent(id) {
  const student = students.find(item => item.id === id);

  if (!student) return;

  if (!confirm(`Permanently delete ${student.name}'s record and associated academic entries?`)) {
    return;
  }

  try {
    const [attendanceSnap, resultSnap] = await Promise.all([
      getDocs(attendanceRef(id)),
      getDocs(resultsRef(id))
    ]);

    await Promise.all([
      ...attendanceSnap.docs.map(item => deleteDoc(item.ref)),
      ...resultSnap.docs.map(item => deleteDoc(item.ref))
    ]);

    await deleteDoc(studentRef(id));

    await loadApplication();

    notify("Student and associated records deleted.");

  } catch (error) {
    console.error(error);
    notify("Unable to delete student: " + error.message, "error");
  }
}

document.addEventListener("click", event => {
  const edit = event.target.closest("[data-edit-student]");
  const remove = event.target.closest("[data-delete-student]");

  if (edit) editStudent(edit.dataset.editStudent);

  if (remove) deleteStudent(remove.dataset.deleteStudent);
});

/* ============================================
   18. SELECT DROPDOWNS
============================================ */

function populateSelects() {
  const options = `
    <option value="">Select student</option>
    ${students.map(student => `
      <option value="${student.id}">
        ${escapeHTML(student.name)} (${escapeHTML(student.rollNo)})
      </option>
    `).join("")}
  `;

  ["#attendanceStudent", "#resultStudent"].forEach(selector => {
    const select = $(selector);

    if (!select) return;

    const previous = select.value;
    select.innerHTML = options;

    if (students.some(student => student.id === previous)) {
      select.value = previous;
    }
  });

  const subjectSelect = $("#resultSubject");

  if (subjectSelect) {
    const previous = subjectSelect.value;

    subjectSelect.innerHTML = `
      <option value="">Select subject</option>
      ${(teacherData.subjects || []).map(subject => `
        <option value="${escapeHTML(subject)}">
          ${escapeHTML(SUBJECTS[subject] || subject)}
        </option>
      `).join("")}
    `;

    if ((teacherData.subjects || []).includes(previous)) {
      subjectSelect.value = previous;
    }
  }
}

/* ============================================
   19. ATTENDANCE MANAGEMENT
============================================ */

async function saveAttendance(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const studentId = getValue(form, "studentId");
  const date = getValue(form, "date");
  const status = getValue(form, "status");
  const remarks = getValue(form, "remarks");

  if (!studentId || !date || !status) {
    return notify("Complete the attendance details.", "error");
  }

  const existing = attendanceRecords.find(item =>
    item.studentId === studentId && item.date === date
  );

  if (existing) {
    return notify("Attendance is already recorded for this student on this date.", "error");
  }

  try {
    await addDoc(attendanceRef(studentId), {
      date,
      status,
      remarks,
      createdAt: serverTimestamp()
    });

    form.reset();

    await loadApplication();

    notify("Attendance saved successfully.");

  } catch (error) {
    notify(error.message, "error");
  }
}

function renderAttendance() {
  const tbody = $("#attendanceTable");

  if (!tbody) return;

  if (!attendanceRecords.length) {
    tbody.innerHTML = `
      <tr><td colspan="4" class="empty-cell">
        No attendance records available.
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = attendanceRecords.map(record => `
    <tr>
      <td>${escapeHTML(record.studentName)}</td>
      <td>${escapeHTML(record.date || "—")}</td>
      <td><strong>${escapeHTML(record.status)}</strong></td>
      <td>${escapeHTML(record.remarks || "—")}</td>
    </tr>
  `).join("");
}

/* ============================================
   20. EXAMINATION RESULTS
============================================ */

async function saveResult(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const studentId = getValue(form, "studentId");
  const subject = getValue(form, "subject");
  const exam = getValue(form, "exam");
  const marks = Number(getValue(form, "marks"));
  const maxMarks = Number(getValue(form, "maxMarks"));
  const date = getValue(form, "date");

  if (
    !studentId ||
    !subject ||
    !exam ||
    !Number.isFinite(marks) ||
    !Number.isFinite(maxMarks) ||
    maxMarks <= 0 ||
    marks < 0 ||
    marks > maxMarks
  ) {
    return notify("Enter valid examination details and marks.", "error");
  }

  const duplicate = resultRecords.find(record =>
    record.studentId === studentId &&
    record.subject === subject &&
    record.exam === exam
  );

  if (duplicate) {
    return notify("This examination result has already been recorded.", "error");
  }

  try {
    await addDoc(resultsRef(studentId), {
      subject,
      exam,
      marks,
      maxMarks,
      percentage: Number(((marks / maxMarks) * 100).toFixed(2)),
      date: date || today(),
      createdAt: serverTimestamp()
    });

    form.reset();

    await loadApplication();

    notify("Examination result saved successfully.");

  } catch (error) {
    notify(error.message, "error");
  }
}

function renderResults() {
  const tbody = $("#resultsTable");

  if (!tbody) return;

  if (!resultRecords.length) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="empty-cell">
        No examination results recorded.
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = resultRecords.map(record => `
    <tr>
      <td>${escapeHTML(record.studentName)}</td>
      <td>${escapeHTML(SUBJECTS[record.subject] || record.subject)}</td>
      <td>${escapeHTML(record.exam)}</td>
      <td>${Number(record.marks)} / ${Number(record.maxMarks)}</td>
      <td><strong>${Number(record.percentage).toFixed(1)}%</strong></td>
      <td>${escapeHTML(record.date || "—")}</td>
    </tr>
  `).join("");
}

/* ============================================
   21. SUBJECT MANAGEMENT
============================================ */

function renderSubjects() {
  const subjects = teacherData.subjects || [];

  setText("totalSubjects", subjects.length);

  const makeCards = () => subjects.map((subject, index) => `
    <article class="subject-card">
      <div class="subject-number">SUBJECT ${String(index + 1).padStart(2, "0")}</div>
      <h3>${escapeHTML(SUBJECTS[subject] || subject)}</h3>
      <p>Academic subject · ${escapeHTML(subject)}</p>
    </article>
  `).join("");

  const dashboard = $("#dashboardSubjects");
  const directory = $("#subjectCards");

  if (dashboard) {
    dashboard.innerHTML = subjects.length
      ? makeCards()
      : "<p>No subjects assigned. Update your settings.</p>";
  }

  if (directory) {
    directory.innerHTML = subjects.length
      ? makeCards()
      : "<p>No registered subjects found.</p>";
  }

  populateSelects();
}

/* ============================================
   22. DASHBOARD ANALYTICS
============================================ */

function renderDashboard() {
  if (!currentUser) return;

  setText("totalStudents", students.length);
  setText("totalSubjects", (teacherData.subjects || []).length);

  const attendanceTotal = attendanceRecords.length;

  const presentTotal = attendanceRecords.filter(record =>
    String(record.status).toLowerCase() === "present"
  ).length;

  const attendancePercentage = attendanceTotal
    ? (presentTotal / attendanceTotal) * 100
    : 0;

  setText(
    "averageAttendance",
    attendancePercentage.toFixed(1) + "%"
  );

  const marksPercentage = resultRecords.map(record =>
    Number(record.percentage)
  ).filter(Number.isFinite);

  setText(
    "averageMarks",
    average(marksPercentage).toFixed(1) + "%"
  );

  const tbody = $("#recentStudents");

  if (tbody) {
    const recent = [...students].slice(-5).reverse();

    tbody.innerHTML = recent.length
      ? recent.map(student => `
          <tr>
            <td><strong>${escapeHTML(student.name)}</strong></td>
            <td>${escapeHTML(student.rollNo)}</td>
            <td>${escapeHTML(student.year || "—")}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="3" class="empty-cell">
          No student records yet.
        </td></tr>`;
  }

  renderSubjects();
}

/* ============================================
   23. SETTINGS
============================================ */

function renderSettings() {
  const form = $("#settingsForm");

  if (!form) return;

  const name = form.elements.namedItem("name");
  const email = form.elements.namedItem("email");

  if (name) name.value = teacherData.name || "";
  if (email) email.value = currentUser.email || "";

  form.querySelectorAll('input[name="subjects"]').forEach(input => {
    input.checked = (teacherData.subjects || []).includes(input.value);
  });
}

async function saveSettings(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const name = getValue(form, "name");
  const subjects = selectedSubjects(form);

  if (!name) {
    return notify("Teacher name is required.", "error");
  }

  if (!subjects.length) {
    return notify("Select at least one subject.", "error");
  }

  try {
    await updateProfile(currentUser, {
      displayName: name
    });

    await setDoc(teacherRef(), {
      name,
      subjects,
      updatedAt: serverTimestamp()
    }, { merge: true });

    teacherData.name = name;
    teacherData.subjects = subjects;

    renderProfile();
    renderSubjects();

    notify("Your profile has been updated.");

  } catch (error) {
    console.error(error);
    notify(error.message, "error");
  }
}

/* ============================================
   24. FORM CONNECTIONS
============================================ */

function connectForms() {
  $("#loginForm")?.addEventListener("submit", loginTeacher);
  $("#registerForm")?.addEventListener("submit", registerTeacher);
  $("#studentForm")?.addEventListener("submit", saveStudent);
  $("#attendanceForm")?.addEventListener("submit", saveAttendance);
  $("#resultForm")?.addEventListener("submit", saveResult);
  $("#settingsForm")?.addEventListener("submit", saveSettings);

  $("#forgotPassword")?.addEventListener("click", resetPassword);

  $("#logoutButton")?.addEventListener("click", logout);
  $("#settingsLogout")?.addEventListener("click", logout);

  $("#cancelStudent")?.addEventListener("click", () => {
    resetStudentForm();
    navigate("students");
  });

  $("#attendanceForm")?.elements.namedItem("date")
    ?.setAttribute("max", today());

  $("#attendanceForm")?.elements.namedItem("date")
    ?.setAttribute("value", today());
}

/* ============================================
   25. FIREBASE AUTH STATE
============================================ */

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (!user) {
    teacherData = {};
    students = [];
    attendanceRecords = [];
    resultRecords = [];

    showLogin();
    return;
  }

  try {
    const profile = await getDoc(
      doc(db, "teachers", user.uid)
    );

    if (!profile.exists()) {
      await signOut(auth);
      showLogin();
      return;
    }

    teacherData = profile.data();

    await loadApplication();

    showDashboard();

  } catch (error) {
    console.error(error);
    notify("Unable to verify your teacher account.", "error");
    await signOut(auth);
    showLogin();
  }
});

/* ============================================
   26. INITIALIZATION
============================================ */

function initializeApplication() {
  initializeTheme();
  connectForms();

  showLogin();

  console.log("StudentHub Academic Management Portal ready.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApplication);
} else {
  initializeApplication();
}
