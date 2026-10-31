
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged
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

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================

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

// ==========================================
// APP CONFIGURATION
// ==========================================

const SUBJECTS = ["DS", "DBMS", "MFCS", "FOIS", "CN", "OOPS"];

let currentTeacher = null;
let teacherProfile = null;
let students = [];
let selectedSubject = "DS";
let editingStudentId = null;

const $ = id => document.getElementById(id);

function showToast(message) {
  const toast = $("toast");
  if (toast) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
  } else {
    alert(message);
  }
}

function showView(id) {
  document.querySelectorAll(".auth-view").forEach(el => {
    el.classList.add("hidden");
  });

  const view = $(id);
  if (view) view.classList.remove("hidden");
}

function showApp() {
  if ($("authPage")) $("authPage").classList.add("hidden");
  if ($("app")) $("app").classList.remove("hidden");
}

function showLogin() {
  if ($("authPage")) $("authPage").classList.remove("hidden");
  if ($("app")) $("app").classList.add("hidden");
  showView("loginView");
}

function clean(value) {
  return String(value ?? "").trim();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

// ==========================================
// TEACHER REGISTRATION
// ==========================================

async function registerTeacher(event) {
  event?.preventDefault();

  const name = clean($("registerName")?.value);
  const email = clean($("registerEmail")?.value).toLowerCase();
  const password = $("registerPassword")?.value;

  const selectedSubjects = [
    ...document.querySelectorAll(
      'input[name="registerSubject"]:checked'
    )
  ].map(input => input.value);

  if (!name || !email || !password) {
    return showToast("Please fill in all details.");
  }

  if (password.length < 6) {
    return showToast("Password must contain at least 6 characters.");
  }

  if (!selectedSubjects.length) {
    return showToast("Please select at least one subject.");
  }

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = credential.user;

    await setDoc(doc(db, "teachers", user.uid), {
      uid: user.uid,
      name,
      email,
      subjects: selectedSubjects,
      createdAt: serverTimestamp()
    });

    localStorage.setItem("studenthub_email", email);

    teacherProfile = {
      uid: user.uid,
      name,
      email,
      subjects: selectedSubjects
    };

    showToast("Account created successfully!");
    await loadDashboardData();

  } catch (error) {
    console.error(error);
    showToast(error.message);
  }
}

// ==========================================
// TEACHER LOGIN
// ==========================================

async function loginTeacher(event) {
  event?.preventDefault();

  const email = clean($("loginEmail")?.value).toLowerCase();
  const password = $("loginPassword")?.value;

  if (!email || !password) {
    return showToast("Enter your email and password.");
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    localStorage.setItem("studenthub_email", email);
    showToast("Login successful!");

  } catch (error) {
    console.error(error);
    showToast("Login failed: " + error.message);
  }
}

// ==========================================
// PASSWORD RESET
// ==========================================

async function resetPassword() {
  const email = clean($("loginEmail")?.value).toLowerCase();

  if (!email) {
    return showToast("Enter your email address first.");
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Password reset email sent!");
  } catch (error) {
    showToast(error.message);
  }
}

// ==========================================
// LOGOUT
// ==========================================

async function logoutTeacher() {
  try {
    await signOut(auth);
    teacherProfile = null;
    students = [];
    localStorage.removeItem("studenthub_email");
    showLogin();
    showToast("Logged out successfully.");
  } catch (error) {
    showToast(error.message);
  }
}

// ==========================================
// LOAD TEACHER PROFILE
// ==========================================

async function loadTeacherProfile(user) {
  const reference = doc(db, "teachers", user.uid);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    throw new Error(
      "Teacher profile not found. Please contact the administrator."
    );
  }

  teacherProfile = snapshot.data();

  if ($("welcomeName")) {
    $("welcomeName").textContent = teacherProfile.name;
  }

  if ($("teacherName")) {
    $("teacherName").textContent = teacherProfile.name;
  }

  if ($("teacherEmail")) {
    $("teacherEmail").textContent = teacherProfile.email;
  }

  renderSubjectNavigation();
}

// ==========================================
// LOAD STUDENTS
// ==========================================

async function loadStudents() {
  if (!currentTeacher) return;

  const reference = collection(
    db,
    "teachers",
    currentTeacher.uid,
    "students"
  );

  const snapshot = await getDocs(reference);

  students = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  renderAll();
}

// ==========================================
// ADD STUDENT
// ==========================================

async function saveStudent(event) {
  event?.preventDefault();

  if (!currentTeacher || !teacherProfile) return;

  const name = clean($("studentName")?.value);
  const roll = clean($("studentRoll")?.value);
  const email = clean($("studentEmail")?.value);
  const department = clean($("studentDepartment")?.value);

  const selectedSubjects = [
    ...document.querySelectorAll(
      'input[name="studentSubject"]:checked'
    )
  ].map(input => input.value)
    .filter(subject => teacherProfile.subjects.includes(subject));

  if (!name || !roll) {
    return showToast("Student name and roll number are required.");
  }

  if (!selectedSubjects.length) {
    return showToast("Select at least one subject.");
  }

  const studentId = editingStudentId || roll;

  const student = {
    name,
    roll,
    email,
    department,
    subjects: selectedSubjects,
    attendance: {},
    results: {},
    updatedAt: serverTimestamp()
  };

  try {
    const reference = doc(
      db,
      "teachers",
      currentTeacher.uid,
      "students",
      studentId
    );

    if (editingStudentId) {
      const oldStudent = students.find(s => s.id === editingStudentId);

      student.attendance = oldStudent?.attendance || {};
      student.results = oldStudent?.results || {};

      await updateDoc(reference, student);
      editingStudentId = null;
      showToast("Student updated successfully!");
    } else {
      if (students.some(s => s.id === studentId)) {
        return showToast("This roll number already exists.");
      }

      await setDoc(reference, {
        ...student,
        createdAt: serverTimestamp()
      });

      showToast("Student added successfully!");
    }

    $("studentForm")?.reset();
    await loadStudents();

  } catch (error) {
    console.error(error);
    showToast(error.message);
  }
}

// ==========================================
// DELETE STUDENT
// ==========================================

async function deleteStudent(id) {
  if (!confirm("Are you sure you want to delete this student?")) return;

  try {
    await deleteDoc(doc(
      db,
      "teachers",
      currentTeacher.uid,
      "students",
      id
    ));

    await loadStudents();
    showToast("Student deleted successfully!");

  } catch (error) {
    showToast(error.message);
  }
}

// ==========================================
// EDIT STUDENT
// ==========================================

function editStudent(id) {
  const student = students.find(s => s.id === id);
  if (!student) return;

  if ($("studentName")) $("studentName").value = student.name || "";
  if ($("studentRoll")) $("studentRoll").value = student.roll || "";
  if ($("studentEmail")) $("studentEmail").value = student.email || "";
  if ($("studentDepartment")) {
    $("studentDepartment").value = student.department || "";
  }

  document.querySelectorAll('input[name="studentSubject"]').forEach(input => {
    input.checked = (student.subjects || []).includes(input.value);
  });

  editingStudentId = id;
  navigateTo("add");
}

// ==========================================
// ATTENDANCE
// ==========================================

async function saveAttendance(event) {
  event?.preventDefault();

  const studentId = $("attendanceStudent")?.value;
  const subject = $("attendanceSubject")?.value || selectedSubject;
  const held = Number($("classesHeld")?.value);
  const attended = Number($("classesAttended")?.value);

  if (!studentId || !subject) {
    return showToast("Select a student and subject.");
  }

  if (
    !Number.isInteger(held) ||
    !Number.isInteger(attended) ||
    held < 0 ||
    attended < 0 ||
    attended > held
  ) {
    return showToast("Please enter valid attendance numbers.");
  }

  const student = students.find(s => s.id === studentId);

  if (!student || !student.subjects?.includes(subject)) {
    return showToast("This student is not enrolled in this subject.");
  }

  try {
    await updateDoc(doc(
      db,
      "teachers",
      currentTeacher.uid,
      "students",
      studentId
    ), {
      [`attendance.${subject}`]: {
        held,
        attended
      }
    });

    await loadStudents();
    showToast("Attendance saved!");

  } catch (error) {
    showToast(error.message);
  }
}

// ==========================================
// SEMESTER RESULTS
// ==========================================

async function saveResult(event) {
  event?.preventDefault();

  const studentId = $("resultStudent")?.value;
  const semester = $("resultSemester")?.value;
  const sgpa = Number($("resultSGPA")?.value);

  if (!studentId || !semester) {
    return showToast("Select a student and semester.");
  }

  if (!Number.isFinite(sgpa) || sgpa < 0 || sgpa > 10) {
    return showToast("SGPA must be between 0 and 10.");
  }

  try {
    await updateDoc(doc(
      db,
      "teachers",
      currentTeacher.uid,
      "students",
      studentId
    ), {
      [`results.${semester}`]: sgpa
    });

    await loadStudents();
    showToast("Academic result saved!");

  } catch (error) {
    showToast(error.message);
  }
}

// ==========================================
// CGPA CALCULATIONS
// ==========================================

function getCGPA(student) {
  const values = Object.values(student.results || {})
    .map(Number)
    .filter(n => Number.isFinite(n));

  if (!values.length) return "—";

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  ).toFixed(2);
}

function getYearCGPA(student, year) {
  const firstSemester = (year - 1) * 2 + 1;
  const values = [firstSemester, firstSemester + 1]
    .map(semester => student.results?.[semester])
    .filter(value => value !== undefined && value !== null)
    .map(Number);

  if (!values.length) return "—";

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  ).toFixed(2);
}

function getAttendance(student, subject) {
  const data = student.attendance?.[subject];

  if (!data || !data.held) return "—";

  return ((data.attended / data.held) * 100).toFixed(1) + "%";
}

function getOverallAttendance(student) {
  let held = 0;
  let attended = 0;

  Object.values(student.attendance || {}).forEach(data => {
    held += Number(data.held || 0);
    attended += Number(data.attended || 0);
  });

  if (!held) return "—";

  return ((attended / held) * 100).toFixed(1) + "%";
}

// ==========================================
// SUBJECT NAVIGATION
// ==========================================

function renderSubjectNavigation() {
  const container = $("subjectNavigation");
  if (!container) return;

  container.innerHTML = teacherProfile.subjects.map(subject => `
    <button class="subject-nav-item"
      data-subject="${escapeHTML(subject)}"
      onclick="openSubject('${escapeHTML(subject)}')">
      ${escapeHTML(subject)}
    </button>
  `).join("");

  renderSubjectPickers();
}

function renderSubjectPickers() {
  ["studentSubjectPicker", "settingsSubjectPicker"].forEach(id => {
    const container = $(id);
    if (!container) return;

    container.innerHTML = teacherProfile.subjects.map(subject => `
      <label>
        <input type="checkbox"
          name="${id === "studentSubjectPicker" ? "studentSubject" : "teacherSubject"}"
          value="${escapeHTML(subject)}">
        ${escapeHTML(subject)}
      </label>
    `).join("");
  });

  ["attendanceSubject", "settingsSubject"].forEach(id => {
    const select = $(id);
    if (!select) return;

    select.innerHTML = teacherProfile.subjects.map(subject => `
      <option value="${escapeHTML(subject)}">${escapeHTML(subject)}</option>
    `).join("");
  });
}

// ==========================================
// OPEN SUBJECT
// ==========================================

function openSubject(subject) {
  if (!teacherProfile?.subjects.includes(subject)) return;

  selectedSubject = subject;

  if ($("subjectTitle")) {
    $("subjectTitle").textContent = subject;
  }

  const filtered = students.filter(s =>
    s.subjects?.includes(subject)
  );

  const body = $("subjectTableBody");

  if (body) {
    body.innerHTML = filtered.map(student => `
      <tr>
        <td>${escapeHTML(student.name)}</td>
        <td>${escapeHTML(student.roll)}</td>
        <td>${getAttendance(student, subject)}</td>
        <td>${getCGPA(student)}</td>
      </tr>
    `).join("");
  }

  navigateTo("subject");
}

// ==========================================
// STUDENT TABLE
// ==========================================

function renderStudents() {
  const body = $("studentTableBody");
  if (!body) return;

  body.innerHTML = students.map(student => `
    <tr>
      <td>${escapeHTML(student.name)}</td>
      <td>${escapeHTML(student.roll)}</td>
      <td>${escapeHTML(student.email || "—")}</td>
      <td>${escapeHTML((student.subjects || []).join(", "))}</td>
      <td>
        <button onclick="editStudent('${escapeHTML(student.id)}')">Edit</button>
        <button onclick="deleteStudent('${escapeHTML(student.id)}')">Delete</button>
      </td>
    </tr>
  `).join("");
}

// ==========================================
// ATTENDANCE TABLE
// ==========================================

function renderAttendance() {
  const body = $("attendanceTableBody");
  if (!body) return;

  body.innerHTML = students.map(student => `
    <tr>
      <td>${escapeHTML(student.name)}</td>
      <td>${escapeHTML(student.roll)}</td>
      <td>${getOverallAttendance(student)}</td>
      <td>
        ${teacherProfile.subjects.map(subject => `
          <span>${escapeHTML(subject)}: ${getAttendance(student, subject)}</span>
        `).join(" | ")}
      </td>
    </tr>
  `).join("");

  populateStudentSelects();
}

// ==========================================
// ACADEMIC TABLE
// ==========================================

function renderAcademic() {
  const body = $("academicTableBody");
  if (!body) return;

  body.innerHTML = students.map(student => `
    <tr>
      <td>${escapeHTML(student.name)}</td>
      <td>${escapeHTML(student.roll)}</td>
      <td>${student.results?.[1] ?? "—"}</td>
      <td>${student.results?.[2] ?? "—"}</td>
      <td>${getYearCGPA(student, 1)}</td>
      <td>${getYearCGPA(student, 2)}</td>
      <td>${getYearCGPA(student, 3)}</td>
      <td>${getYearCGPA(student, 4)}</td>
      <td>${getCGPA(student)}</td>
    </tr>
  `).join("");
}

// ==========================================
// DASHBOARD
// ==========================================

function renderDashboard() {
  const total = students.length;

  if ($("totalStudents")) {
    $("totalStudents").textContent = total;
  }

  if ($("totalSubjects")) {
    $("totalSubjects").textContent = teacherProfile.subjects.length;
  }

  if ($("averageAttendance")) {
    const values = students
      .map(s => Number.parseFloat(getOverallAttendance(s)))
      .filter(Number.isFinite);

    $("averageAttendance").textContent = values.length
      ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) + "%"
      : "0%";
  }

  if ($("averageCGPA")) {
    const values = students
      .map(s => Number.parseFloat(getCGPA(s)))
      .filter(Number.isFinite);

    $("averageCGPA").textContent = values.length
      ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)
      : "0.00";
  }

  const recent = $("recentStudents");

  if (recent) {
    recent.innerHTML = students.slice(-5).reverse().map(s => `
      <div class="recent-student">
        <strong>${escapeHTML(s.name)}</strong>
        <span>${escapeHTML(s.roll)}</span>
      </div>
    `).join("");
  }
}

// ==========================================
// POPULATE SELECT BOXES
// ==========================================

function populateStudentSelects() {
  ["attendanceStudent", "resultStudent"].forEach(id => {
    const select = $(id);
    if (!select) return;

    const oldValue = select.value;

    select.innerHTML = `
      <option value="">Select student</option>
      ${students.map(student => `
        <option value="${escapeHTML(student.id)}">
          ${escapeHTML(student.name)} (${escapeHTML(student.roll)})
        </option>
      `).join("")}
    `;

    if (students.some(s => s.id === oldValue)) {
      select.value = oldValue;
    }
  });
}

// ==========================================
// RENDER ALL
// ==========================================

function renderAll() {
  renderStudents();
  renderAttendance();
  renderAcademic();
  renderDashboard();
}

// ==========================================
// NAVIGATION
// ==========================================

function navigateTo(page) {
  document.querySelectorAll(".page").forEach(section => {
    section.classList.add("hidden");
  });

  const target = $("page-" + page);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });
}

// ==========================================
// DARK MODE
// ==========================================

function toggleTheme() {
  document.body.classList.toggle("dark-mode");

  const dark = document.body.classList.contains("dark-mode");

  localStorage.setItem("studenthub_theme", dark ? "dark" : "light");
}

function loadTheme() {
  const theme = localStorage.getItem("studenthub_theme");

  document.body.classList.toggle("dark-mode", theme === "dark");
}

// ==========================================
// SETTINGS
// ==========================================

async function saveSettings(event) {
  event?.preventDefault();

  const name = clean($("settingsName")?.value);

  const subjects = [
    ...document.querySelectorAll(
      'input[name="teacherSubject"]:checked'
    )
  ].map(input => input.value);

  if (!name || !subjects.length) {
    return showToast("Enter your name and select subjects.");
  }

  try {
    await updateDoc(doc(db, "teachers", currentTeacher.uid), {
      name,
      subjects
    });

    teacherProfile.name = name;
    teacherProfile.subjects = subjects;

    renderSubjectNavigation();
    await loadStudents();

    showToast("Settings saved!");

  } catch (error) {
    showToast(error.message);
  }
}

// ==========================================
// LOAD DASHBOARD
// ==========================================

async function loadDashboardData() {
  currentTeacher = auth.currentUser;

  if (!currentTeacher) return;

  await loadTeacherProfile(currentTeacher);
  await loadStudents();

  showApp();
  navigateTo("dashboard");
}

// ==========================================
// AUTHENTICATION LISTENER
// ==========================================

let authReady = false;

onAuthStateChanged(auth, async user => {
  if (user) {
    currentTeacher = user;

    try {
      await loadDashboardData();
    } catch (error) {
      console.error(error);
      showToast(error.message);
      showLogin();
    }
  } else {
    currentTeacher = null;
    teacherProfile = null;
    students = [];
    showLogin();
  }

  authReady = true;
});

// ==========================================
// EVENT LISTENERS
// ==========================================

function bind(id, event, callback) {
  $(id)?.addEventListener(event, callback);
}

bind("loginForm", "submit", loginTeacher);
bind("registerForm", "submit", registerTeacher);
bind("studentForm", "submit", saveStudent);
bind("attendanceForm", "submit", saveAttendance);
bind("resultForm", "submit", saveResult);
bind("settingsForm", "submit", saveSettings);

bind("logoutBtn", "click", logoutTeacher);
bind("forgotPassword", "click", resetPassword);
bind("themeToggle", "click", toggleTheme);

bind("showRegister", "click", () => showView("registerView"));
bind("showLogin", "click", () => showView("loginView"));

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    navigateTo(button.dataset.page);
  });
});

loadTheme();

// ==========================================
// GLOBAL FUNCTIONS FOR HTML BUTTONS
// ==========================================

Object.assign(window, {
  registerTeacher,
  loginTeacher,
  logoutTeacher,
  resetPassword,
  saveStudent,
  editStudent,
  deleteStudent,
  saveAttendance,
  saveResult,
  saveSettings,
  navigateTo,
  openSubject,
  toggleTheme
});
