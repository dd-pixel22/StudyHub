
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  initializeAuth,
  inMemoryPersistence,
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
// 1. FIREBASE CONFIGURATION
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

// Login is required again after a full page reload.
const auth = initializeAuth(firebaseApp, {
  persistence: inMemoryPersistence
});

const db = getFirestore(firebaseApp);

const SUBJECTS = ["DS", "DBMS", "MFCS", "FOIS", "CN", "OOPS"];


// ==========================================
// 2. APPLICATION STATE
// ==========================================

let currentTeacher = null;
let teacherProfile = null;
let students = [];
let selectedSubject = "";
let editingStudentId = null;

let registrationInProgress = false;
let authLoadInProgress = false;


// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================

const $ = id => document.getElementById(id);

const clean = value => String(value ?? "").trim();

const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));

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
  element.className = "message " + (message ? type : "");
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

function getInitials(name) {
  return clean(name)
    .split(/\s+/)
    .map(word => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "T";
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

function getRegistrationSubjects() {
  const form = $("registerForm");

  if (!form) return [];

  return [...new Set(
    [...form.querySelectorAll('input[name="subjects"]:checked')]
      .map(input => clean(input.value).toUpperCase())
      .filter(subject => SUBJECTS.includes(subject))
  )];
}

function getFormSubjects(formId, allowedSubjects = SUBJECTS) {
  const form = $(formId);

  if (!form) return [];

  return [...new Set(
    [...form.querySelectorAll('input[type="checkbox"]:checked')]
      .map(input => clean(input.value).toUpperCase())
      .filter(subject => allowedSubjects.includes(subject))
  )];
}


// ==========================================
// 4. TEACHER REGISTRATION
// ==========================================

async function registerTeacher(event) {
  event?.preventDefault();

  if (registrationInProgress) return;

  const name = clean($("registerName")?.value);
  const email = clean($("registerEmail")?.value).toLowerCase();
  const password = $("registerPassword")?.value || "";

  const selectedSubjects = getRegistrationSubjects();

  showMessage("registerError", "");

  if (!name || !email || !password) {
    return showMessage("registerError", "Please fill in all details.");
  }

  if (password.length < 8) {
    return showMessage("registerError", "Password must contain at least 8 characters.");
  }

  if (!selectedSubjects.length) {
    return showMessage("registerError", "Please select at least one subject.");
  }

  registrationInProgress = true;

  setBusy("registerForm", true, "Creating account...");

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = credential.user;

    const profile = {
      uid: user.uid,
      name,
      email,
      subjects: selectedSubjects,
      createdAt: serverTimestamp()
    };

    // Create teacher profile in existing Firestore structure.
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

    localStorage.setItem("studenthub_email", email);

    // Open dashboard immediately after successful registration.
    await loadDashboardData(user);

    showToast("Teacher account created successfully!");

  } catch (error) {
    console.error("Registration error:", error);

    let message = friendlyAuthError(error);

    if (error.code === "auth/email-already-in-use") {
      message = "This email is already registered. Please sign in instead.";
    }

    if (
      error.code === "permission-denied" ||
      error.code === "firestore/permission-denied"
    ) {
      message = "Firebase created your account, but Firestore could not save your profile. Please check your Firestore security rules.";
    }

    showMessage("registerError", message);

    if (auth.currentUser && !teacherProfile) {
      await signOut(auth).catch(console.error);
      showLogin();
    }

  } finally {
    registrationInProgress = false;
    setBusy("registerForm", false);
  }
}


// ==========================================
// 5. TEACHER LOGIN
// ==========================================

async function loginTeacher(event) {
  event?.preventDefault();

  const email = clean($("loginEmail")?.value).toLowerCase();
  const password = $("loginPassword")?.value || "";

  showMessage("loginError", "");

  if (!email || !password) {
    return showMessage("loginError", "Enter your email and password.");
  }

  setBusy("loginForm", true, "Signing in...");

  try {
    await signInWithEmailAndPassword(auth, email, password);

    if ($("rememberEmail")?.checked) {
      localStorage.setItem("studenthub_email", email);
    } else {
      localStorage.removeItem("studenthub_email");
    }

  } catch (error) {
    console.error("Login error:", error);

    showMessage("loginError", friendlyAuthError(error));

  } finally {
    setBusy("loginForm", false);
  }
}


function friendlyAuthError(error) {
  const messages = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account was found for this email.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/email-already-in-use": "This email is already registered.",
    "auth/weak-password": "Please choose a stronger password.",
    "auth/invalid-email": "Please enter a valid email address."
  };

  return messages[error.code] || error.message || "Something went wrong.";
}


// ==========================================
// 6. PASSWORD RESET
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
    showToast(friendlyAuthError(error));
  }
}


// ==========================================
// 7. LOGOUT
// ==========================================

async function logoutTeacher() {
  try {
    await signOut(auth);

    currentTeacher = null;
    teacherProfile = null;
    students = [];
    selectedSubject = "";
    editingStudentId = null;

    showLogin();

    showToast("Logged out successfully!");

  } catch (error) {
    showToast(error.message);
  }
}


// ==========================================
// 8. LOAD TEACHER PROFILE
// ==========================================

async function loadTeacherProfile(user) {
  const snapshot = await getDoc(
    doc(db, "teachers", user.uid)
  );

  if (!snapshot.exists()) {
    throw new Error(
      "No teacher profile was found for this account. Please check your Firebase teacher records."
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
          data.subjects.filter(subject => SUBJECTS.includes(subject))
        )]
      : []
  };

  if (!teacherProfile.subjects.length) {
    throw new Error(
      "No subjects are saved in this teacher profile."
    );
  }

  // Update teacher information throughout the website.
  $("welcomeName").textContent = teacherProfile.name;

  $("sidebarName").textContent = teacherProfile.name;
  $("sidebarEmail").textContent = teacherProfile.email;

  $("settingsName").textContent = teacherProfile.name;
  $("settingsNameInput").value = teacherProfile.name;

  $("settingsEmail").textContent = teacherProfile.email;
  $("settingsEmailDisplay").textContent = teacherProfile.email;

  $("footerEmail").textContent = teacherProfile.email;

  const initials = getInitials(teacherProfile.name);

  [
    "sidebarInitials",
    "topInitials",
    "settingsInitials"
  ].forEach(id => {
    if ($(id)) $(id).textContent = initials;
  });

  renderSubjectNavigation();
}


// ==========================================
// 9. LOAD STUDENTS FROM FIRESTORE
// ==========================================

async function loadStudents() {
  if (!currentTeacher) return;

  const snapshot = await getDocs(
    collection(db, "teachers", currentTeacher.uid, "students")
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


// ==========================================
// 10. LOAD DASHBOARD
// ==========================================

async function loadDashboardData(user = auth.currentUser) {
  if (!user) return;

  currentTeacher = user;

  await loadTeacherProfile(user);

  await loadStudents();

  showApp();

  navigateTo("dashboard");
}


// ==========================================
// 11. ADD STUDENT
// ==========================================

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

  if (roll.includes("/")) {
    return showMessage(
      "addMessage",
      "Registration number cannot contain a slash."
    );
  }

  if (!subjects.length) {
    return showMessage(
      "addMessage",
      "Select at least one subject."
    );
  }

  const studentId = editingStudentId || roll;

  const old = students.find(student => student.id === studentId);

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

  setBusy("addStudentForm", true, "Saving...");

  try {
    const reference = doc(
      db,
      "teachers",
      currentTeacher.uid,
      "students",
      studentId
    );

    if (editingStudentId) {

      await updateDoc(reference, record);

      editingStudentId = null;

      showToast("Student updated successfully!");

    } else {

      if (students.some(student => student.id === studentId)) {
        showMessage(
          "addMessage",
          "This registration number already exists."
        );

        return;
      }

      await setDoc(reference, {
        ...record,
        createdAt: serverTimestamp()
      });

      showToast("Student added successfully!");
    }

    $("addStudentForm").reset();

    $("addPageTitle").textContent = "Add Student";

    await loadStudents();

    navigateTo("students");

  } catch (error) {
    console.error(error);

    showMessage("addMessage", friendlyAuthError(error));

  } finally {
    setBusy("addStudentForm", false);
  }
}


// ==========================================
// 12. EDIT STUDENT
// ==========================================

function editStudent(id) {
  const student = students.find(item => item.id === id);

  if (!student) return;

  $("addReg").value = student.roll || "";
  $("addName").value = student.name || "";
  $("addStudentEmail").value = student.email || "";
  $("addYear").value = String(student.year || 1);

  $("studentSubjectPicker")
    ?.querySelectorAll('input[type="checkbox"]')
    .forEach(input => {
      input.checked = (student.subjects || []).includes(input.value);
    });

  editingStudentId = id;

  $("addPageTitle").textContent = "Edit Student";

  navigateTo("add");
}


// ==========================================
// 13. DELETE STUDENT
// ==========================================

async function deleteStudent(id) {
  if (!currentTeacher) return;

  const confirmed = confirm(
    "Are you sure you want to delete this student? This cannot be undone."
  );

  if (!confirmed) return;

  try {
    await deleteDoc(
      doc(db, "teachers", currentTeacher.uid, "students", id)
    );

    await loadStudents();

    showToast("Student deleted successfully!");

  } catch (error) {
    showToast(error.message);
  }
}


// ==========================================
// 14. ATTENDANCE MANAGEMENT
// ==========================================

async function saveAttendance(event) {
  event?.preventDefault();

  const studentId = $("attendanceStudent").value;
  const subject = $("attendanceSubject").value;

  const held = Number($("classesHeld").value);
  const attended = Number($("classesAttended").value);

  showMessage("attendanceMessage", "");

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

  const student = students.find(item => item.id === studentId);

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

    await updateDoc(
      doc(db, "teachers", currentTeacher.uid, "students", studentId),
      {
        [`attendance.${subject}`]: {
          held: Number(previous.held || 0) + held,
          attended: Number(previous.attended || 0) + attended
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
    showMessage("attendanceMessage", error.message);
  }
}


// ==========================================
// 15. ACADEMIC RESULTS
// ==========================================

async function saveResult(event) {
  event?.preventDefault();

  const studentId = $("resultStudent").value;
  const semester = $("resultSemester").value;
  const raw = $("resultSGPA").value;

  const sgpa = Number(raw);

  showMessage("resultMessage", "");

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
      doc(db, "teachers", currentTeacher.uid, "students", studentId),
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
    showMessage("resultMessage", error.message);
  }
}


// ==========================================
// 16. CGPA CALCULATIONS
// ==========================================

function getCGPA(student) {
  const values = Object.values(student.results || {})
    .map(Number)
    .filter(number =>
      Number.isFinite(number) &&
      number >= 0 &&
      number <= 10
    );

  if (!values.length) return "—";

  return (
    values.reduce((a, b) => a + b, 0) / values.length
  ).toFixed(2);
}

function getYearCGPA(student, year) {
  const firstSemester = (year - 1) * 2 + 1;

  const values = [
    firstSemester,
    firstSemester + 1
  ]
    .map(semester => student.results?.[semester])
    .filter(value => value !== undefined && value !== null && value !== "")
    .map(Number)
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 10);

  if (!values.length) return "—";

  return (
    values.reduce((a, b) => a + b, 0) / values.length
  ).toFixed(2);
}


// ==========================================
// 17. ATTENDANCE CALCULATIONS
// ==========================================

function getAttendance(student, subject) {
  const data = student.attendance?.[subject];

  if (!data || !Number(data.held)) return "—";

  return (
    (Number(data.attended || 0) / Number(data.held)) * 100
  ).toFixed(1) + "%";
}

function getOverallAttendance(student) {
  let held = 0;
  let attended = 0;

  Object.values(student.attendance || {}).forEach(data => {
    held += Number(data.held || 0);
    attended += Number(data.attended || 0);
  });

  return held
    ? ((attended / held) * 100).toFixed(1) + "%"
    : "—";
}


// ==========================================
// 18. SUBJECT NAVIGATION
// ==========================================

function renderSubjectNavigation() {
  const container = $("subjectNavigation");

  if (!container || !teacherProfile) return;

  container.innerHTML = teacherProfile.subjects.map(subject => `
    <button
      class="nav-link subject-nav-item"
      data-subject="${escapeHTML(subject)}"
      type="button"
    >
      <span class="nav-icon">▦</span>
      <span>${escapeHTML(subject)}</span>
    </button>
  `).join("");

  container.querySelectorAll("[data-subject]").forEach(button => {
    button.addEventListener("click", () => {
      openSubject(button.dataset.subject);
    });
  });

  renderSubjectPickers();
  renderDashboardSubjects();
}


// ==========================================
// 19. SUBJECT PICKERS
// ==========================================

function renderSubjectPickers() {
  if (!teacherProfile) return;

  const teacherSubjects = teacherProfile.subjects || [];

  const studentPicker = $("studentSubjectPicker");

  if (studentPicker) {
    studentPicker.innerHTML = teacherSubjects.map(subject => `
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

  const settingsPicker = $("settingsSubjectPicker");

  if (settingsPicker) {
    settingsPicker.innerHTML = SUBJECTS.map(subject => `
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

  const attendanceSelect = $("attendanceSubject");

  if (attendanceSelect) {
    attendanceSelect.innerHTML = `
      <option value="">Select subject</option>
      ${teacherSubjects.map(subject => `
        <option value="${escapeHTML(subject)}">
          ${escapeHTML(subject)}
        </option>
      `).join("")}
    `;
  }
}


// ==========================================
// 20. DASHBOARD SUBJECT CARDS
// ==========================================

function renderDashboardSubjects() {
  const container = $("dashboardSubjects");

  if (!container || !teacherProfile) return;

  container.innerHTML = teacherProfile.subjects.map(subject => {
    const count = students.filter(student =>
      student.subjects?.includes(subject)
    ).length;

    return `
      <button
        class="subject-card"
        data-subject="${escapeHTML(subject)}"
        type="button"
      >
        <strong>${escapeHTML(subject)}</strong>
        <span>${count} students</span>
      </button>
    `;
  }).join("");

  container.querySelectorAll("[data-subject]").forEach(button => {
    button.addEventListener("click", () => {
      openSubject(button.dataset.subject);
    });
  });
}


// ==========================================
// 21. SUBJECT WORKSPACE
// ==========================================

function openSubject(subject) {
  if (!teacherProfile?.subjects.includes(subject)) return;

  selectedSubject = subject;

  const filtered = students.filter(student =>
    student.subjects?.includes(subject)
  );

  $("subjectPageTitle").textContent = subject;

  $("subjectPageDescription").textContent =
    "Student records and performance for " + subject;

  $("subjectStudents").textContent = filtered.length;

  const attendance = filtered
    .map(student => Number.parseFloat(getAttendance(student, subject)))
    .filter(Number.isFinite);

  $("subjectAttendance").textContent = attendance.length
    ? (
        attendance.reduce((a, b) => a + b, 0) /
        attendance.length
      ).toFixed(1) + "%"
    : "—";

  $("subjectMarks").textContent = "—";

  $("subjectTableBody").innerHTML = filtered.map(student => `
    <tr>
      <td>${escapeHTML(student.roll)}</td>
      <td>${escapeHTML(student.name)}</td>
      <td>${getAttendance(student, subject)}</td>
      <td>—</td>
      <td>
        <button
          class="table-action"
          data-edit="${escapeHTML(student.id)}"
          type="button"
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

  $("subjectEmpty").classList.toggle("hidden", filtered.length > 0);

  navigateTo("subject");
}


// ==========================================
// 22. STUDENT DIRECTORY
// ==========================================

function renderStudents() {
  const body = $("studentTableBody");

  if (!body) return;

  const search = clean($("tableSearch")?.value).toLowerCase();

  const filtered = students.filter(student =>
    clean(student.name).toLowerCase().includes(search) ||
    clean(student.roll).toLowerCase().includes(search)
  );

  body.innerHTML = filtered.map(student => `
    <tr>
      <td>${escapeHTML(student.roll)}</td>
      <td>${escapeHTML(student.name)}</td>
      <td>${getCGPA(student)}</td>
      <td>${getOverallAttendance(student)}</td>
      <td>
        <button
          class="table-action"
          data-edit="${escapeHTML(student.id)}"
          type="button"
        >
          Edit
        </button>

        <button
          class="table-action delete-action"
          data-delete="${escapeHTML(student.id)}"
          type="button"
        >
          Delete
        </button>
      </td>
    </tr>
  `).join("");

  body.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      editStudent(button.dataset.edit);
    });
  });

  body.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      deleteStudent(button.dataset.delete);
    });
  });

  $("recordCount").textContent = `${filtered.length} records`;

  $("emptyStudents").classList.toggle(
    "hidden",
    filtered.length > 0
  );
}


// ==========================================
// 23. STUDENT DROPDOWNS
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

    if (students.some(student => student.id === previous)) {
      select.value = previous;
    }
  });

  const filter = $("academicFilter");

  if (!filter) return;

  const previous = filter.value;

  filter.innerHTML = `
    <option value="">All Students</option>
    ${students.map(student => `
      <option value="${escapeHTML(student.id)}">
        ${escapeHTML(student.name)}
      </option>
    `).join("")}
  `;

  if (students.some(student => student.id === previous)) {
    filter.value = previous;
  }
}


// ==========================================
// 24. ATTENDANCE TABLE
// ==========================================

function renderAttendance() {
  const body = $("attendanceTableBody");

  if (!body) return;

  body.innerHTML = students.flatMap(student =>
    (student.subjects || []).map(subject => {
      const data = student.attendance?.[subject] || {
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


// ==========================================
// 25. ACADEMIC RESULTS TABLE
// ==========================================

function renderAcademic() {
  const filter = $("academicFilter")?.value || "";

  const filtered = students.filter(student =>
    !filter || student.id === filter
  );

  const body = $("academicTableBody");

  if (!body) return;

  body.innerHTML = filtered.map(student => {
    const results = Array.from(
      { length: 8 },
      (_, index) => student.results?.[index + 1] ?? "—"
    ).map(value =>
      typeof value === "number" ? value.toFixed(2) : value
    ).join(" / ");

    return `
      <tr>
        <td>${escapeHTML(student.roll)}</td>
        <td>${escapeHTML(student.name)}</td>
        <td>${results}</td>
        <td>${getYearCGPA(student, 1)}</td>
        <td>${getYearCGPA(student, 2)}</td>
        <td>${getCGPA(student)}</td>
      </tr>
    `;
  }).join("");
}


// ==========================================
// 26. DASHBOARD STATISTICS
// ==========================================

function renderDashboard() {
  if (!teacherProfile) return;

  $("totalStudents").textContent = students.length;

  $("subjectCount").textContent =
    teacherProfile.subjects.length;

  const attendance = students
    .map(student =>
      Number.parseFloat(getOverallAttendance(student))
    )
    .filter(Number.isFinite);

  $("averageAttendance").textContent = attendance.length
    ? (
        attendance.reduce((a, b) => a + b, 0) /
        attendance.length
      ).toFixed(1) + "%"
    : "—";

  const cgpa = students
    .map(student => Number.parseFloat(getCGPA(student)))
    .filter(Number.isFinite);

  $("averageSGPA").textContent = cgpa.length
    ? (
        cgpa.reduce((a, b) => a + b, 0) /
        cgpa.length
      ).toFixed(2)
    : "—";

  const recent = students.slice(-5).reverse();

  $("recentStudents").innerHTML = recent.map(student => `
    <div class="recent-student-item">
      <div class="recent-student-info">
        <div class="recent-student-avatar">
          ${escapeHTML(getInitials(student.name))}
        </div>

        <div>
          <strong>${escapeHTML(student.name)}</strong>
          <small>${escapeHTML(student.roll)}</small>
        </div>
      </div>

      <span class="recent-student-grade">
        ${getCGPA(student)}
      </span>
    </div>
  `).join("") || "<p>No students added yet.</p>";

  renderDashboardSubjects();
}


// ==========================================
// 27. REFRESH ALL DATA
// ==========================================

function renderAll() {
  renderStudents();
  renderAttendance();
  renderAcademic();
  renderDashboard();
}


// ==========================================
// 28. PAGE NAVIGATION
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

  $("page-" + page)?.classList.remove("hidden");

  $("topbarTitle").textContent =
    PAGE_TITLES[page] || "StudentHub";

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  $("sidebar")?.classList.remove("open");
}


// ==========================================
// 29. TEACHER SETTINGS
// ==========================================

async function saveSettings(event) {
  event?.preventDefault();

  if (!currentTeacher || !teacherProfile) return;

  const name = clean($("settingsNameInput").value);

  const subjects = getFormSubjects(
    "settingsForm",
    SUBJECTS
  );

  showMessage("settingsMessage", "");

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

    showToast("Profile updated successfully!");

  } catch (error) {
    showMessage("settingsMessage", error.message);
  }
}


// ==========================================
// 30. WHITE MODE / BLACK MODE
// ==========================================

function updateThemeButton() {
  const dark = document.body.classList.contains("dark");

  $("themeIcon").textContent = dark ? "☀" : "☾";

  // Label describes the mode the user can switch TO.
  $("themeText").textContent = dark ? "White Mode" : "Black Mode";
}

function toggleTheme() {
  document.body.classList.toggle("dark");

  const dark = document.body.classList.contains("dark");

  localStorage.setItem(
    "studenthub_theme",
    dark ? "dark" : "light"
  );

  updateThemeButton();
}

function loadTheme() {
  const dark = localStorage.getItem("studenthub_theme") === "dark";

  document.body.classList.toggle("dark", dark);

  updateThemeButton();
}


// ==========================================
// 31. EVENT BINDING
// ==========================================

function bind(id, event, handler) {
  $(id)?.addEventListener(event, handler);
}


// Authentication
bind("loginForm", "submit", loginTeacher);

bind("registerForm", "submit", registerTeacher);

bind("showRegister", "click", () => {
  showMessage("registerError", "");
  showView("registerView");
});

bind("showLogin", "click", () => {
  showMessage("loginError", "");
  showView("loginView");
});

bind("forgotPassword", "click", resetPassword);


// Student management
bind("addStudentForm", "submit", saveStudent);

bind("tableSearch", "input", renderStudents);

bind("clearStudentButton", "click", () => {
  editingStudentId = null;
  $("addPageTitle").textContent = "Add Student";
  showMessage("addMessage", "");
});


// Attendance and results
bind("attendanceForm", "submit", saveAttendance);

bind("resultForm", "submit", saveResult);

bind("academicFilter", "change", renderAcademic);


// Settings
bind("settingsForm", "submit", saveSettings);

bind("settingsResetPassword", "click", async () => {
  const email = teacherProfile?.email;

  if (!email) {
    return showToast("Teacher email not found.");
  }

  try {
    await sendPasswordResetEmail(auth, email);

    showToast("Password reset email sent!");

  } catch (error) {
    showToast(friendlyAuthError(error));
  }
});


// Sign out buttons: all three work.
bind("logoutButton", "click", logoutTeacher);

bind("topLogoutButton", "click", logoutTeacher);

bind("settingsLogoutButton", "click", logoutTeacher);


// Theme
bind("themeToggle", "click", toggleTheme);


// Mobile sidebar
bind("menuToggle", "click", () => {
  $("sidebar")?.classList.toggle("open");
});


// Sidebar navigation
document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    navigateTo(button.dataset.page);
  });
});


// Dashboard quick-action navigation
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


// ==========================================
// 32. INITIAL PAGE SETUP
// ==========================================

// Date
if ($("todayLabel")) {
  $("todayLabel").textContent = new Date().toLocaleDateString(
    "en-IN",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  );
}

// Remember email only, never password.
const savedEmail = localStorage.getItem("studenthub_email");

if (savedEmail && $("loginEmail")) {
  $("loginEmail").value = savedEmail;
}

// Restore theme.
loadTheme();


// ==========================================
// 33. FIREBASE AUTHENTICATION LISTENER
// ==========================================

onAuthStateChanged(auth, async user => {

  if (registrationInProgress || authLoadInProgress) {
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
      "Authentication/profile loading error:",
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


// ==========================================
// 34. GLOBAL FUNCTIONS
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

console.log("StudentHub initialized successfully.");
