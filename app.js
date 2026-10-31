
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
// CONFIGURATION
// ==========================================

const SUBJECTS = ["DS", "DBMS", "MFCS", "FOIS", "CN", "OOPS"];

let currentTeacher = null;
let teacherProfile = null;
let students = [];
let selectedSubject = "DS";
let editingStudentId = null;

const $ = id => document.getElementById(id);

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

function showToast(message) {
  const toast = $("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function showMessage(id, message, type = "error") {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.className = "message " + type;
}

// ==========================================
// SUBJECT SELECTION - DEFINITIVE FIX
// ==========================================

function getRegistrationSubjects() {

  // Search directly inside the registration view.
  // Does not depend on form checkbox names.

  const checkboxes = document.querySelectorAll(
    '#registerView input[type="checkbox"]'
  );

  const selected = [];

  checkboxes.forEach(input => {
    if (input.checked) {
      const value = clean(input.value).toUpperCase();

      if (SUBJECTS.includes(value)) {
        selected.push(value);
      }
    }
  });

  return [...new Set(selected)];
}

function getFormSubjects(formId, allowedSubjects = SUBJECTS) {
  const form = $(formId);
  if (!form) return [];

  const selected = [];

  form.querySelectorAll('input[type="checkbox"]').forEach(input => {
    if (input.checked) {
      const value = clean(input.value).toUpperCase();

      if (allowedSubjects.includes(value)) {
        selected.push(value);
      }
    }
  });

  return [...new Set(selected)];
}

// ==========================================
// AUTHENTICATION VIEWS
// ==========================================

function showView(id) {
  $("loginView")?.classList.add("hidden");
  $("registerView")?.classList.add("hidden");

  $(id)?.classList.remove("hidden");
}

function showLogin() {
  $("authPage")?.classList.remove("hidden");
  $("app")?.classList.add("hidden");

  showView("loginView");
}

function showApp() {
  $("authPage")?.classList.add("hidden");
  $("app")?.classList.remove("hidden");
}

// ==========================================
// TEACHER REGISTRATION
// ==========================================

async function registerTeacher(event) {
  event?.preventDefault();

  const name = clean($("registerName")?.value);
  const email = clean($("registerEmail")?.value).toLowerCase();
  const password = $("registerPassword")?.value || "";

  // Read the actual checkboxes from your supplied HTML.
  const selectedSubjects = getRegistrationSubjects();

  console.log("Selected teacher subjects:", selectedSubjects);

  showMessage("registerError", "");

  if (!name || !email || !password) {
    return showMessage(
      "registerError",
      "Please fill in all details."
    );
  }

  if (password.length < 8) {
    return showMessage(
      "registerError",
      "Password must contain at least 8 characters."
    );
  }

  if (selectedSubjects.length === 0) {
    return showMessage(
      "registerError",
      "Please select at least one subject."
    );
  }

  const submitButton = $("registerForm")?.querySelector(
    'button[type="submit"]'
  );

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Creating account...";
  }

  try {

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = credential.user;

    const profile = {
      uid: user.uid,
      name: name,
      email: email,
      subjects: selectedSubjects,
      createdAt: serverTimestamp()
    };

    await setDoc(
      doc(db, "teachers", user.uid),
      profile
    );

    localStorage.setItem("studenthub_email", email);

    teacherProfile = {
      uid: user.uid,
      name,
      email,
      subjects: selectedSubjects
    };

    currentTeacher = user;

    showToast("Teacher account created successfully!");

    await loadDashboardData();

  } catch (error) {

    console.error("Registration error:", error);

    showMessage(
      "registerError",
      error.code === "auth/email-already-in-use"
        ? "This email is already registered. Please sign in instead."
        : error.message
    );

  } finally {

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Create Account <span>→</span>';
    }
  }
}

// ==========================================
// TEACHER LOGIN
// ==========================================

async function loginTeacher(event) {
  event?.preventDefault();

  const email = clean($("loginEmail")?.value).toLowerCase();
  const password = $("loginPassword")?.value || "";

  showMessage("loginError", "");

  if (!email || !password) {
    return showMessage(
      "loginError",
      "Enter your email and password."
    );
  }

  try {

    await signInWithEmailAndPassword(auth, email, password);

    if ($("rememberEmail")?.checked) {
      localStorage.setItem("studenthub_email", email);
    } else {
      localStorage.removeItem("studenthub_email");
    }

    showToast("Login successful!");

  } catch (error) {

    console.error(error);

    showMessage(
      "loginError",
      "Login failed: " + error.message
    );
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

    currentTeacher = null;
    teacherProfile = null;
    students = [];

    showLogin();
    showToast("Logged out successfully!");

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
      "Teacher profile not found in Firestore."
    );
  }

  teacherProfile = snapshot.data();

  teacherProfile.subjects = Array.isArray(teacherProfile.subjects)
    ? teacherProfile.subjects.filter(s => SUBJECTS.includes(s))
    : [];

  if ($("welcomeName")) {
    $("welcomeName").textContent = teacherProfile.name;
  }

  if ($("sidebarName")) {
    $("sidebarName").textContent = teacherProfile.name;
  }

  if ($("sidebarEmail")) {
    $("sidebarEmail").textContent = teacherProfile.email;
  }

  if ($("settingsName")) {
    $("settingsName").textContent = teacherProfile.name;
  }

  if ($("settingsNameInput")) {
    $("settingsNameInput").value = teacherProfile.name;
  }

  if ($("settingsEmail")) {
    $("settingsEmail").textContent = teacherProfile.email;
  }

  if ($("footerEmail")) {
    $("footerEmail").textContent = teacherProfile.email;
  }

  const initials = clean(teacherProfile.name)
    .split(/\s+/)
    .map(word => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "T";

  ["sidebarInitials", "topInitials", "settingsInitials"].forEach(id => {
    if ($(id)) $(id).textContent = initials;
  });

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
// ADD / UPDATE STUDENT
// ==========================================

async function saveStudent(event) {
  event?.preventDefault();

  if (!currentTeacher || !teacherProfile) return;

  const roll = clean($("addReg")?.value);
  const name = clean($("addName")?.value);
  const email = clean($("addStudentEmail")?.value);
  const year = Number($("addYear")?.value || 1);

  const selectedSubjects = getFormSubjects(
    "addStudentForm",
    teacherProfile.subjects
  );

  showMessage("addMessage", "");

  if (!roll || !name) {
    return showMessage(
      "addMessage",
      "Registration number and name are required."
    );
  }

  if (!selectedSubjects.length) {
    return showMessage(
      "addMessage",
      "Select at least one subject."
    );
  }

  const studentId = editingStudentId || roll;

  const oldStudent = students.find(s => s.id === studentId);

  const student = {
    roll,
    name,
    email,
    year,
    subjects: selectedSubjects,
    attendance: oldStudent?.attendance || {},
    results: oldStudent?.results || {},
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

      await updateDoc(reference, student);

      editingStudentId = null;
      showToast("Student updated successfully!");

    } else {

      if (students.some(s => s.id === studentId)) {
        return showMessage(
          "addMessage",
          "This registration number already exists."
        );
      }

      await setDoc(reference, {
        ...student,
        createdAt: serverTimestamp()
      });

      showToast("Student added successfully!");
    }

    $("addStudentForm")?.reset();

    await loadStudents();
    navigateTo("students");

  } catch (error) {

    console.error(error);
    showMessage("addMessage", error.message);
  }
}

// ==========================================
// EDIT STUDENT
// ==========================================

function editStudent(id) {

  const student = students.find(s => s.id === id);
  if (!student) return;

  $("addReg").value = student.roll || "";
  $("addName").value = student.name || "";
  $("addStudentEmail").value = student.email || "";
  $("addYear").value = String(student.year || 1);

  $("addStudentForm")
    ?.querySelectorAll('input[type="checkbox"]')
    .forEach(input => {
      input.checked = (student.subjects || []).includes(input.value);
    });

  editingStudentId = id;

  navigateTo("add");
}

// ==========================================
// DELETE STUDENT
// ==========================================

async function deleteStudent(id) {

  if (!confirm("Are you sure you want to delete this student?")) {
    return;
  }

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
// ATTENDANCE
// ==========================================

async function saveAttendance(event) {
  event?.preventDefault();

  const studentId = $("attendanceStudent")?.value;
  const subject = $("attendanceSubject")?.value;

  const newHeld = Number($("classesHeld")?.value);
  const newAttended = Number($("classesAttended")?.value);

  if (!studentId || !subject) {
    return showMessage(
      "attendanceMessage",
      "Select a student and subject."
    );
  }

  if (
    !Number.isInteger(newHeld) ||
    !Number.isInteger(newAttended) ||
    newHeld < 0 ||
    newAttended < 0 ||
    newAttended > newHeld
  ) {
    return showMessage(
      "attendanceMessage",
      "Enter valid attendance numbers."
    );
  }

  const student = students.find(s => s.id === studentId);

  if (!student || !student.subjects?.includes(subject)) {
    return showMessage(
      "attendanceMessage",
      "Student is not enrolled in this subject."
    );
  }

  try {

    const previous = student.attendance?.[subject] || {
      held: 0,
      attended: 0
    };

    await updateDoc(doc(
      db,
      "teachers",
      currentTeacher.uid,
      "students",
      studentId
    ), {
      [`attendance.${subject}`]: {
        held: Number(previous.held || 0) + newHeld,
        attended: Number(previous.attended || 0) + newAttended
      }
    });

    $("attendanceForm")?.reset();

    await loadStudents();

    showMessage(
      "attendanceMessage",
      "Attendance saved successfully!",
      "success"
    );

  } catch (error) {
    showMessage("attendanceMessage", error.message);
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
    return showMessage(
      "resultMessage",
      "Select a student and semester."
    );
  }

  if (!Number.isFinite(sgpa) || sgpa < 0 || sgpa > 10) {
    return showMessage(
      "resultMessage",
      "SGPA must be between 0 and 10."
    );
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

    showMessage(
      "resultMessage",
      "Semester result saved successfully!",
      "success"
    );

  } catch (error) {
    showMessage("resultMessage", error.message);
  }
}

// ==========================================
// CALCULATIONS
// ==========================================

function getCGPA(student) {

  const values = Object.values(student.results || {})
    .map(Number)
    .filter(n => Number.isFinite(n));

  if (!values.length) return "—";

  return (
    values.reduce((a, b) => a + b, 0) / values.length
  ).toFixed(2);
}

function getYearCGPA(student, year) {

  const first = (year - 1) * 2 + 1;

  const values = [first, first + 1]
    .map(sem => student.results?.[sem])
    .filter(v => v !== undefined && v !== null)
    .map(Number);

  if (!values.length) return "—";

  return (
    values.reduce((a, b) => a + b, 0) / values.length
  ).toFixed(2);
}

function getAttendance(student, subject) {

  const data = student.attendance?.[subject];

  if (!data || !data.held) return "—";

  return (
    (Number(data.attended) / Number(data.held)) * 100
  ).toFixed(1) + "%";
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
  if (!container || !teacherProfile) return;

  container.innerHTML = teacherProfile.subjects.map(subject => `
    <button class="nav-link subject-nav-item"
      onclick="openSubject('${escapeHTML(subject)}')">
      <span class="nav-icon">▦</span>
      ${escapeHTML(subject)}
    </button>
  `).join("");

  renderSubjectPickers();
  renderDashboardSubjects();
}

function renderSubjectPickers() {

  if (!teacherProfile) return;

  ["studentSubjectPicker", "settingsSubjectPicker"].forEach(id => {

    const container = $(id);
    if (!container) return;

    const checkboxName =
      id === "studentSubjectPicker"
        ? "studentSubject"
        : "teacherSubject";

    container.innerHTML = teacherProfile.subjects.map(subject => `
      <label>
        <input type="checkbox"
          name="${checkboxName}"
          value="${escapeHTML(subject)}">
        <span>${escapeHTML(subject)}</span>
      </label>
    `).join("");
  });

  const attendanceSelect = $("attendanceSubject");

  if (attendanceSelect) {
    attendanceSelect.innerHTML = teacherProfile.subjects.map(subject => `
      <option value="${escapeHTML(subject)}">
        ${escapeHTML(subject)}
      </option>
    `).join("");
  }
}

// ==========================================
// DASHBOARD SUBJECT CARDS
// ==========================================

function renderDashboardSubjects() {

  const container = $("dashboardSubjects");
  if (!container || !teacherProfile) return;

  container.innerHTML = teacherProfile.subjects.map(subject => {

    const count = students.filter(s =>
      s.subjects?.includes(subject)
    ).length;

    return `
      <button class="subject-card"
        onclick="openSubject('${escapeHTML(subject)}')">
        <strong>${escapeHTML(subject)}</strong>
        <span>${count} students</span>
      </button>
    `;
  }).join("");
}

// ==========================================
// OPEN SUBJECT
// ==========================================

function openSubject(subject) {

  if (!teacherProfile?.subjects.includes(subject)) return;

  selectedSubject = subject;

  const filtered = students.filter(s =>
    s.subjects?.includes(subject)
  );

  $("subjectPageTitle").textContent = subject;
  $("subjectPageDescription").textContent =
    "Student records and performance for " + subject;

  $("subjectStudents").textContent = filtered.length;

  const attendanceValues = filtered
    .map(s => Number.parseFloat(getAttendance(s, subject)))
    .filter(Number.isFinite);

  $("subjectAttendance").textContent = attendanceValues.length
    ? (
        attendanceValues.reduce((a, b) => a + b, 0) /
        attendanceValues.length
      ).toFixed(1) + "%"
    : "—";

  $("subjectMarks").textContent = "—";

  const body = $("subjectTableBody");

  body.innerHTML = filtered.map(student => `
    <tr>
      <td>${escapeHTML(student.roll)}</td>
      <td>${escapeHTML(student.name)}</td>
      <td>${getAttendance(student, subject)}</td>
      <td>—</td>
      <td>
        <button class="secondary-button"
          onclick="editStudent('${escapeHTML(student.id)}')">
          Edit
        </button>
      </td>
    </tr>
  `).join("");

  $("subjectEmpty")?.classList.toggle(
    "hidden",
    filtered.length > 0
  );

  navigateTo("subject");
}

// ==========================================
// STUDENT TABLE
// ==========================================

function renderStudents() {

  const body = $("studentTableBody");
  if (!body) return;

  const search = clean($("tableSearch")?.value).toLowerCase();

  const filtered = students.filter(student =>
    student.name?.toLowerCase().includes(search) ||
    student.roll?.toLowerCase().includes(search)
  );

  body.innerHTML = filtered.map(student => `
    <tr>
      <td>${escapeHTML(student.roll)}</td>
      <td>${escapeHTML(student.name)}</td>
      <td>${getCGPA(student)}</td>
      <td>${getOverallAttendance(student)}</td>
      <td>
        <button class="secondary-button"
          onclick="editStudent('${escapeHTML(student.id)}')">
          Edit
        </button>
        <button class="secondary-button"
          onclick="deleteStudent('${escapeHTML(student.id)}')">
          Delete
        </button>
      </td>
    </tr>
  `).join("");

  $("recordCount").textContent =
    filtered.length + " records";

  $("emptyStudents")?.classList.toggle(
    "hidden",
    filtered.length > 0
  );
}

// ==========================================
// ATTENDANCE TABLE
// ==========================================

function renderAttendance() {

  const body = $("attendanceTableBody");
  if (!body) return;

  const rows = [];

  students.forEach(student => {

    (student.subjects || []).forEach(subject => {

      const data = student.attendance?.[subject] || {
        held: 0,
        attended: 0
      };

      rows.push(`
        <tr>
          <td>${escapeHTML(student.name)}</td>
          <td>${escapeHTML(subject)}</td>
          <td>${Number(data.attended || 0)}</td>
          <td>${Number(data.held || 0)}</td>
          <td>${getAttendance(student, subject)}</td>
        </tr>
      `);
    });
  });

  body.innerHTML = rows.join("");

  populateStudentSelects();
}

// ==========================================
// ACADEMIC TABLE
// ==========================================

function renderAcademic() {

  const body = $("academicTableBody");
  if (!body) return;

  const filter = $("academicFilter")?.value || "";

  const filtered = students.filter(s =>
    !filter || s.id === filter
  );

  body.innerHTML = filtered.map(student => {

    const semesterResults = Array.from(
      { length: 8 },
      (_, i) => student.results?.[i + 1] ?? "—"
    ).join(" / ");

    return `
      <tr>
        <td>${escapeHTML(student.roll)}</td>
        <td>${escapeHTML(student.name)}</td>
        <td>${semesterResults}</td>
        <td>${getYearCGPA(student, 1)}</td>
        <td>${getYearCGPA(student, 2)}</td>
        <td>${getCGPA(student)}</td>
      </tr>
    `;
  }).join("");
}

// ==========================================
// POPULATE STUDENT SELECT BOXES
// ==========================================

function populateStudentSelects() {

  ["attendanceStudent", "resultStudent"].forEach(id => {

    const select = $(id);
    if (!select) return;

    const previous = select.value;

    select.innerHTML = `
      <option value="">Select student</option>
      ${students.map(student => `
        <option value="${escapeHTML(student.id)}">
          ${escapeHTML(student.name)} (${escapeHTML(student.roll)})
        </option>
      `).join("")}
    `;

    if (students.some(s => s.id === previous)) {
      select.value = previous;
    }
  });

  const academicFilter = $("academicFilter");

  if (academicFilter) {

    const previous = academicFilter.value;

    academicFilter.innerHTML = `
      <option value="">All Students</option>
      ${students.map(student => `
        <option value="${escapeHTML(student.id)}">
          ${escapeHTML(student.name)}
        </option>
      `).join("")}
    `;

    academicFilter.value = previous;
  }
}

// ==========================================
// DASHBOARD
// ==========================================

function renderDashboard() {

  if (!teacherProfile) return;

  $("totalStudents").textContent = students.length;

  $("subjectCount").textContent =
    teacherProfile.subjects.length;

  const attendanceValues = students
    .map(s => Number.parseFloat(getOverallAttendance(s)))
    .filter(Number.isFinite);

  $("averageAttendance").textContent =
    attendanceValues.length
      ? (
          attendanceValues.reduce((a, b) => a + b, 0) /
          attendanceValues.length
        ).toFixed(1) + "%"
      : "—";

  const cgpaValues = students
    .map(s => Number.parseFloat(getCGPA(s)))
    .filter(Number.isFinite);

  $("averageSGPA").textContent =
    cgpaValues.length
      ? (
          cgpaValues.reduce((a, b) => a + b, 0) /
          cgpaValues.length
        ).toFixed(2)
      : "—";

  const recent = $("recentStudents");

  if (recent) {

    const latest = students.slice(-5).reverse();

    recent.innerHTML = latest.length
      ? latest.map(student => `
          <div class="recent-student">
            <strong>${escapeHTML(student.name)}</strong>
            <span>${escapeHTML(student.roll)}</span>
          </div>
        `).join("")
      : "<p>No students added yet.</p>";
  }

  renderDashboardSubjects();
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
// PAGE NAVIGATION
// ==========================================

const PAGE_TITLES = {
  dashboard: "Overview",
  students: "Student Directory",
  add: "Add Student",
  attendance: "Attendance",
  academic: "Academic Results",
  subject: "Subject Workspace",
  settings: "Account Settings"
};

function navigateTo(page) {

  document.querySelectorAll(".page-section").forEach(section => {
    section.classList.add("hidden");
  });

  const target = $("page-" + page);

  if (target) {
    target.classList.remove("hidden");
  }

  $("topbarTitle").textContent =
    PAGE_TITLES[page] || "StudentHub";

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  $("sidebar")?.classList.remove("sidebar-open");
}

// ==========================================
// SETTINGS
// ==========================================

async function saveSettings(event) {
  event?.preventDefault();

  const name = clean($("settingsNameInput")?.value);

  const subjects = getFormSubjects(
    "settingsForm",
    SUBJECTS
  );

  if (!name || !subjects.length) {
    return showMessage(
      "settingsMessage",
      "Enter your name and select at least one subject."
    );
  }

  try {

    await updateDoc(
      doc(db, "teachers", currentTeacher.uid),
      {
        name,
        subjects,
        updatedAt: serverTimestamp()
      }
    );

    teacherProfile.name = name;
    teacherProfile.subjects = subjects;

    await loadTeacherProfile(currentTeacher);
    await loadStudents();

    showMessage(
      "settingsMessage",
      "Settings saved successfully!",
      "success"
    );

  } catch (error) {
    showMessage("settingsMessage", error.message);
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
// AUTHENTICATION STATE
// ==========================================

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
});

// ==========================================
// THEME
// ==========================================

function toggleTheme() {

  document.body.classList.toggle("dark-mode");

  const dark = document.body.classList.contains("dark-mode");

  localStorage.setItem(
    "studenthub_theme",
    dark ? "dark" : "light"
  );

  $("themeIcon").textContent = dark ? "☀" : "☾";
  $("themeText").textContent = dark ? "Light mode" : "Dark mode";
}

function loadTheme() {

  const dark =
    localStorage.getItem("studenthub_theme") === "dark";

  document.body.classList.toggle("dark-mode", dark);

  $("themeIcon").textContent = dark ? "☀" : "☾";
  $("themeText").textContent = dark ? "Light mode" : "Dark mode";
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function bind(id, event, callback) {
  $(id)?.addEventListener(event, callback);
}

bind("loginForm", "submit", loginTeacher);
bind("registerForm", "submit", registerTeacher);
bind("addStudentForm", "submit", saveStudent);
bind("attendanceForm", "submit", saveAttendance);
bind("resultForm", "submit", saveResult);
bind("settingsForm", "submit", saveSettings);

bind("logoutButton", "click", logoutTeacher);
bind("forgotPassword", "click", resetPassword);
bind("themeToggle", "click", toggleTheme);

bind("showRegister", "click", () => {
  showView("registerView");
});

bind("showLogin", "click", () => {
  showView("loginView");
});

bind("settingsResetPassword", "click", async () => {
  const email = teacherProfile?.email;

  if (!email) return showToast("Teacher email not found.");

  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Password reset email sent!");
  } catch (error) {
    showToast(error.message);
  }
});

bind("tableSearch", "input", renderStudents);
bind("academicFilter", "change", renderAcademic);

// Page navigation buttons
document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    navigateTo(button.dataset.page);
  });
});

// Dashboard quick navigation buttons
document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    navigateTo(button.dataset.go);
  });
});

// Password visibility
document.querySelectorAll("[data-toggle]").forEach(button => {

  button.addEventListener("click", () => {

    const input = $(button.dataset.toggle);

    if (!input) return;

    const visible = input.type === "password";

    input.type = visible ? "text" : "password";
    button.textContent = visible ? "Hide" : "Show";
  });
});

// Mobile sidebar
bind("menuToggle", "click", () => {
  $("sidebar")?.classList.toggle("sidebar-open");
});

// Current date
if ($("todayLabel")) {
  $("todayLabel").textContent =
    new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
}

// Remember email
const savedEmail = localStorage.getItem("studenthub_email");

if (savedEmail && $("loginEmail")) {
  $("loginEmail").value = savedEmail;
}

// Load theme
loadTheme();

// ==========================================
// GLOBAL FUNCTIONS FOR HTML
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
