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


/* =========================================
   FIREBASE CONFIGURATION
========================================= */

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


/* =========================================
   APPLICATION STATE
========================================= */

let currentTeacher = null;
let teacherProfile = null;
let students = [];
let selectedSubject = "";
let editingStudentId = null;
let registrationInProgress = false;
let authLoadInProgress = false;

const $ = id => document.getElementById(id);

const clean = value => String(value ?? "").trim();

const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));


/* =========================================
   COMMON UI FUNCTIONS
========================================= */

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
  const el = $(id);

  if (!el) return;

  el.textContent = message;
  el.className = "message " + (message ? type : "");
}

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

function getRegistrationSubjects() {
  const form = $("registerForm");

  if (!form) return [];

  return [
    ...new Set(
      [...form.querySelectorAll('input[name="subjects"]:checked')]
        .map(input => clean(input.value).toUpperCase())
        .filter(subject => SUBJECTS.includes(subject))
    )
  ];
}

function getFormSubjects(formId, allowedSubjects = SUBJECTS) {
  const form = $(formId);

  if (!form) return [];

  return [
    ...new Set(
      [...form.querySelectorAll('input[type="checkbox"]:checked')]
        .map(input => clean(input.value).toUpperCase())
        .filter(subject => allowedSubjects.includes(subject))
    )
  ];
}

function setBusy(formId, busy, label) {
  const button = $(formId)?.querySelector('button[type="submit"]');

  if (!button) return;

  button.disabled = busy;

  if (busy) {
    button.dataset.originalText = button.innerHTML;
    button.textContent = label;
  } else if (button.dataset.originalText) {
    button.innerHTML = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}


/* =========================================
   TEACHER REGISTRATION
========================================= */

async function registerTeacher(event) {
  event?.preventDefault();

  if (registrationInProgress) return;

  const name = clean($("registerName")?.value);
  const email = clean($("registerEmail")?.value).toLowerCase();
  const password = $("registerPassword")?.value || "";

  const selectedSubjects = getRegistrationSubjects();

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

  if (!selectedSubjects.length) {
    return showMessage(
      "registerError",
      "Please select at least one subject."
    );
  }

  registrationInProgress = true;

  setBusy(
    "registerForm",
    true,
    "Creating account..."
  );

  try {

    // Create Firebase Authentication account
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = credential.user;

    // Create teacher profile in Firestore
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

    teacherProfile = {
      uid: user.uid,
      name,
      email,
      subjects: selectedSubjects
    };

    currentTeacher = user;

    localStorage.setItem(
      "studenthub_email",
      email
    );

    // Automatically open dashboard after registration
    await loadDashboardData(user);

    showToast(
      "Teacher account created successfully!"
    );

  } catch (error) {

    console.error("Registration error:", error);

    let message = error.message;

    if (error.code === "auth/email-already-in-use") {
      message = "This email is already registered. Please sign in instead.";
    }

    if (
      error.code === "permission-denied" ||
      error.code === "firestore/permission-denied"
    ) {
      message =
        "Your Firebase account was created, but Firestore did not allow saving the teacher profile. Check Firestore rules before trying again.";
    }

    showMessage("registerError", message);

    if (auth.currentUser && !teacherProfile) {
      showLogin();
    }

  } finally {

    registrationInProgress = false;

    setBusy(
      "registerForm",
      false
    );
  }
}


/* =========================================
   TEACHER LOGIN
========================================= */

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

  setBusy(
    "loginForm",
    true,
    "Signing in..."
  );

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    if ($("rememberEmail")?.checked) {
      localStorage.setItem(
        "studenthub_email",
        email
      );
    } else {
      localStorage.removeItem(
        "studenthub_email"
      );
    }

  } catch (error) {

    console.error(error);

    showMessage(
      "loginError",
      friendlyAuthError(error)
    );

  } finally {

    setBusy(
      "loginForm",
      false
    );
  }
}


function friendlyAuthError(error) {

  const map = {
    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/user-not-found":
      "No account was found for this email.",

    "auth/wrong-password":
      "Email or password is incorrect.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later.",

    "auth/network-request-failed":
      "Network error. Check your internet connection."
  };

  return map[error.code] ||
    error.message ||
    "Something went wrong.";
}


/* =========================================
   PASSWORD RESET
========================================= */

async function resetPassword() {

  const email = clean(
    $("loginEmail")?.value
  ).toLowerCase();

  if (!email) {
    return showToast(
      "Enter your email address first."
    );
  }

  try {

    await sendPasswordResetEmail(
      auth,
      email
    );

    showToast(
      "Password reset email sent!"
    );

  } catch (error) {

    showToast(
      friendlyAuthError(error)
    );
  }
}


/* =========================================
   TEACHER LOGOUT
========================================= */

async function logoutTeacher() {

  try {

    await signOut(auth);

    currentTeacher = null;
    teacherProfile = null;
    students = [];

    showLogin();

    showToast(
      "Logged out successfully!"
    );

  } catch (error) {

    showToast(error.message);
  }
}


/* =========================================
   LOAD TEACHER PROFILE
========================================= */

async function loadTeacherProfile(user) {

  const snapshot = await getDoc(
    doc(db, "teachers", user.uid)
  );

  if (!snapshot.exists()) {

    throw new Error(
      "No teacher profile was found for this account. If registration was interrupted, the Auth account exists but its Firestore profile needs to be created."
    );
  }

  const data = snapshot.data();

  teacherProfile = {
    ...data,
    uid: user.uid,

    name: clean(data.name) || "Teacher",

    email: clean(data.email) || user.email || "",

    subjects: Array.isArray(data.subjects)
      ? [...new Set(
          data.subjects.filter(s => SUBJECTS.includes(s))
        )]
      : []
  };

  if (!teacherProfile.subjects.length) {

    throw new Error(
      "No subjects are saved in this teacher profile. Please contact the project administrator."
    );
  }

  $("welcomeName").textContent =
    teacherProfile.name;

  $("sidebarName").textContent =
    teacherProfile.name;

  $("sidebarEmail").textContent =
    teacherProfile.email;

  $("settingsName").textContent =
    teacherProfile.name;

  $("settingsNameInput").value =
    teacherProfile.name;

  $("settingsEmail").textContent =
    teacherProfile.email;

  $("footerEmail").textContent =
    teacherProfile.email;

  const initials = teacherProfile.name
    .split(/\s+/)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "T";

  [
    "sidebarInitials",
    "topInitials",
    "settingsInitials"
  ].forEach(id => {

    if ($(id)) {
      $(id).textContent = initials;
    }

  });

  renderSubjectNavigation();
}


/* =========================================
   LOAD STUDENTS FROM FIRESTORE
========================================= */

async function loadStudents() {

  if (!currentTeacher) return;

  const snapshot = await getDocs(
    collection(
      db,
      "teachers",
      currentTeacher.uid,
      "students"
    )
  );

  students = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  students.sort((a, b) =>
    clean(a.name).localeCompare(clean(b.name))
  );

  renderAll();
}


/* =========================================
   LOAD DASHBOARD
========================================= */

async function loadDashboardData(user = auth.currentUser) {

  if (!user) return;

  currentTeacher = user;

  await loadTeacherProfile(user);

  await loadStudents();

  showApp();

  navigateTo("dashboard");
}


/* =========================================
   ADD / UPDATE STUDENT
========================================= */

async function saveStudent(event) {

  event?.preventDefault();

  if (!currentTeacher || !teacherProfile) return;

  const roll = clean($("addReg").value);
  const name = clean($("addName").value);
  const email = clean($("addStudentEmail").value);
  const year = Number($("addYear").value || 1);

  const subjects = getFormSubjects(
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

  if (!subjects.length) {

    return showMessage(
      "addMessage",
      "Select at least one subject."
    );
  }

  const studentId = editingStudentId || roll;

  const old = students.find(
    s => s.id === studentId
  );

  const record = {
    roll,
    name,
    email,
    year,
    subjects,

    attendance: old?.attendance || {},

    results: old?.results || {},

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

      await updateDoc(
        reference,
        record
      );

      editingStudentId = null;

      showToast(
        "Student updated successfully!"
      );

    } else {

      if (students.some(s => s.id === studentId)) {

        return showMessage(
          "addMessage",
          "This registration number already exists."
        );
      }

      await setDoc(
        reference,
        {
          ...record,
          createdAt: serverTimestamp()
        }
      );

      showToast(
        "Student added successfully!"
      );
    }

    $("addStudentForm").reset();

    $("addPageTitle").textContent =
      "Add Student";

    await loadStudents();

    navigateTo("students");

  } catch (error) {

    console.error(error);

    showMessage(
      "addMessage",
      error.message
    );
  }
}


/* =========================================
   EDIT STUDENT
========================================= */

function editStudent(id) {

  const student = students.find(
    s => s.id === id
  );

  if (!student) return;

  $("addReg").value =
    student.roll || "";

  $("addName").value =
    student.name || "";

  $("addStudentEmail").value =
    student.email || "";

  $("addYear").value =
    String(student.year || 1);

  $("studentSubjectPicker")
    ?.querySelectorAll('input[type="checkbox"]')
    .forEach(input => {

      input.checked =
        (student.subjects || []).includes(
          input.value
        );

    });

  editingStudentId = id;

  $("addPageTitle").textContent =
    "Edit Student";

  navigateTo("add");
}


/* =========================================
   DELETE STUDENT
========================================= */

async function deleteStudent(id) {

  if (
    !currentTeacher ||
    !confirm(
      "Are you sure you want to delete this student? This cannot be undone."
    )
  ) {
    return;
  }

  try {

    await deleteDoc(
      doc(
        db,
        "teachers",
        currentTeacher.uid,
        "students",
        id
      )
    );

    await loadStudents();

    showToast(
      "Student deleted successfully!"
    );

  } catch (error) {

    showToast(error.message);
  }
}


/* =========================================
   ATTENDANCE MANAGEMENT
========================================= */

async function saveAttendance(event) {

  event?.preventDefault();

  const studentId =
    $("attendanceStudent").value;

  const subject =
    $("attendanceSubject").value;

  const held =
    Number($("classesHeld").value);

  const attended =
    Number($("classesAttended").value);

  if (!studentId || !subject) {

    return showMessage(
      "attendanceMessage",
      "Select a student and subject."
    );
  }

  if (
    !Number.isInteger(held) ||
    !Number.isInteger(attended) ||
    held <= 0 ||
    attended < 0 ||
    attended > held
  ) {

    return showMessage(
      "attendanceMessage",
      "Enter valid numbers. Classes held must be at least 1 and attended cannot exceed held."
    );
  }

  const student = students.find(
    s => s.id === studentId
  );

  if (
    !student ||
    !student.subjects?.includes(subject)
  ) {

    return showMessage(
      "attendanceMessage",
      "Student is not enrolled in this subject."
    );
  }

  try {

    const previous =
      student.attendance?.[subject] || {
        held: 0,
        attended: 0
      };

    await updateDoc(
      doc(
        db,
        "teachers",
        currentTeacher.uid,
        "students",
        studentId
      ),
      {
        [`attendance.${subject}`]: {
          held:
            Number(previous.held || 0) + held,

          attended:
            Number(previous.attended || 0) + attended
        }
      }
    );

    $("attendanceForm").reset();

    await loadStudents();

    showMessage(
      "attendanceMessage",
      "Attendance saved successfully!",
      "success"
    );

  } catch (error) {

    showMessage(
      "attendanceMessage",
      error.message
    );
  }
}


/* =========================================
   ACADEMIC RESULTS
========================================= */

async function saveResult(event) {

  event?.preventDefault();

  const studentId =
    $("resultStudent").value;

  const semester =
    $("resultSemester").value;

  const raw =
    $("resultSGPA").value;

  const sgpa = Number(raw);

  if (!studentId) {

    return showMessage(
      "resultMessage",
      "Select a student."
    );
  }

  if (
    raw === "" ||
    !Number.isFinite(sgpa) ||
    sgpa < 0 ||
    sgpa > 10
  ) {

    return showMessage(
      "resultMessage",
      "SGPA must be between 0 and 10."
    );
  }

  try {

    await updateDoc(
      doc(
        db,
        "teachers",
        currentTeacher.uid,
        "students",
        studentId
      ),
      {
        [`results.${semester}`]: sgpa
      }
    );

    $("resultSGPA").value = "";

    await loadStudents();

    showMessage(
      "resultMessage",
      "Semester result saved successfully!",
      "success"
    );

  } catch (error) {

    showMessage(
      "resultMessage",
      error.message
    );
  }
}


/* =========================================
   CGPA CALCULATIONS
========================================= */

function getCGPA(student) {

  const values = Object.values(
    student.results || {}
  )
    .map(Number)
    .filter(n =>
      Number.isFinite(n) &&
      n >= 0 &&
      n <= 10
    );

  return values.length
    ? (
        values.reduce((a, b) => a + b, 0) /
        values.length
      ).toFixed(2)
    : "—";
}


function getYearCGPA(student, year) {

  const first = (year - 1) * 2 + 1;

  const values = [
    first,
    first + 1
  ]
    .map(sem => student.results?.[sem])
    .filter(v =>
      v !== undefined &&
      v !== null &&
      v !== ""
    )
    .map(Number)
    .filter(Number.isFinite);

  return values.length
    ? (
        values.reduce((a, b) => a + b, 0) /
        values.length
      ).toFixed(2)
    : "—";
}


/* =========================================
   ATTENDANCE CALCULATIONS
========================================= */

function getAttendance(student, subject) {

  const data =
    student.attendance?.[subject];

  if (!data || !Number(data.held)) {
    return "—";
  }

  return (
    (
      Number(data.attended || 0) /
      Number(data.held)
    ) * 100
  ).toFixed(1) + "%";
}


function getOverallAttendance(student) {

  let held = 0;
  let attended = 0;

  Object.values(
    student.attendance || {}
  ).forEach(data => {

    held += Number(data.held || 0);

    attended += Number(data.attended || 0);

  });

  return held
    ? ((attended / held) * 100).toFixed(1) + "%"
    : "—";
}


/* =========================================
   SUBJECT NAVIGATION
========================================= */

function renderSubjectNavigation() {

  const container =
    $("subjectNavigation");

  if (!container || !teacherProfile) return;

  container.innerHTML =
    teacherProfile.subjects.map(subject => `
      <button
        class="nav-link subject-nav-item"
        data-subject="${escapeHTML(subject)}"
      >
        <span class="nav-icon">▦</span>
        ${escapeHTML(subject)}
      </button>
    `).join("");

  container
    .querySelectorAll("[data-subject]")
    .forEach(button => {

      button.addEventListener("click", () => {
        openSubject(button.dataset.subject);
      });

    });

  renderSubjectPickers();

  renderDashboardSubjects();
}


/* =========================================
   SUBJECT PICKERS
========================================= */

function renderSubjectPickers() {

  if (!teacherProfile) return;

  const teacherSubjects =
    teacherProfile.subjects || [];

  const studentPicker =
    $("studentSubjectPicker");

  if (studentPicker) {

    studentPicker.innerHTML =
      teacherSubjects.map(subject => `
        <label>
          <input
            type="checkbox"
            name="studentSubject"
            value="${escapeHTML(subject)}"
          >
          <span>${escapeHTML(subject)}</span>
        </label>
      `).join("");
  }

  const settingsPicker =
    $("settingsSubjectPicker");

  if (settingsPicker) {

    settingsPicker.innerHTML =
      SUBJECTS.map(subject => `
        <label>
          <input
            type="checkbox"
            name="teacherSubject"
            value="${escapeHTML(subject)}"
            ${teacherSubjects.includes(subject) ? "checked" : ""}
          >
          <span>${escapeHTML(subject)}</span>
        </label>
      `).join("");
  }

  const attendanceSelect =
    $("attendanceSubject");

  if (attendanceSelect) {

    attendanceSelect.innerHTML =
      teacherSubjects.map(subject => `
        <option value="${escapeHTML(subject)}">
          ${escapeHTML(subject)}
        </option>
      `).join("");
  }
}


/* =========================================
   DASHBOARD SUBJECT CARDS
========================================= */

function renderDashboardSubjects() {

  const container =
    $("dashboardSubjects");

  if (!container || !teacherProfile) return;

  container.innerHTML =
    teacherProfile.subjects.map(subject => {

      const count = students.filter(
        s => s.subjects?.includes(subject)
      ).length;

      return `
        <button
          class="subject-card"
          data-subject="${escapeHTML(subject)}"
        >
          <strong>${escapeHTML(subject)}</strong>
          <small>${count} students</small>
        </button>
      `;

    }).join("");

  container
    .querySelectorAll("[data-subject]")
    .forEach(button => {

      button.addEventListener("click", () => {
        openSubject(button.dataset.subject);
      });

    });
}


/* =========================================
   OPEN SUBJECT PAGE
========================================= */

function openSubject(subject) {

  if (!teacherProfile?.subjects.includes(subject)) {
    return;
  }

  selectedSubject = subject;

  const filtered = students.filter(
    s => s.subjects?.includes(subject)
  );

  $("subjectPageTitle").textContent =
    subject;

  $("subjectPageDescription").textContent =
    "Student records and performance for " + subject;

  $("subjectStudents").textContent =
    filtered.length;

  const attendance = filtered
    .map(s =>
      Number.parseFloat(
        getAttendance(s, subject)
      )
    )
    .filter(Number.isFinite);

  $("subjectAttendance").textContent =
    attendance.length
      ? (
          attendance.reduce((a, b) => a + b, 0) /
          attendance.length
        ).toFixed(1) + "%"
      : "—";

  $("subjectMarks").textContent = "—";

  $("subjectTableBody").innerHTML =
    filtered.map(student => `
      <tr>
        <td>${escapeHTML(student.roll)}</td>
        <td>${escapeHTML(student.name)}</td>
        <td>${getAttendance(student, subject)}</td>
        <td>—</td>
        <td>
          <button
            class="table-action"
            data-edit="${escapeHTML(student.id)}"
          >
            Edit
          </button>
        </td>
      </tr>
    `).join("");

  $("subjectTableBody")
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener("click", () => {
        editStudent(button.dataset.edit);
      });

    });

  $("subjectEmpty").classList.toggle(
    "hidden",
    filtered.length > 0
  );

  navigateTo("subject");
}


/* =========================================
   STUDENT DIRECTORY
========================================= */

function renderStudents() {

  const body = $("studentTableBody");

  if (!body) return;

  const search = clean(
    $("tableSearch")?.value
  ).toLowerCase();

  const filtered = students.filter(s =>
    clean(s.name).toLowerCase().includes(search) ||
    clean(s.roll).toLowerCase().includes(search)
  );

  body.innerHTML = filtered.map(s => `
    <tr>
      <td>${escapeHTML(s.roll)}</td>
      <td><strong>${escapeHTML(s.name)}</strong></td>
      <td>${getCGPA(s)}</td>
      <td>${getOverallAttendance(s)}</td>
      <td>
        <button
          class="table-action"
          data-edit="${escapeHTML(s.id)}"
        >
          Edit
        </button>

        <button
          class="table-action delete"
          data-delete="${escapeHTML(s.id)}"
        >
          Delete
        </button>
      </td>
    </tr>
  `).join("");

  body
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener("click", () => {
        editStudent(button.dataset.edit);
      });

    });

  body
    .querySelectorAll("[data-delete]")
    .forEach(button => {

      button.addEventListener("click", () => {
        deleteStudent(button.dataset.delete);
      });

    });

  $("recordCount").textContent =
    `${filtered.length} records`;

  $("emptyStudents").classList.toggle(
    "hidden",
    filtered.length > 0
  );
}


/* =========================================
   POPULATE STUDENT DROPDOWNS
========================================= */

function populateStudentSelects() {

  ["attendanceStudent", "resultStudent"].forEach(id => {

    const select = $(id);

    const previous = select.value;

    select.innerHTML =
      `<option value="">Select student</option>` +
      students.map(s => `
        <option value="${escapeHTML(s.id)}">
          ${escapeHTML(s.name)}
          (${escapeHTML(s.roll)})
        </option>
      `).join("");

    if (students.some(s => s.id === previous)) {
      select.value = previous;
    }

  });

  const filter = $("academicFilter");

  const previous = filter.value;

  filter.innerHTML =
    `<option value="">All Students</option>` +
    students.map(s => `
      <option value="${escapeHTML(s.id)}">
        ${escapeHTML(s.name)}
      </option>
    `).join("");

  if (students.some(s => s.id === previous)) {
    filter.value = previous;
  }
}


/* =========================================
   ATTENDANCE TABLE
========================================= */

function renderAttendance() {

  $("attendanceTableBody").innerHTML =
    students.flatMap(student =>

      (student.subjects || []).map(subject => {

        const data =
          student.attendance?.[subject] || {
            held: 0,
            attended: 0
          };

        return `
          <tr>
            <td>${escapeHTML(student.name)}</td>
            <td>${escapeHTML(subject)}</td>
            <td>${Number(data.attended || 0)}</td>
            <td>${Number(data.held || 0)}</td>
            <td>${getAttendance(student, subject)}</td>
          </tr>
        `;
      })

    ).join("");

  populateStudentSelects();
}


/* =========================================
   ACADEMIC RESULTS TABLE
========================================= */

function renderAcademic() {

  const filter =
    $("academicFilter")?.value || "";

  const filtered = students.filter(s =>
    !filter || s.id === filter
  );

  $("academicTableBody").innerHTML =
    filtered.map(s => {

      const results = Array
        .from({ length: 8 }, (_, i) =>
          s.results?.[i + 1] ?? "—"
        )
        .map(v =>
          typeof v === "number"
            ? v.toFixed(2)
            : v
        )
        .join(" / ");

      return `
        <tr>
          <td>${escapeHTML(s.roll)}</td>
          <td>${escapeHTML(s.name)}</td>
          <td>${results}</td>
          <td>${getYearCGPA(s, 1)}</td>
          <td>${getYearCGPA(s, 2)}</td>
          <td>${getCGPA(s)}</td>
        </tr>
      `;

    }).join("");
}


/* =========================================
   DASHBOARD STATISTICS
========================================= */

function renderDashboard() {

  if (!teacherProfile) return;

  $("totalStudents").textContent =
    students.length;

  $("subjectCount").textContent =
    teacherProfile.subjects.length;

  const attendance = students
    .map(s =>
      Number.parseFloat(getOverallAttendance(s))
    )
    .filter(Number.isFinite);

  $("averageAttendance").textContent =
    attendance.length
      ? (
          attendance.reduce((a, b) => a + b, 0) /
          attendance.length
        ).toFixed(1) + "%"
      : "—";

  const cgpa = students
    .map(s =>
      Number.parseFloat(getCGPA(s))
    )
    .filter(Number.isFinite);

  $("averageSGPA").textContent =
    cgpa.length
      ? (
          cgpa.reduce((a, b) => a + b, 0) /
          cgpa.length
        ).toFixed(2)
      : "—";

  $("recentStudents").innerHTML =
    students.slice(-5).reverse().map(s => `
      <div class="recent-item">
        <div class="student-initial">
          ${escapeHTML(
            clean(s.name).charAt(0).toUpperCase()
          )}
        </div>

        <div>
          <strong>${escapeHTML(s.name)}</strong>
          <small>${escapeHTML(s.roll)}</small>
        </div>
      </div>
    `).join("") ||
    "<p>No students added yet.</p>";

  renderDashboardSubjects();
}


/* =========================================
   REFRESH ALL DASHBOARD SECTIONS
========================================= */

function renderAll() {

  renderStudents();

  renderAttendance();

  renderAcademic();

  renderDashboard();
}


/* =========================================
   PAGE NAVIGATION
========================================= */

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

  document
    .querySelectorAll(".page-section")
    .forEach(section => {
      section.classList.add("hidden");
    });

  $("page-" + page)?.classList.remove("hidden");

  $("topbarTitle").textContent =
    PAGE_TITLES[page] || "StudentHub";

  document
    .querySelectorAll("[data-page]")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    });

  $("sidebar")?.classList.remove("open");
}


/* =========================================
   ACCOUNT SETTINGS
========================================= */

async function saveSettings(event) {

  event?.preventDefault();

  const name = clean(
    $("settingsNameInput").value
  );

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

    showMessage(
      "settingsMessage",
      error.message
    );
  }
}


/* =========================================
   DARK / LIGHT THEME
========================================= */

function toggleTheme() {

  document.body.classList.toggle("dark");

  const dark =
    document.body.classList.contains("dark");

  localStorage.setItem(
    "studenthub_theme",
    dark ? "dark" : "light"
  );

  $("themeIcon").textContent =
    dark ? "☀" : "☾";

  $("themeText").textContent =
    dark ? "Light mode" : "Dark mode";
}


function loadTheme() {

  const dark =
    localStorage.getItem("studenthub_theme") === "dark";

  document.body.classList.toggle(
    "dark",
    dark
  );

  $("themeIcon").textContent =
    dark ? "☀" : "☾";

  $("themeText").textContent =
    dark ? "Light mode" : "Dark mode";
}


/* =========================================
   EVENT LISTENER HELPER
========================================= */

function bind(id, event, handler) {

  $(id)?.addEventListener(
    event,
    handler
  );
}


/* =========================================
   FORM EVENT LISTENERS
========================================= */

bind("loginForm", "submit", loginTeacher);

bind("registerForm", "submit", registerTeacher);

bind("addStudentForm", "submit", saveStudent);

bind("attendanceForm", "submit", saveAttendance);

bind("resultForm", "submit", saveResult);

bind("settingsForm", "submit", saveSettings);

bind("logoutButton", "click", logoutTeacher);

bind("forgotPassword", "click", resetPassword);

bind("themeToggle", "click", toggleTheme);


/* =========================================
   LOGIN / REGISTER SWITCHING
========================================= */

bind("showRegister", "click", () => {

  showMessage("registerError", "");

  showView("registerView");

});


bind("showLogin", "click", () => {

  showView("loginView");

});


/* =========================================
   SETTINGS PASSWORD RESET
========================================= */

bind("settingsResetPassword", "click", async () => {

  const email = teacherProfile?.email;

  if (!email) {

    return showToast(
      "Teacher email not found."
    );
  }

  try {

    await sendPasswordResetEmail(
      auth,
      email
    );

    showToast(
      "Password reset email sent!"
    );

  } catch (error) {

    showToast(error.message);
  }

});


/* =========================================
   SEARCH AND FILTER
========================================= */

bind("tableSearch", "input", renderStudents);

bind("academicFilter", "change", renderAcademic);


/* =========================================
   MOBILE SIDEBAR
========================================= */

bind("menuToggle", "click", () => {

  $("sidebar")?.classList.toggle("open");

});


/* =========================================
   CLEAR STUDENT FORM
========================================= */

bind("clearStudentButton", "click", () => {

  editingStudentId = null;

  $("addPageTitle").textContent =
    "Add Student";

});


/* =========================================
   SIDEBAR NAVIGATION
========================================= */

document
  .querySelectorAll("[data-page]")
  .forEach(button => {

    button.addEventListener("click", () => {

      navigateTo(button.dataset.page);

    });

  });


/* =========================================
   DASHBOARD QUICK NAVIGATION
========================================= */

document
  .querySelectorAll("[data-go]")
  .forEach(button => {

    button.addEventListener("click", () => {

      navigateTo(button.dataset.go);

    });

  });


/* =========================================
   PASSWORD SHOW / HIDE
========================================= */

document
  .querySelectorAll("[data-toggle]")
  .forEach(button => {

    button.addEventListener("click", () => {

      const input = $(button.dataset.toggle);

      if (!input) return;

      const visible =
        input.type === "password";

      input.type =
        visible ? "text" : "password";

      button.textContent =
        visible ? "Hide" : "Show";

    });

  });


/* =========================================
   INITIAL PAGE SETUP
========================================= */

$("todayLabel").textContent =
  new Date().toLocaleDateString(
    "en-IN",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  );


const savedEmail =
  localStorage.getItem("studenthub_email");

if (savedEmail) {

  $("loginEmail").value = savedEmail;

}

loadTheme();


/* =========================================
   FIREBASE AUTHENTICATION LISTENER
========================================= */

onAuthStateChanged(auth, async user => {

  if (
    registrationInProgress ||
    authLoadInProgress
  ) {
    return;
  }

  if (!user) {

    currentTeacher = null;

    teacherProfile = null;

    students = [];

    showLogin();

    return;
  }

  authLoadInProgress = true;

  currentTeacher = user;

  try {

    await loadDashboardData(user);

  } catch (error) {

    console.error(
      "Authentication/profile load:",
      error
    );

    showLogin();

    showMessage(
      "loginError",
      error.message
    );

  } finally {

    authLoadInProgress = false;

  }

});


/* =========================================
   EXPOSE FUNCTIONS FOR DEBUGGING
========================================= */

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
