import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* Firebase configuration — existing StudentHub project */
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

const SUBJECTS = ["DS", "DBMS", "MFCS", "FOIS", "CN", "OOPS"];

const SUBJECT_INFO = {
  DS: "Data Structures",
  DBMS: "Database Management Systems",
  MFCS: "Mathematical Foundations of Computer Science",
  FOIS: "Fundamentals of Information Security",
  CN: "Computer Networks",
  OOPS: "Object Oriented Programming"
};

let currentUser = null;
let currentProfile = {};
let students = [];
let selectedSubject = "";
let toastTimer = null;
let currentTheme = localStorage.getItem("studenthub-theme") || "light";

/* DOM helpers */
const $ = (id) => document.getElementById(id);

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function setMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
}

function setLoading(button, loading, label) {
  button.disabled = loading;
  button.textContent = loading ? "Please wait..." : label;
}

function initials(name = "User") {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
}

function getTeacherRef() {
  return doc(db, "teachers", currentUser.uid);
}

function getStudentsRef() {
  return collection(db, "teachers", currentUser.uid, "students");
}

function getStudentRef(studentId) {
  return doc(db, "teachers", currentUser.uid, "students", studentId);
}

function getAssignedSubjects() {
  const subjects = currentProfile.subjects;
  return Array.isArray(subjects) && subjects.length
    ? subjects.filter(subject => SUBJECTS.includes(subject))
    : [...SUBJECTS];
}

function selectedCheckboxValues(container) {
  return [...container.querySelectorAll('input[type="checkbox"]:checked')]
    .map(input => input.value);
}

function subjectCheckboxMarkup(selected = SUBJECTS) {
  return SUBJECTS.map(subject => `
    <label>
      <input type="checkbox" value="${subject}" ${selected.includes(subject) ? "checked" : ""}>
      <span>${subject}</span>
    </label>
  `).join("");
}

/* Theme */
function applyTheme(theme) {
  currentTheme = theme;
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem("studenthub-theme", theme);

  const icon = theme === "dark" ? "☀" : "☾";
  $("themeToggle").textContent = icon;
  $("authThemeToggle").textContent = icon;

  document.querySelectorAll("[data-theme-choice]").forEach(button => {
    button.classList.toggle("selected", button.dataset.themeChoice === theme);
  });
}

applyTheme(currentTheme);

$("themeToggle").addEventListener("click", () => {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

$("authThemeToggle").addEventListener("click", () => {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

document.querySelectorAll("[data-theme-choice]").forEach(button => {
  button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
});

/* Authentication tabs */
let authMode = "login";

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";

  $("loginTab").classList.toggle("active", !registering);
  $("registerTab").classList.toggle("active", registering);
  $("registerFields").classList.toggle("hidden", !registering);

  $("authTitle").textContent = registering ? "Create your account" : "Welcome back";
  $("authSubtitle").textContent = registering
    ? "Set up your academic workspace."
    : "Sign in to continue to your workspace.";

  $("authSubmit").innerHTML = registering
    ? 'Create account <span>→</span>'
    : 'Sign in <span>→</span>';

  $("registerName").required = registering;
  $("authPassword").autocomplete = registering ? "new-password" : "current-password";
  $("authMessage").textContent = "";
}

$("loginTab").addEventListener("click", () => setAuthMode("login"));
$("registerTab").addEventListener("click", () => setAuthMode("register"));

$("togglePassword").addEventListener("click", () => {
  const input = $("authPassword");
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  $("togglePassword").textContent = showing ? "Show" : "Hide";
});

function readableAuthError(error) {
  const code = error?.code || "";

  const messages = {
    "auth/email-already-in-use": "An account with this email already exists. Please sign in.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/user-not-found": "No account was found with this email address.",
    "auth/wrong-password": "The password is incorrect. Please try again.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network connection failed. Check your internet connection.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase Authentication."
  };

  return messages[code] || error?.message || "Something went wrong. Please try again.";
}

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("authSubmit");
  const message = $("authMessage");
  const email = $("authEmail").value.trim().toLowerCase();
  const password = $("authPassword").value;

  setMessage(message, "");

  if (!email || !password) {
    setMessage(message, "Enter your email address and password.");
    return;
  }

  if (password.length < 6) {
    setMessage(message, "Password must contain at least 6 characters.");
    return;
  }

  if (authMode === "register") {
    const name = $("registerName").value.trim();
    const subjects = selectedCheckboxValues($("registerSubjects"));

    if (!name) {
      setMessage(message, "Enter your full name.");
      return;
    }

    if (!subjects.length) {
      setMessage(message, "Select at least one subject.");
      return;
    }

    setLoading(button, true, "Create account");

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });

      await setDoc(doc(db, "teachers", credential.user.uid), {
        uid: credential.user.uid,
        name,
        email,
        subjects,
        createdAt: serverTimestamp()
      });

      currentProfile = { name, email, subjects };
      showToast("Your account has been created.");
    } catch (error) {
      console.error("Registration error:", error);
      setMessage(message, readableAuthError(error));
      setLoading(button, false, "Create account");
    }
  } else {
    setLoading(button, true, "Sign in");

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Login error:", error);
      setMessage(message, readableAuthError(error));
      setLoading(button, false, "Sign in");
    }
  }
});

/* Authentication state */
onAuthStateChanged(auth, async user => {
  if (!user) {
    currentUser = null;
    currentProfile = {};
    students = [];
    $("authScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
    $("authSubmit").disabled = false;
    $("authSubmit").innerHTML = authMode === "register"
      ? 'Create account <span>→</span>'
      : 'Sign in <span>→</span>';
    return;
  }

  currentUser = user;

  try {
    await loadProfile();
    await loadStudents();

    $("authScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");

    renderProfile();
    renderAll();
    setPage("overview");
  } catch (error) {
    console.error("Workspace loading error:", error);
    $("authScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
    setMessage($("authMessage"), readableDatabaseError(error));
  }
});

function readableDatabaseError(error) {
  if (error?.code === "permission-denied") {
    return "Database access is restricted. Please check your Firebase Firestore security rules.";
  }
  if (error?.code === "unavailable") {
    return "The database is temporarily unavailable. Please try again.";
  }
  return error?.message || "Unable to load your workspace.";
}

async function loadProfile() {
  const snapshot = await getDoc(getTeacherRef());

  if (snapshot.exists()) {
    currentProfile = snapshot.data();
  } else {
    currentProfile = {
      uid: currentUser.uid,
      name: currentUser.displayName || "Account",
      email: currentUser.email,
      subjects: [...SUBJECTS]
    };

    await setDoc(getTeacherRef(), {
      ...currentProfile,
      createdAt: serverTimestamp()
    }, { merge: true });
  }
}

async function loadStudents() {
  const snapshot = await getDocs(getStudentsRef());
  students = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  students.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
}

/* Profile and header */
function renderProfile() {
  const name = currentProfile.name || currentUser.displayName || "Account";
  const email = currentUser.email || currentProfile.email || "";

  $("sidebarName").textContent = name;
  $("sidebarEmail").textContent = email;
  $("sidebarAvatar").textContent = initials(name);
  $("topAvatar").textContent = initials(name);
  $("welcomeName").textContent = name.split(" ")[0];
  $("settingsName").value = name;
  $("settingsEmail").value = email;

  $("todayLabel").textContent = new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date());

  renderSettingsSubjects();
}

/* Navigation */
const pageTitles = {
  overview: "Overview",
  students: "Students",
  attendance: "Attendance",
  results: "Academic results",
  subjects: "Subjects",
  settings: "Settings"
};

function setPage(page) {
  if (!pageTitles[page]) return;

  document.querySelectorAll(".page").forEach(section => {
    section.classList.toggle("active", section.id === `page-${page}`);
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  $("topbarTitle").textContent = pageTitles[page];
  $("breadcrumbPage").textContent = pageTitles[page];

  closeSidebar();
}

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => setPage(button.dataset.page));
});

$("menuButton").addEventListener("click", () => {
  $("sidebar").classList.add("open");
  $("sidebarOverlay").classList.add("show");
});

$("closeSidebar").addEventListener("click", closeSidebar);
$("sidebarOverlay").addEventListener("click", closeSidebar);

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("sidebarOverlay").classList.remove("show");
}

$("signOutButton").addEventListener("click", async () => {
  try {
    await signOut(auth);
    showToast("You have signed out.");
  } catch (error) {
    showToast(readableAuthError(error));
  }
});

/* Main rendering */
function renderAll() {
  renderDashboard();
  renderStudents();
  populateStudentSelectors();
  renderSubjectCards();
  renderSettingsSubjects();
}

function attendancePercentage(attendance = {}) {
  let held = 0;
  let attended = 0;

  Object.values(attendance).forEach(value => {
    if (value && typeof value === "object") {
      held += Number(value.held) || 0;
      attended += Number(value.attended) || 0;
    }
  });

  return held > 0 ? (attended / held) * 100 : null;
}

function studentAverageCgpa(results = {}) {
  const values = Object.values(results)
    .map(value => typeof value === "object" ? Number(value.sgpa) : Number(value))
    .filter(value => Number.isFinite(value) && value > 0 && value <= 10);

  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function renderDashboard() {
  const subjects = getAssignedSubjects();
  const attendanceValues = students
    .map(student => attendancePercentage(student.attendance || {}))
    .filter(value => value !== null);

  const cgpaValues = students
    .map(student => studentAverageCgpa(student.results || {}))
    .filter(value => value !== null);

  $("statStudents").textContent = students.length;
  $("statSubjects").textContent = subjects.length;
  $("statAttendance").textContent = attendanceValues.length
    ? `${(attendanceValues.reduce((a, b) => a + b, 0) / attendanceValues.length).toFixed(1)}%`
    : "—";
  $("statCgpa").textContent = cgpaValues.length
    ? (cgpaValues.reduce((a, b) => a + b, 0) / cgpaValues.length).toFixed(2)
    : "—";

  const recent = students.slice(0, 5);

  $("recentStudents").innerHTML = recent.length
    ? recent.map(student => `
      <div class="recent-item">
        <div class="student-mini-avatar">${escapeHTML(initials(student.name))}</div>
        <div class="recent-item-info">
          <strong>${escapeHTML(student.name || "Unnamed student")}</strong>
          <small>${escapeHTML(student.rollNo || student.roll || "No roll number")}</small>
        </div>
        <span>${escapeHTML(student.department || "CSE")}</span>
      </div>
    `).join("")
    : `<div class="empty-state compact-empty">No student records have been added yet.</div>`;

  $("overviewSubjects").innerHTML = subjects.map(subject => `
    <button class="overview-subject" data-subject-open="${subject}">
      <span class="subject-letter">${subject.slice(0, 2)}</span>
      <strong>${subject}</strong>
    </button>
  `).join("");

  document.querySelectorAll("[data-subject-open]").forEach(button => {
    button.addEventListener("click", () => openSubject(button.dataset.subjectOpen));
  });
}

/* Student records */
function renderStudents(search = "") {
  const query = search.trim().toLowerCase();

  const filtered = students.filter(student => {
    const searchable = [
      student.name,
      student.rollNo,
      student.roll,
      student.email,
      student.department
    ].join(" ").toLowerCase();

    return searchable.includes(query);
  });

  $("studentCount").textContent = `${filtered.length} record${filtered.length === 1 ? "" : "s"}`;
  $("studentsEmpty").classList.toggle("hidden", filtered.length !== 0);

  $("studentsTableBody").innerHTML = filtered.map(student => {
    const roll = student.rollNo || student.roll || "—";
    const subjects = Array.isArray(student.subjects) ? student.subjects : [];

    return `
      <tr>
        <td>
          <div class="student-cell">
            <span class="table-avatar">${escapeHTML(initials(student.name))}</span>
            <span><strong>${escapeHTML(student.name || "Unnamed")}</strong>
            <small>${escapeHTML(student.email || "No email")}</small></span>
          </div>
        </td>
        <td>${escapeHTML(roll)}</td>
        <td>${escapeHTML(student.department || "—")}</td>
        <td>${escapeHTML(student.year ? `${student.year}${student.year == 1 ? "st" : student.year == 2 ? "nd" : student.year == 3 ? "rd" : "th"} Year` : "—")} ${escapeHTML(student.section || "")}</td>
        <td>${escapeHTML(subjects.join(", ") || "—")}</td>
        <td>
          <div class="table-actions">
            <button class="table-action" data-edit-student="${student.id}">Edit</button>
            <button class="table-action delete" data-delete-student="${student.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll("[data-edit-student]").forEach(button => {
    button.addEventListener("click", () => openStudentModal(button.dataset.editStudent));
  });

  document.querySelectorAll("[data-delete-student]").forEach(button => {
    button.addEventListener("click", () => removeStudent(button.dataset.deleteStudent));
  });
}

$("studentSearch").addEventListener("input", event => renderStudents(event.target.value));

/* Student modal */
function openStudentModal(studentId = "") {
  const student = studentId ? students.find(item => item.id === studentId) : null;

  $("studentForm").reset();
  $("editingStudentId").value = student?.id || "";
  $("modalTitle").textContent = student ? "Edit student" : "Add student";
  $("saveStudentButton").textContent = student ? "Save changes" : "Save student";
  $("studentName").value = student?.name || "";
  $("studentRoll").value = student?.rollNo || student?.roll || "";
  $("studentEmail").value = student?.email || "";
  $("studentPhone").value = student?.phone || "";
  $("studentDepartment").value = student?.department || "CSE";
  $("studentYear").value = String(student?.year || "1");
  $("studentSection").value = student?.section || "";

  const selected = student?.subjects || getAssignedSubjects();
  $("studentSubjects").innerHTML = subjectCheckboxMarkup(selected);
  $("studentFormMessage").textContent = "";
  $("modalBackdrop").classList.remove("hidden");
}

function closeStudentModal() {
  $("modalBackdrop").classList.add("hidden");
}

document.querySelectorAll('[data-action="add-student"]').forEach(button => {
  button.addEventListener("click", () => openStudentModal());
});

$("closeModal").addEventListener("click", closeStudentModal);
$("cancelStudent").addEventListener("click", closeStudentModal);

$("modalBackdrop").addEventListener("click", event => {
  if (event.target === $("modalBackdrop")) closeStudentModal();
});

$("studentForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("saveStudentButton");
  const message = $("studentFormMessage");
  const studentId = $("editingStudentId").value;
  const name = $("studentName").value.trim();
  const rollNo = $("studentRoll").value.trim();
  const subjects = selectedCheckboxValues($("studentSubjects"));

  if (!name || !rollNo) {
    setMessage(message, "Student name and roll number are required.");
    return;
  }

  if (!subjects.length) {
    setMessage(message, "Select at least one subject.");
    return;
  }

  const duplicate = students.find(student =>
    (student.rollNo || student.roll || "").toLowerCase() === rollNo.toLowerCase()
    && student.id !== studentId
  );

  if (duplicate) {
    setMessage(message, "A student with this roll number already exists.");
    return;
  }

  const existing = students.find(student => student.id === studentId);

  const studentData = {
    name,
    roll: rollNo,
    rollNo,
    email: $("studentEmail").value.trim(),
    phone: $("studentPhone").value.trim(),
    department: $("studentDepartment").value.trim() || "CSE",
    year: Number($("studentYear").value),
    section: $("studentSection").value.trim(),
    subjects,
    attendance: existing?.attendance || {},
    results: existing?.results || {},
    updatedAt: serverTimestamp()
  };

  button.disabled = true;
  button.textContent = "Saving...";

  try {
    if (studentId) {
      await updateDoc(getStudentRef(studentId), studentData);
      showToast("Student record updated.");
    } else {
      await addDoc(getStudentsRef(), {
        ...studentData,
        createdAt: serverTimestamp()
      });
      showToast("Student added successfully.");
    }

    await loadStudents();
    renderAll();
    closeStudentModal();
  } catch (error) {
    console.error("Student save error:", error);
    setMessage(message, readableDatabaseError(error));
  } finally {
    button.disabled = false;
    button.textContent = studentId ? "Save changes" : "Save student";
  }
});

async function removeStudent(studentId) {
  const student = students.find(item => item.id === studentId);
  if (!student) return;

  const confirmed = window.confirm(`Delete the student record for ${student.name}? This action cannot be undone.`);
  if (!confirmed) return;

  try {
    await deleteDoc(getStudentRef(studentId));
    await loadStudents();
    renderAll();
    showToast("Student record deleted.");
  } catch (error) {
    console.error("Student delete error:", error);
    showToast(readableDatabaseError(error));
  }
}

/* Student selectors */
function populateStudentSelectors() {
  const options = students.map(student => `
    <option value="${student.id}">${escapeHTML(student.name)} — ${escapeHTML(student.rollNo || student.roll || "")}</option>
  `).join("");

  $("attendanceStudent").innerHTML = `<option value="">Select student</option>${options}`;
  $("resultsStudent").innerHTML = `<option value="">Select student</option>${options}`;

  const subjects = getAssignedSubjects();
  $("attendanceSubject").innerHTML = subjects.map(subject =>
    `<option value="${subject}">${subject} — ${escapeHTML(SUBJECT_INFO[subject])}</option>`
  ).join("");

  if (!subjects.length) {
    $("attendanceSubject").innerHTML = `<option value="">No subjects assigned</option>`;
  }
}

/* Attendance */
$("attendanceStudent").addEventListener("change", renderAttendanceWorkspace);
$("attendanceSubject").addEventListener("change", renderAttendanceWorkspace);

function renderAttendanceWorkspace() {
  const student = students.find(item => item.id === $("attendanceStudent").value);
  const subject = $("attendanceSubject").value;

  if (!student || !subject) {
    $("attendanceWorkspace").innerHTML = "Select a student and subject to manage attendance.";
    $("attendanceWorkspace").className = "workspace-placeholder";
    return;
  }

  const record = student.attendance?.[subject] || {};
  const held = Number(record.held) || 0;
  const attended = Number(record.attended) || 0;
  const percentage = held > 0 ? (attended / held) * 100 : 0;

  $("attendanceWorkspace").className = "workspace-content";
  $("attendanceWorkspace").innerHTML = `
    <div class="workspace-title">
      <div><strong>${escapeHTML(student.name)}</strong><br><span>${escapeHTML(subject)} · ${escapeHTML(SUBJECT_INFO[subject])}</span></div>
      <span>${escapeHTML(student.rollNo || student.roll || "")}</span>
    </div>
    <div class="attendance-metrics">
      <div class="metric-box"><span>Classes held</span><strong>${held}</strong></div>
      <div class="metric-box"><span>Classes attended</span><strong>${attended}</strong></div>
      <div class="metric-box"><span>Attendance</span><strong>${held ? percentage.toFixed(1) + "%" : "—"}</strong></div>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${Math.min(percentage, 100)}%"></div></div>
    <form id="attendanceForm" class="attendance-form">
      <div class="form-field"><label for="classesHeld">Total classes held</label><input id="classesHeld" type="number" min="0" max="10000" value="${held}" required></div>
      <div class="form-field"><label for="classesAttended">Classes attended</label><input id="classesAttended" type="number" min="0" max="10000" value="${attended}" required></div>
      <button class="primary-button" type="submit">Save attendance</button>
    </form>
    <p id="attendanceMessage" class="form-message"></p>
  `;

  $("attendanceForm").addEventListener("submit", async event => {
    event.preventDefault();

    const newHeld = Number($("classesHeld").value);
    const newAttended = Number($("classesAttended").value);

    if (!Number.isInteger(newHeld) || !Number.isInteger(newAttended) ||
        newHeld < 0 || newAttended < 0 || newAttended > newHeld) {
      setMessage($("attendanceMessage"), "Enter valid class counts. Attended classes cannot exceed classes held.");
      return;
    }

    try {
      const updatedAttendance = {
        ...(student.attendance || {}),
        [subject]: { held: newHeld, attended: newAttended }
      };

      await updateDoc(getStudentRef(student.id), {
        attendance: updatedAttendance,
        updatedAt: serverTimestamp()
      });

      await loadStudents();
      renderDashboard();
      renderAttendanceWorkspace();
      showToast("Attendance saved successfully.");
    } catch (error) {
      console.error("Attendance save error:", error);
      setMessage($("attendanceMessage"), readableDatabaseError(error));
    }
  });
}

/* Academic results */
$("resultsStudent").addEventListener("change", renderResultsWorkspace);

function renderResultsWorkspace() {
  const student = students.find(item => item.id === $("resultsStudent").value);

  if (!student) {
    $("resultsWorkspace").innerHTML = "Select a student to view and update academic results.";
    $("resultsWorkspace").className = "workspace-placeholder";
    return;
  }

  const results = student.results || {};
  const entries = Object.entries(results).sort((a, b) => a[0].localeCompare(b[0]));
  const cgpa = studentAverageCgpa(results);

  $("resultsWorkspace").className = "workspace-content";
  $("resultsWorkspace").innerHTML = `
    <div class="workspace-title">
      <div><strong>${escapeHTML(student.name)}</strong><br><span>${escapeHTML(student.rollNo || student.roll || "")}</span></div>
      <div><span>Overall CGPA</span><br><strong>${cgpa === null ? "—" : cgpa.toFixed(2)}</strong></div>
    </div>
    <form id="resultForm" class="attendance-form">
      <div class="form-field">
        <label for="resultSemester">Semester</label>
        <select id="resultSemester">
          ${Array.from({ length: 8 }, (_, index) => `<option value="Semester ${index + 1}">Semester ${index + 1}</option>`).join("")}
        </select>
      </div>
      <div class="form-field">
        <label for="resultSgpa">SGPA (0–10)</label>
        <input id="resultSgpa" type="number" min="0" max="10" step="0.01" required placeholder="e.g. 8.50">
      </div>
      <button type="submit" class="primary-button">Save result</button>
    </form>
    <p id="resultMessage" class="form-message"></p>
    <div style="margin-top:22px">
      <h3 style="font:800 13px Manrope">Semester records</h3>
      ${entries.length ? entries.map(([semester, value]) => {
        const sgpa = typeof value === "object" ? Number(value.sgpa) : Number(value);
        return `
          <div class="result-row">
            <div><strong>${escapeHTML(semester)}</strong><br><span>Semester performance</span></div>
            <div><strong>${Number.isFinite(sgpa) ? sgpa.toFixed(2) : "—"}</strong>
              <button class="table-action delete" data-delete-result="${escapeHTML(semester)}">Remove</button>
            </div>
          </div>
        `;
      }).join("") : `<div class="empty-state">No semester results have been recorded.</div>`}
    </div>
  `;

  $("resultForm").addEventListener("submit", async event => {
    event.preventDefault();

    const semester = $("resultSemester").value;
    const sgpa = Number($("resultSgpa").value);

    if (!Number.isFinite(sgpa) || sgpa < 0 || sgpa > 10) {
      setMessage($("resultMessage"), "Enter an SGPA between 0 and 10.");
      return;
    }

    try {
      const updatedResults = {
        ...(student.results || {}),
        [semester]: { sgpa }
      };

      await updateDoc(getStudentRef(student.id), {
        results: updatedResults,
        updatedAt: serverTimestamp()
      });

      await loadStudents();
      renderDashboard();
      renderResultsWorkspace();
      showToast("Academic result saved.");
    } catch (error) {
      console.error("Result save error:", error);
      setMessage($("resultMessage"), readableDatabaseError(error));
    }
  });

  document.querySelectorAll("[data-delete-result]").forEach(button => {
    button.addEventListener("click", async () => {
      const semester = button.dataset.deleteResult;
      const updatedResults = { ...(student.results || {}) };
      delete updatedResults[semester];

      try {
        await updateDoc(getStudentRef(student.id), {
          results: updatedResults,
          updatedAt: serverTimestamp()
        });
        await loadStudents();
        renderDashboard();
        renderResultsWorkspace();
        showToast("Semester result removed.");
      } catch (error) {
        console.error("Result delete error:", error);
        showToast(readableDatabaseError(error));
      }
    });
  });
}

/* Subjects */
function renderSubjectCards() {
  const subjects = getAssignedSubjects();

  $("subjectCards").innerHTML = subjects.map(subject => {
    const count = students.filter(student =>
      Array.isArray(student.subjects) && student.subjects.includes(subject)
    ).length;

    return `
      <button class="subject-card" data-subject-card="${subject}">
        <span class="subject-letter">${subject.slice(0, 2)}</span>
        <h3>${subject}</h3>
        <p>${escapeHTML(SUBJECT_INFO[subject])}</p>
        <small>${count} student${count === 1 ? "" : "s"} · Open workspace →</small>
      </button>
    `;
  }).join("");

  document.querySelectorAll("[data-subject-card]").forEach(button => {
    button.addEventListener("click", () => openSubject(button.dataset.subjectCard));
  });
}

function openSubject(subject) {
  selectedSubject = subject;

  const subjectStudents = students.filter(student =>
    Array.isArray(student.subjects) && student.subjects.includes(subject)
  );

  $("subjectDetail").classList.remove("hidden");
  $("subjectDetail").innerHTML = `
    <div class="panel-heading">
      <div><h3>${escapeHTML(subject)} — ${escapeHTML(SUBJECT_INFO[subject])}</h3>
      <p>${subjectStudents.length} enrolled student${subjectStudents.length === 1 ? "" : "s"}</p></div>
      <button class="secondary-button" id="closeSubjectDetail">Close</button>
    </div>
    ${subjectStudents.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>STUDENT</th><th>ROLL NUMBER</th><th>ATTENDANCE</th><th>RESULTS</th></tr></thead>
        <tbody>${subjectStudents.map(student => {
          const attendance = student.attendance?.[subject] || {};
          const percentage = Number(attendance.held) > 0
            ? ((Number(attendance.attended) || 0) / Number(attendance.held) * 100).toFixed(1) + "%"
            : "—";

          return `<tr>
            <td>${escapeHTML(student.name)}</td>
            <td>${escapeHTML(student.rollNo || student.roll || "—")}</td>
            <td>${percentage}</td>
            <td>${studentAverageCgpa(student.results || {})?.toFixed(2) || "—"}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
    ` : `<div class="empty-state">No students are enrolled in this subject yet.</div>`}
  `;

  $("closeSubjectDetail").addEventListener("click", () => {
    $("subjectDetail").classList.add("hidden");
  });

  $("subjectDetail").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* Settings */
function renderSettingsSubjects() {
  const selected = getAssignedSubjects();

  $("settingsSubjects").innerHTML = SUBJECTS.map(subject => `
    <label><input type="checkbox" value="${subject}" ${selected.includes(subject) ? "checked" : ""}> ${subject}</label>
  `).join("");
}

$("saveProfileButton").addEventListener("click", async () => {
  const name = $("settingsName").value.trim();

  if (!name) {
    setMessage($("settingsMessage"), "Name cannot be empty.");
    return;
  }

  try {
    await updateDoc(getTeacherRef(), { name });
    await updateProfile(currentUser, { displayName: name });

    currentProfile.name = name;
    renderProfile();
    setMessage($("settingsMessage"), "Account information updated.", true);
    showToast("Profile updated.");
  } catch (error) {
    console.error("Profile update error:", error);
    setMessage($("settingsMessage"), readableDatabaseError(error));
  }
});

$("saveSubjectsButton").addEventListener("click", async () => {
  const subjects = selectedCheckboxValues($("settingsSubjects"));

  if (!subjects.length) {
    showToast("Select at least one subject.");
    return;
  }

  try {
    await updateDoc(getTeacherRef(), { subjects });
    currentProfile.subjects = subjects;

    renderAll();
    showToast("Subject preferences saved.");
  } catch (error) {
    console.error("Subject update error:", error);
    showToast(readableDatabaseError(error));
  }
});

/* Keep the initial login view ready */
setAuthMode("login");
