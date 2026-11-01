
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
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
  query,
  orderBy,
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

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

await setPersistence(auth, inMemoryPersistence);

/* ==========================================
   2. GLOBAL VARIABLES
========================================== */

let currentUser = null;
let teacherData = {};
let students = [];
let currentSubject = "";
let currentPage = "dashboard";
let editingStudentId = null;

const SUBJECTS = [
  "DS",
  "DBMS",
  "MFCS",
  "FOIS",
  "CN",
  "OOPS"
];

const SUBJECT_NAMES = {
  DS: "Data Structures",
  DBMS: "Database Management Systems",
  MFCS: "Mathematical Foundations of Computer Science",
  FOIS: "Fundamentals of Information Security",
  CN: "Computer Networks",
  OOPS: "Object Oriented Programming"
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const teacherDoc = () =>
  doc(db, "teachers", currentUser.uid);

const studentCollection = () =>
  collection(db, "teachers", currentUser.uid, "students");

const studentDoc = id =>
  doc(db, "teachers", currentUser.uid, "students", id);

const attendanceCollection = id =>
  collection(db, "teachers", currentUser.uid, "students", id, "attendance");

const resultCollection = id =>
  collection(db, "teachers", currentUser.uid, "students", id, "results");

/* ==========================================
   3. UTILITIES
========================================== */

function toast(message, type = "success") {
  let element = $("#toast");

  if (!element) {
    element = document.createElement("div");
    element.id = "toast";
    document.body.appendChild(element);
  }

  element.textContent = message;
  element.className = `toast ${type} show`;

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    element.classList.remove("show");
  }, 3000);
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function value(form, names) {
  for (const name of names) {
    const field = form.elements.namedItem(name);
    if (field && field.value !== undefined) {
      return field.value.trim();
    }
  }
  return "";
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function formatDate(date) {
  if (!date) return "—";
  const d = date.toDate ? date.toDate() : new Date(date);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN");
}

function selectedSubjects(form) {
  return [...form.querySelectorAll(
    'input[name="subjects"]:checked'
  )].map(input => input.value);
}

function buttonLoading(button, loading, text) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "Please wait..." : text;
}

/* ==========================================
   4. AUTHENTICATION VIEW
========================================== */

function showLogin() {
  const authPage = $("#authPage");
  const app = $("#app");

  if (authPage) authPage.style.display = "flex";
  if (app) app.style.display = "none";

  if ($("#loginView")) $("#loginView").style.display = "block";
  if ($("#registerView")) $("#registerView").style.display = "none";
}

function showRegister() {
  if ($("#loginView")) $("#loginView").style.display = "none";
  if ($("#registerView")) $("#registerView").style.display = "block";
}

function showApplication() {
  if ($("#authPage")) $("#authPage").style.display = "none";
  if ($("#app")) $("#app").style.display = "flex";

  navigate("dashboard");
}

document.addEventListener("click", event => {
  const target = event.target.closest(
    "#showRegister, #goToRegister, #showLogin, #goToLogin, [data-auth]"
  );

  if (!target) return;

  if (
    target.id === "showRegister" ||
    target.id === "goToRegister" ||
    target.dataset.auth === "register"
  ) {
    showRegister();
  }

  if (
    target.id === "showLogin" ||
    target.id === "goToLogin" ||
    target.dataset.auth === "login"
  ) {
    showLogin();
  }
});

/* ==========================================
   5. TEACHER REGISTRATION
========================================== */

async function registerTeacher(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');

  const name = value(form, ["name", "teacherName", "fullName"]);
  const email = value(form, ["email"]);
  const password = value(form, ["password"]);
  const subjects = selectedSubjects(form);

  if (!name || !email || !password) {
    return toast("Complete all required fields.", "error");
  }

  if (password.length < 8) {
    return toast("Password must contain at least 8 characters.", "error");
  }

  if (!subjects.length) {
    return toast("Select at least one subject.", "error");
  }

  buttonLoading(button, true, "Create Account");

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(credential.user, {
      displayName: name
    });

    await setDoc(doc(db, "teachers", credential.user.uid), {
      uid: credential.user.uid,
      name,
      email,
      subjects,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    currentUser = credential.user;
    teacherData = { name, email, subjects };

    toast("Registration successful!");

    showApplication();
    await loadData();

  } catch (error) {
    console.error(error);

    const messages = {
      "auth/email-already-in-use": "Email already registered. Please login.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/weak-password": "Choose a stronger password.",
      "auth/network-request-failed": "Check your internet connection."
    };

    toast(messages[error.code] || error.message, "error");

  } finally {
    buttonLoading(button, false, "Create Account");
  }
}

/* ==========================================
   6. TEACHER LOGIN
========================================== */

async function loginTeacher(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');

  const email = value(form, ["email"]);
  const password = value(form, ["password"]);

  if (!email || !password) {
    return toast("Enter email and password.", "error");
  }

  buttonLoading(button, true, "Login");

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
      throw new Error("Teacher profile not found.");
    }

    currentUser = credential.user;
    teacherData = profile.data();

    showApplication();
    await loadData();

    toast("Welcome back!");

  } catch (error) {
    console.error(error);

    const messages = {
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/user-not-found": "Account not found.",
      "auth/too-many-requests": "Too many attempts. Try again later."
    };

    toast(messages[error.code] || error.message, "error");

  } finally {
    buttonLoading(button, false, "Login");
  }
}

/* ==========================================
   7. PASSWORD RESET
========================================== */

async function resetPassword() {
  const email = $("#loginForm")?.elements.namedItem("email")?.value.trim();

  if (!email) {
    return toast("Enter your email first.", "error");
  }

  try {
    await sendPasswordResetEmail(auth, email);
    toast("Password reset email sent.");
  } catch (error) {
    toast(error.message, "error");
  }
}

/* ==========================================
   8. LOGOUT
========================================== */

async function logout() {
  try {
    await signOut(auth);

    currentUser = null;
    teacherData = {};
    students = [];

    showLogin();
    toast("Logged out successfully.");

  } catch (error) {
    toast(error.message, "error");
  }
}

$("#logoutButton")?.addEventListener("click", logout);

/* ==========================================
   9. NAVIGATION
========================================== */

function navigate(page) {
  if (!currentUser) return;

  currentPage = page;

  $$(".page").forEach(element => {
    element.style.display = "none";
    element.classList.remove("active");
  });

  const selected = $(`#page-${page}`);

  if (selected) {
    selected.style.display = "block";
    selected.classList.add("active");
  }

  $$("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  const title = $("#pageTitle");

  if (title) {
    title.textContent = {
      dashboard: "Dashboard",
      students: "Student Management",
      add: "Add Student",
      attendance: "Attendance",
      results: "Academic Results",
      subjects: "My Subjects",
      settings: "Settings"
    }[page] || page;
  }

  $("#sidebar")?.classList.remove("open");

  if (page === "dashboard") renderDashboard();
  if (page === "students") renderStudents();
  if (page === "subjects") renderSubjects();
  if (page === "attendance") populateStudentSelects();
  if (page === "results") populateStudentSelects();
  if (page === "settings") renderSettings();
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");

  if (!button) return;

  event.preventDefault();
  navigate(button.dataset.page);
});

$("#menuToggle")?.addEventListener("click", () => {
  $("#sidebar")?.classList.toggle("open");
});

/* ==========================================
   10. SUBJECT MANAGEMENT
========================================== */

function renderSubjects() {
  const container = $("#subjectContainer");

  if (!container) return;

  const subjects = teacherData.subjects || [];

  container.innerHTML = subjects.map(subject => `
    <div class="subject-card" data-subject-card="${safe(subject)}">
      <h3>${safe(SUBJECT_NAMES[subject] || subject)}</h3>
      <p>${safe(subject)}</p>
      <button data-open-subject="${safe(subject)}">
        Open Subject
      </button>
    </div>
  `).join("");
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-open-subject]");

  if (!button || !currentUser) return;

  currentSubject = button.dataset.openSubject;

  const title = $("#subjectPageTitle");

  if (title) {
    title.textContent = SUBJECT_NAMES[currentSubject] || currentSubject;
  }

  navigate("subject");
});

/* ==========================================
   11. LOAD DATABASE RECORDS
========================================== */

async function loadData() {
  if (!currentUser) return;

  try {
    const profile = await getDoc(teacherDoc());

    if (!profile.exists()) {
      await signOut(auth);
      return;
    }

    teacherData = profile.data();

    const snapshot = await getDocs(studentCollection());

    students = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    setText("teacherName", teacherData.name || "Teacher");
    setText("teacherEmail", currentUser.email);

    setText("subjectCount", (teacherData.subjects || []).length);

    renderSubjects();
    renderStudents();
    renderDashboard();
    populateStudentSelects();

  } catch (error) {
    console.error(error);
    toast("Unable to load records.", "error");
  }
}

/* ==========================================
   12. ADD STUDENT
========================================== */

async function addStudent(event) {
  event.preventDefault();

  if (!currentUser) return;

  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');

  const reg = value(form, ["addReg"]);
  const name = value(form, ["addName"]);
  const email = value(form, ["addStudentEmail"]);
  const year = value(form, ["addYear"]);

  if (!reg || !name) {
    return toast("Registration number and name are required.", "error");
  }

  buttonLoading(button, true, "Save Student");

  const student = {
    reg,
    name,
    email,
    year,
    updatedAt: serverTimestamp()
  };

  try {
    if (editingStudentId) {
      await updateDoc(studentDoc(editingStudentId), student);
      toast("Student updated successfully.");
      editingStudentId = null;
    } else {
      await addDoc(studentCollection(), {
        ...student,
        createdAt: serverTimestamp()
      });
      toast("Student added successfully.");
    }

    form.reset();

    await loadData();
    navigate("students");

  } catch (error) {
    console.error(error);
    toast(error.message, "error");

  } finally {
    buttonLoading(button, false, "Save Student");
  }
}

/* ==========================================
   13. DISPLAY STUDENTS
========================================== */

function renderStudents() {
  const tbody =
    $("#studentTableBody") ||
    $("#studentTable tbody");

  if (!tbody) return;

  if (!students.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">No students added yet.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = students.map(student => `
    <tr>
      <td>${safe(student.reg)}</td>
      <td>${safe(student.name)}</td>
      <td>${safe(student.email || "—")}</td>
      <td>${safe(student.year || "—")}</td>
      <td>${Number(student.sgpa || 0).toFixed(2)}</td>
      <td>
        <button data-edit="${student.id}">Edit</button>
        <button data-delete="${student.id}">Delete</button>
      </td>
    </tr>
  `).join("");
}

/* ==========================================
   14. EDIT STUDENT
========================================== */

function editStudent(id) {
  const student = students.find(item => item.id === id);

  if (!student) return;

  editingStudentId = id;

  const form = $("#addStudentForm");

  if (!form) return;

  form.elements.namedItem("addReg").value = student.reg || "";
  form.elements.namedItem("addName").value = student.name || "";
  form.elements.namedItem("addStudentEmail").value = student.email || "";
  form.elements.namedItem("addYear").value = student.year || "";

  navigate("add");

  const button = form.querySelector('[type="submit"]');

  if (button) button.textContent = "Update Student";
}

/* ==========================================
   15. DELETE STUDENT
========================================== */

async function deleteStudent(id) {
  const student = students.find(item => item.id === id);

  if (!student) return;

  if (!confirm(`Delete ${student.name}'s record?`)) return;

  try {
    await deleteDoc(studentDoc(id));

    students = students.filter(item => item.id !== id);

    renderStudents();
    renderDashboard();

    toast("Student deleted successfully.");

  } catch (error) {
    toast(error.message, "error");
  }
}

document.addEventListener("click", event => {
  const edit = event.target.closest("[data-edit]");
  const remove = event.target.closest("[data-delete]");

  if (edit) editStudent(edit.dataset.edit);
  if (remove) deleteStudent(remove.dataset.delete);
});

/* ==========================================
   16. STUDENT SEARCH
========================================== */

$("#studentSearch")?.addEventListener("input", event => {
  const search = event.target.value.toLowerCase();

  const filtered = students.filter(student =>
    `${student.name} ${student.reg} ${student.email || ""}`
      .toLowerCase()
      .includes(search)
  );

  const tbody =
    $("#studentTableBody") ||
    $("#studentTable tbody");

  if (!tbody) return;

  tbody.innerHTML = filtered.map(student => `
    <tr>
      <td>${safe(student.reg)}</td>
      <td>${safe(student.name)}</td>
      <td>${safe(student.email || "—")}</td>
      <td>${safe(student.year || "—")}</td>
      <td>${Number(student.sgpa || 0).toFixed(2)}</td>
      <td>
        <button data-edit="${student.id}">Edit</button>
        <button data-delete="${student.id}">Delete</button>
      </td>
    </tr>
  `).join("");
});

/* ==========================================
   17. ATTENDANCE
========================================== */

function populateStudentSelects() {
  $$("select[name='studentId'], #attendanceStudent, #resultStudent")
    .forEach(select => {
      const oldValue = select.value;

      select.innerHTML = `
        <option value="">Select Student</option>
        ${students.map(student => `
          <option value="${student.id}">
            ${safe(student.name)} (${safe(student.reg)})
          </option>
        `).join("")}
      `;

      if (oldValue) select.value = oldValue;
    });
}

async function saveAttendance(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const studentId = value(form, ["studentId"]);
  const date = value(form, ["date", "attendanceDate"]);
  const status = value(form, ["status", "attendanceStatus"]);

  if (!studentId || !date || !status) {
    return toast("Complete all attendance fields.", "error");
  }

  try {
    await addDoc(attendanceCollection(studentId), {
      date,
      status,
      createdAt: serverTimestamp()
    });

    toast("Attendance recorded successfully.");
    form.reset();

    await renderDashboard();

  } catch (error) {
    toast(error.message, "error");
  }
}

/* ==========================================
   18. SEMESTER RESULTS
========================================== */

async function saveResult(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const studentId = value(form, ["studentId"]);
  const semester = value(form, ["semester"]);
  const subject = value(form, ["subject"]);
  const marks = Number(value(form, ["marks"]));
  const maxMarks = Number(value(form, ["maxMarks"]) || 100);

  if (
    !studentId ||
    !semester ||
    !subject ||
    !Number.isFinite(marks) ||
    !Number.isFinite(maxMarks) ||
    maxMarks <= 0 ||
    marks < 0 ||
    marks > maxMarks
  ) {
    return toast("Enter valid examination details.", "error");
  }

  try {
    await addDoc(resultsCollection(studentId), {
      semester,
      subject,
      marks,
      maxMarks,
      percentage: (marks / maxMarks) * 100,
      createdAt: serverTimestamp()
    });

    toast("Result saved successfully.");
    form.reset();

    await renderDashboard();

  } catch (error) {
    toast(error.message, "error");
  }
}

/* ==========================================
   19. DASHBOARD STATISTICS
========================================== */

async function renderDashboard() {
  if (!currentUser) return;

  setText("totalStudents", students.length);
  setText("subjectCount", (teacherData.subjects || []).length);

  const sgpas = students
    .map(student => Number(student.sgpa))
    .filter(number => Number.isFinite(number) && number > 0);

  const average = sgpas.length
    ? sgpas.reduce((a, b) => a + b, 0) / sgpas.length
    : 0;

  setText("averageSGPA", average.toFixed(2));

  let present = 0;
  let total = 0;

  try {
    for (const student of students) {
      const snapshot = await getDocs(attendanceCollection(student.id));

      snapshot.forEach(record => {
        total++;

        const status = String(record.data().status).toLowerCase();

        if (status === "present" || status === "p") {
          present++;
        }
      });
    }

    const attendance = total ? (present / total) * 100 : 0;

    setText("averageAttendance", attendance.toFixed(1) + "%");

  } catch (error) {
    console.error("Attendance statistics:", error);
  }

  const recent = $("#recentStudents");

  if (recent) {
    recent.innerHTML = students.slice(-5).reverse().map(student => `
      <div class="recent-student">
        <div>
          <strong>${safe(student.name)}</strong>
          <small>${safe(student.reg)}</small>
        </div>
        <span>${Number(student.sgpa || 0).toFixed(2)} SGPA</span>
      </div>
    `).join("") || "<p>No student records yet.</p>";
  }
}

/* ==========================================
   20. SETTINGS
========================================== */

function renderSettings() {
  const form = $("#settingsForm");

  if (!form) return;

  const name = form.elements.namedItem("name");
  const email = form.elements.namedItem("email");

  if (name) name.value = teacherData.name || "";
  if (email) email.value = currentUser?.email || "";

  form.querySelectorAll('input[name="subjects"]').forEach(input => {
    input.checked = (teacherData.subjects || []).includes(input.value);
  });
}

async function saveSettings(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const name = value(form, ["name", "teacherName"]);
  const subjects = selectedSubjects(form);

  if (!name || !subjects.length) {
    return toast("Enter your name and select subjects.", "error");
  }

  try {
    await setDoc(teacherDoc(), {
      name,
      subjects,
      updatedAt: serverTimestamp()
    }, { merge: true });

    teacherData.name = name;
    teacherData.subjects = subjects;

    setText("teacherName", name);
    setText("subjectCount", subjects.length);

    renderSubjects();

    toast("Settings updated successfully.");

  } catch (error) {
    toast(error.message, "error");
  }
}

/* ==========================================
   21. THEME SWITCHING
========================================== */

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;

  const toggle = $("#themeToggle");

  if (toggle) {
    toggle.checked = theme === "dark";
  }

  setText(
    "themeLabel",
    theme === "dark" ? "Dark Mode" : "Light Mode"
  );
}

function initializeTheme() {
  const theme = localStorage.getItem("studenthub-theme") || "light";

  applyTheme(theme);

  $("#themeToggle")?.addEventListener("change", event => {
    const nextTheme = event.target.checked ? "dark" : "light";

    localStorage.setItem("studenthub-theme", nextTheme);
    applyTheme(nextTheme);
  });
}

/* ==========================================
   22. CONNECT ALL FORMS
========================================== */

function connectForms() {
  $("#loginForm")?.addEventListener("submit", loginTeacher);
  $("#registerForm")?.addEventListener("submit", registerTeacher);
  $("#addStudentForm")?.addEventListener("submit", addStudent);
  $("#attendanceForm")?.addEventListener("submit", saveAttendance);
  $("#resultForm")?.addEventListener("submit", saveResult);
  $("#settingsForm")?.addEventListener("submit", saveSettings);

  $("#forgotPassword")?.addEventListener("click", resetPassword);

  $("#addStudentBtn")?.addEventListener("click", () => {
    editingStudentId = null;
    $("#addStudentForm")?.reset();
    navigate("add");
  });

  $("#cancelStudentBtn")?.addEventListener("click", () => {
    editingStudentId = null;
    $("#addStudentForm")?.reset();
    navigate("students");
  });
}

/* ==========================================
   23. AUTHENTICATION STATE
========================================== */

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (!user) {
    teacherData = {};
    students = [];
    showLogin();
    return;
  }

  try {
    const profile = await getDoc(doc(db, "teachers", user.uid));

    if (!profile.exists()) {
      await signOut(auth);
      showLogin();
      return;
    }

    teacherData = profile.data();

    showApplication();

    await loadData();

  } catch (error) {
    console.error(error);
    toast("Unable to verify teacher account.", "error");
    showLogin();
  }
});

/* ==========================================
   24. INITIALIZATION
========================================== */

document.addEventListener("DOMContentLoaded", () => {
  connectForms();
  initializeTheme();

  showLogin();

  console.log("StudentHub Academic Portal initialized.");
});
