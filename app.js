
"use strict";

/* =========================================
   STUDENTHUB - APPLICATION
   ========================================= */

const KEYS = {
    students: "studenthub_students_v2",
    email: "studenthub_remembered_email",
    remember: "studenthub_remember_email",
    theme: "studenthub_theme",
    session: "studenthub_demo_session"
};

const DEMO_EMAIL = "teacher@school.edu";
const DEMO_PASSWORD = "teacher123";

let students = loadStudents();
let toastTimer;
let confirmResolver = null;

const $ = id => document.getElementById(id);

const pages = {
    dashboard: "Dashboard",
    students: "All Students",
    add: "Add Student",
    search: "Search Student",
    update: "Update Record",
    delete: "Delete Student",
    linkedlist: "Linked List Lab",
    guide: "DS Guide"
};


/* =========================================
   SECURITY / HTML HELPERS
   ========================================= */

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function normalizeReg(value) {
    return String(value).trim().toUpperCase();
}

function getInitials(name) {
    return String(name)
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join("")
        .toUpperCase();
}

function validMarks(value) {
    return Number.isFinite(value) && value >= 0 && value <= 100;
}

function findStudent(reg) {
    const key = normalizeReg(reg);
    return students.find(s => s.reg === key);
}

function performance(marks) {
    if (marks >= 90) return "Excellent";
    if (marks >= 75) return "Very Good";
    if (marks >= 50) return "Average";
    return "Needs Improvement";
}


/* =========================================
   LOCAL STORAGE
   ========================================= */

function loadStudents() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEYS.students) || "[]");

        if (!Array.isArray(saved)) return [];

        const seen = new Set();

        return saved.filter(s => {
            if (!s || typeof s !== "object") return false;

            const reg = normalizeReg(s.reg);
            const name = String(s.name || "").trim();
            const marks = Number(s.marks);

            if (!reg || !name || !validMarks(marks) || seen.has(reg)) {
                return false;
            }

            seen.add(reg);
            return true;
        }).map(s => ({
            reg: normalizeReg(s.reg),
            name: String(s.name).trim(),
            marks: Number(s.marks)
        }));
    } catch {
        return [];
    }
}

function saveStudents() {
    try {
        localStorage.setItem(KEYS.students, JSON.stringify(students));
        return true;
    } catch (error) {
        console.error(error);
        showToast("Could not save records. Check browser storage.", "error");
        return false;
    }
}


/* =========================================
   TOAST MESSAGES
   ========================================= */

function showToast(message, type = "success") {
    const toast = $("toast");

    toast.textContent = message;
    toast.style.borderColor = type === "error"
        ? "var(--red)"
        : "var(--accent)";

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

function setMessage(id, message, type = "") {
    const element = $(id);
    element.textContent = message;
    element.className = "form-message " + type;
}


/* =========================================
   THEME MANAGEMENT
   ========================================= */

function applyTheme(theme) {
    const dark = theme === "dark";

    document.body.classList.toggle("dark", dark);

    $("themeIcon").textContent = dark ? "☀" : "☾";
    $("themeText").textContent = dark ? "Light mode" : "Dark mode";

    document.documentElement.style.colorScheme =
        dark ? "dark" : "light";

    localStorage.setItem(KEYS.theme, theme);
}

function initializeTheme() {
    const saved = localStorage.getItem(KEYS.theme);
    applyTheme(saved === "dark" ? "dark" : "light");
}

$("themeToggle").addEventListener("click", () => {
    const currentlyDark = document.body.classList.contains("dark");
    applyTheme(currentlyDark ? "light" : "dark");
});

initializeTheme();


/* =========================================
   LOGIN MANAGEMENT
   ========================================= */

function initializeLogin() {
    const savedEmail = localStorage.getItem(KEYS.email);
    const remember = localStorage.getItem(KEYS.remember);

    if (savedEmail) {
        $("loginEmail").value = savedEmail;
    }

    $("rememberEmail").checked = remember !== "false";
}

function showLogin() {
    $("loginPage").classList.remove("hidden");
    $("app").classList.add("hidden");

    $("loginPassword").value = "";
    $("loginEmail").focus();
}

function showApplication() {
    $("loginPage").classList.add("hidden");
    $("app").classList.remove("hidden");

    $("todayLabel").textContent = new Intl.DateTimeFormat(
        "en-IN",
        {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    ).format(new Date());

    refreshAll();
    navigateTo("dashboard");
}

initializeLogin();

$("loginForm").addEventListener("submit", event => {
    event.preventDefault();

    const email = $("loginEmail").value.trim().toLowerCase();
    const password = $("loginPassword").value;

    $("loginError").textContent = "";

    if (!email || !password) {
        $("loginError").textContent = "Please enter your email and password.";
        return;
    }

    // Demo frontend authentication.
    if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
        $("loginError").textContent =
            "Incorrect email or password. Please try again.";
        $("loginPassword").focus();
        return;
    }

    // Save the email only when Remember my email is selected.
    if ($("rememberEmail").checked) {
        localStorage.setItem(KEYS.email, email);
        localStorage.setItem(KEYS.remember, "true");
    } else {
        localStorage.removeItem(KEYS.email);
        localStorage.setItem(KEYS.remember, "false");
    }

    // Do not store the password.
    $("loginPassword").value = "";

    sessionStorage.setItem(KEYS.session, "active");

    showApplication();
    showToast("Welcome back, Teacher!");
});

$("togglePassword").addEventListener("click", () => {
    const field = $("loginPassword");
    const visible = field.type === "text";

    field.type = visible ? "password" : "text";
    $("togglePassword").textContent = visible ? "Show" : "Hide";
});

$("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem(KEYS.session);
    $("sidebar").classList.remove("open");
    showLogin();
});


// Restore the demo session only for this browser tab/session.
if (sessionStorage.getItem(KEYS.session) === "active") {
    showApplication();
} else {
    showLogin();
}


/* =========================================
   NAVIGATION
   ========================================= */

function navigateTo(pageName) {
    const target = $("page-" + pageName);

    if (!target) return;

    document.querySelectorAll(".page-section").forEach(page => {
        page.classList.add("hidden");
    });

    target.classList.remove("hidden");

    document.querySelectorAll(".nav-link").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === pageName
        );
    });

    $("topbarTitle").textContent = pages[pageName] || "StudentHub";

    $("sidebar").classList.remove("open");

    if (pageName === "dashboard") renderDashboard();
    if (pageName === "students") renderStudentTable();
    if (pageName === "linkedlist") renderLinkedList();

    if (pageName === "add") {
        $("addStudentForm").reset();
        setMessage("addMessage", "");
        $("addReg").focus();
    }

    if (pageName === "search") {
        $("searchStudentForm").reset();
        $("searchResult").innerHTML = "";
        $("searchReg").focus();
    }

    if (pageName === "update") {
        $("updateLookupForm").reset();
        $("updateStudentForm").reset();
        $("updateEditor").classList.add("hidden");
        setMessage("updateLookupMessage", "");
        setMessage("updateMessage", "");
    }

    if (pageName === "delete") {
        $("deleteLookupForm").reset();
        $("deleteResult").innerHTML = "";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
        navigateTo(button.dataset.page);
    });
});

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
        navigateTo(button.dataset.go);
    });
});

$("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
});


/* =========================================
   DASHBOARD
   ========================================= */

function renderDashboard() {
    const total = students.length;

    $("totalStudents").textContent = total;

    if (total === 0) {
        $("averageMarks").textContent = "0.0";
        $("topPerformer").textContent = "—";
        $("topPerformerMarks").textContent = "No records yet";

        $("recentStudents").innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">▤</div>
                <h3>No students added yet</h3>
                <p>Start by creating your first student record.</p>
                <button class="primary-button" data-go="add">
                    Add Student
                </button>
            </div>
        `;

        $("recentStudents").querySelector("[data-go]")
            .addEventListener("click", () => navigateTo("add"));

        return;
    }

    const sum = students.reduce((value, s) => value + s.marks, 0);

    $("averageMarks").textContent = (sum / total).toFixed(1);

    const top = students.reduce((best, current) =>
        current.marks > best.marks ? current : best
    );

    $("topPerformer").textContent = top.name;
    $("topPerformerMarks").textContent =
        `${top.marks} / 100 marks`;

    $("recentStudents").innerHTML = [...students]
        .slice(-5)
        .reverse()
        .map(s => `
            <div class="recent-row">
                <div class="student-avatar">${escapeHTML(getInitials(s.name))}</div>
                <div class="student-summary">
                    <strong>${escapeHTML(s.name)}</strong>
                    <small>${escapeHTML(s.reg)}</small>
                </div>
                <span class="mark-pill">${s.marks}%</span>
            </div>
        `).join("");
}


/* =========================================
   STUDENT TABLE AND SEARCH FILTER
   ========================================= */

function renderStudentTable(query = "") {
    const tbody = $("studentTableBody");
    const search = query.trim().toLowerCase();

    const results = students.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.reg.toLowerCase().includes(search)
    );

    $("recordCount").textContent =
        `${results.length} record${results.length === 1 ? "" : "s"} found`;

    $("emptyStudents").classList.toggle("hidden", results.length > 0);

    tbody.innerHTML = results.map(s => `
        <tr>
            <td><span class="reg-badge">${escapeHTML(s.reg)}</span></td>
            <td>${escapeHTML(s.name)}</td>
            <td>${s.marks} / 100</td>
            <td><span class="performance ${
                s.marks >= 75 ? "" : s.marks >= 50 ? "average" : "needs-work"
            }">${performance(s.marks)}</span></td>
            <td>
                <div class="row-actions">
                    <button class="small-action" data-edit="${escapeHTML(s.reg)}">Edit</button>
                    <button class="small-action delete" data-delete="${escapeHTML(s.reg)}">Delete</button>
                </div>
            </td>
        </tr>
    `).join("");

    tbody.querySelectorAll("[data-edit]").forEach(button => {
        button.addEventListener("click", () => {
            openUpdatePage(button.dataset.edit);
        });
    });

    tbody.querySelectorAll("[data-delete]").forEach(button => {
        button.addEventListener("click", () => {
            requestDeletion(button.dataset.delete);
        });
    });
}

$("tableSearch").addEventListener("input", event => {
    renderStudentTable(event.target.value);
});


/* =========================================
   ADD STUDENT
   ========================================= */

$("addStudentForm").addEventListener("submit", event => {
    event.preventDefault();

    const reg = normalizeReg($("addReg").value);
    const name = $("addName").value.trim();
    const marks = Number($("addMarks").value);

    if (!reg || !name) {
        setMessage("addMessage", "Please fill in all fields.", "error");
        return;
    }

    if (!validMarks(marks)) {
        setMessage("addMessage", "Marks must be between 0 and 100.", "error");
        return;
    }

    if (findStudent(reg)) {
        setMessage("addMessage", "This registration number already exists.", "error");
        return;
    }

    students.push({ reg, name, marks });

    if (!saveStudents()) {
        students.pop();
        return;
    }

    $("addStudentForm").reset();

    setMessage(
        "addMessage",
        `Successfully added ${name} to StudentHub.`,
        "success"
    );

    refreshAll();
    showToast("Student added successfully!");
});


/* =========================================
   SEARCH STUDENT
   ========================================= */

$("searchStudentForm").addEventListener("submit", event => {
    event.preventDefault();

    const reg = normalizeReg($("searchReg").value);
    const student = findStudent(reg);

    if (!student) {
        $("searchResult").innerHTML = `
            <div class="panel empty-state">
                <div class="empty-icon">⌕</div>
                <h3>Student not found</h3>
                <p>No record exists for ${escapeHTML(reg)}.</p>
            </div>
        `;
        return;
    }

    $("searchResult").innerHTML = `
        <div class="student-detail-card">
            <div class="student-detail-top">
                <div class="student-avatar">${escapeHTML(getInitials(student.name))}</div>
                <div>
                    <span class="eyebrow">RECORD FOUND</span>
                    <h3>${escapeHTML(student.name)}</h3>
                    <p>${escapeHTML(student.reg)}</p>
                </div>
            </div>

            <div class="detail-grid">
                <div class="detail-item">
                    <small>REGISTRATION NUMBER</small>
                    <strong>${escapeHTML(student.reg)}</strong>
                </div>
                <div class="detail-item">
                    <small>MARKS</small>
                    <strong>${student.marks} / 100</strong>
                </div>
                <div class="detail-item">
                    <small>PERFORMANCE</small>
                    <strong>${performance(student.marks)}</strong>
                </div>
            </div>

            <div class="form-actions">
                <button class="secondary-button" id="searchEditButton">Edit Record</button>
            </div>
        </div>
    `;

    $("searchEditButton").addEventListener("click", () => {
        openUpdatePage(student.reg);
    });
});


/* =========================================
   UPDATE STUDENT
   ========================================= */

function openUpdatePage(reg) {
    navigateTo("update");
    $("updateLookupReg").value = reg;
    loadUpdateRecord(reg);
}

$("updateLookupForm").addEventListener("submit", event => {
    event.preventDefault();
    loadUpdateRecord($("updateLookupReg").value);
});

function loadUpdateRecord(reg) {
    const student = findStudent(reg);

    setMessage("updateLookupMessage", "");

    if (!student) {
        $("updateEditor").classList.add("hidden");

        setMessage(
            "updateLookupMessage",
            "Student record not found.",
            "error"
        );
        return;
    }

    $("updateOriginalReg").value = student.reg;
    $("updateReg").value = student.reg;
    $("updateName").value = student.name;
    $("updateMarks").value = student.marks;

    $("updateEditor").classList.remove("hidden");
    setMessage("updateMessage", "");
}

$("updateStudentForm").addEventListener("submit", event => {
    event.preventDefault();

    const original = normalizeReg($("updateOriginalReg").value);
    const reg = normalizeReg($("updateReg").value);
    const name = $("updateName").value.trim();
    const marks = Number($("updateMarks").value);

    if (!reg || !name) {
        setMessage("updateMessage", "All fields are required.", "error");
        return;
    }

    if (!validMarks(marks)) {
        setMessage("updateMessage", "Marks must be between 0 and 100.", "error");
        return;
    }

    if (students.some(s => s.reg === reg && s.reg !== original)) {
        setMessage("updateMessage", "Registration number already belongs to another student.", "error");
        return;
    }

    const index = students.findIndex(s => s.reg === original);

    if (index === -1) {
        setMessage("updateMessage", "Original record no longer exists.", "error");
        return;
    }

    const oldRecord = { ...students[index] };

    students[index] = { reg, name, marks };

    if (!saveStudents()) {
        students[index] = oldRecord;
        return;
    }

    $("updateOriginalReg").value = reg;
    $("updateLookupReg").value = reg;

    setMessage("updateMessage", "Student record updated successfully.", "success");

    refreshAll();
    showToast("Student record updated!");
});

$("cancelUpdate").addEventListener("click", () => {
    $("updateEditor").classList.add("hidden");
    $("updateStudentForm").reset();
});


/* =========================================
   CUSTOM CONFIRMATION DIALOG
   ========================================= */

function confirmAction(title, message) {
    const dialog = $("confirmDialog");

    $("confirmTitle").textContent = title;
    $("confirmText").textContent = message;

    return new Promise(resolve => {
        confirmResolver = resolve;

        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        } else {
            confirmResolver = null;
            resolve(window.confirm(message));
        }
    });
}

function closeConfirmation(answer) {
    const dialog = $("confirmDialog");

    if (dialog.open) dialog.close();

    if (confirmResolver) {
        const resolve = confirmResolver;
        confirmResolver = null;
        resolve(answer);
    }
}

$("confirmAccept").addEventListener("click", () => {
    closeConfirmation(true);
});

$("confirmCancel").addEventListener("click", () => {
    closeConfirmation(false);
});

$("confirmDialog").addEventListener("cancel", event => {
    event.preventDefault();
    closeConfirmation(false);
});


/* =========================================
   DELETE STUDENT
   ========================================= */

async function requestDeletion(reg) {
    const student = findStudent(reg);

    if (!student) {
        showToast("Student not found.", "error");
        return;
    }

    const answer = await confirmAction(
        "Delete student record?",
        `Are you sure you want to permanently delete ${student.name} (${student.reg})?`
    );

    if (!answer) return;

    deleteStudent(reg);
}

function deleteStudent(reg) {
    const index = students.findIndex(s => s.reg === normalizeReg(reg));

    if (index === -1) return;

    const removed = students.splice(index, 1)[0];

    if (!saveStudents()) {
        students.splice(index, 0, removed);
        return;
    }

    refreshAll();
    $("deleteResult").innerHTML = "";

    showToast("Student record deleted successfully.");
}

$("deleteLookupForm").addEventListener("submit", event => {
    event.preventDefault();

    const reg = normalizeReg($("deleteLookupReg").value);
    const student = findStudent(reg);

    if (!student) {
        $("deleteResult").innerHTML = `
            <div class="panel empty-state">
                <div class="empty-icon">⌕</div>
                <h3>Student not found</h3>
                <p>No matching student record exists.</p>
            </div>
        `;
        return;
    }

    $("deleteResult").innerHTML = `
        <div class="student-detail-card">
            <div class="student-detail-top">
                <div class="student-avatar">${escapeHTML(getInitials(student.name))}</div>
                <div>
                    <span class="eyebrow">RECORD SELECTED</span>
                    <h3>${escapeHTML(student.name)}</h3>
                    <p>${escapeHTML(student.reg)}</p>
                </div>
            </div>

            <p style="margin-top:16px;font-size:12px;color:var(--muted)">
                Marks: ${student.marks} / 100
            </p>

            <div class="form-actions">
                <button class="danger-button" id="deleteConfirmButton">
                    Delete This Student
                </button>
            </div>
        </div>
    `;

    $("deleteConfirmButton").addEventListener("click", () => {
        requestDeletion(student.reg);
    });
});


/* =========================================
   SINGLY LINKED LIST VISUALIZER
   ========================================= */

function renderLinkedList() {
    $("listNodeCount").textContent = students.length;

    $("listHead").textContent = students.length
        ? students[0].reg
        : "NULL";

    const canvas = $("linkedListCanvas");

    if (students.length === 0) {
        canvas.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⌘</div>
                <h3>Empty linked list</h3>
                <p>Add a student to create your first node.</p>
                <button class="primary-button" id="visualizerAddButton">
                    Create First Node
                </button>
            </div>
        `;

        $("visualizerAddButton").addEventListener("click", () => {
            navigateTo("add");
        });

        return;
    }

    const nodeMarkup = students.map((student, index) => {
        const next = students[index + 1]
            ? students[index + 1].reg
            : "NULL";

        return `
            <div class="list-node">
                <div class="list-node-head">NODE ${index + 1}</div>

                <div class="list-node-data">
                    <strong>${escapeHTML(student.name)}</strong>
                    <small>Reg: ${escapeHTML(student.reg)}</small>
                    <small>Marks: ${student.marks}</small>
                </div>

                <div class="list-node-pointer">
                    NEXT → ${escapeHTML(next)}
                </div>
            </div>
        `;
    }).join('<span class="list-arrow">⟶</span>');

    canvas.innerHTML = `
        <span class="list-head-label">HEAD</span>
        ${nodeMarkup}
        <span class="list-arrow">⟶</span>
        <span class="null-node">NULL</span>
    `;
}


/* =========================================
   REFRESH ALL COMPONENTS
   ========================================= */

function refreshAll() {
    renderDashboard();
    renderStudentTable($("tableSearch").value);
    renderLinkedList();
}


/* =========================================
   INITIALIZATION
   ========================================= */

refreshAll();
