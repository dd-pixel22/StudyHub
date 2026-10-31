"use strict";

/* ==========================================
   STUDENTHUB — STUDENT RECORD MANAGEMENT
   Storage: Browser localStorage
   ========================================== */

const STORAGE_KEY = "studenthub_student_records_v1";
const SESSION_KEY = "studenthub_teacher_session_v1";

const DEMO_EMAIL = "teacher@school.edu";
const DEMO_PASSWORD = "teacher123";

let students = loadStudents();
let toastTimer = null;
let pendingConfirmAction = null;


/* ==========================================
   DOM HELPERS
   ========================================== */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function normalizeReg(value) {
    return String(value).trim().toUpperCase();
}

function formatMarks(value) {
    return Number(value).toFixed(2).replace(/\.00$/, "");
}

function initials(name) {
    return String(name)
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0))
        .join("")
        .toUpperCase();
}

function getPerformance(marks) {
    if (marks >= 90) {
        return { label: "Excellent", className: "" };
    }

    if (marks >= 75) {
        return { label: "Very Good", className: "" };
    }

    if (marks >= 50) {
        return { label: "Average", className: "average" };
    }

    return { label: "Needs Improvement", className: "needs-work" };
}


/* ==========================================
   STORAGE
   ========================================== */

function loadStudents() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        // Ignore malformed records.
        return parsed.filter(student => {
            return student &&
                typeof student.reg === "string" &&
                typeof student.name === "string" &&
                Number.isFinite(Number(student.marks)) &&
                Number(student.marks) >= 0 &&
                Number(student.marks) <= 100;
        }).map(student => ({
            reg: normalizeReg(student.reg),
            name: student.name.trim(),
            marks: Number(student.marks)
        }));
    } catch (error) {
        console.error("Could not load student records:", error);
        return [];
    }
}

function saveStudents() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
        return true;
    } catch (error) {
        console.error("Could not save student records:", error);

        showToast(
            "Unable to save. Check your browser storage settings.",
            "error"
        );

        return false;
    }
}


/* ==========================================
   NOTIFICATIONS
   ========================================== */

function showToast(message, type = "success") {
    const toast = $("#toast");

    toast.textContent = message;
    toast.classList.add("show");

    toast.style.borderColor = type === "error"
        ? "rgba(255, 100, 140, 0.45)"
        : "rgba(166, 107, 255, 0.3)";

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function setMessage(element, message, type = "success") {
    element.textContent = message;
    element.className = `form-message ${type}`;
}


/* ==========================================
   LOGIN AND LOGOUT
   ========================================== */

function showLogin() {
    $("#loginPage").classList.remove("hidden");
    $("#app").classList.add("hidden");
}

function showApplication() {
    $("#loginPage").classList.add("hidden");
    $("#app").classList.remove("hidden");

    renderDashboard();
    renderStudentTable();
    renderLinkedList();

    navigateTo("dashboard");
}

$("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const email = $("#loginEmail").value.trim().toLowerCase();
    const password = $("#loginPassword").value;
    const errorElement = $("#loginError");

    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, "true");

        errorElement.textContent = "";

        $("#loginForm").reset();

        showApplication();

        showToast("Welcome to StudentHub!");
    } else {
        errorElement.textContent =
            "Invalid email or password. Please try again.";
    }
});

$("#togglePassword").addEventListener("click", () => {
    const passwordInput = $("#loginPassword");
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";
    $("#togglePassword").textContent = isHidden ? "Hide" : "Show";
});

$("#logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);

    showLogin();

    $("#loginEmail").focus();
});


// This is a convenience gate, not secure server-side authentication.
// Browser JavaScript cannot provide real account security.

if (sessionStorage.getItem(SESSION_KEY) === "true") {
    showApplication();
} else {
    showLogin();
}


/* ==========================================
   NAVIGATION
   ========================================== */

const pageTitles = {
    dashboard: "Dashboard",
    students: "All Students",
    add: "Add Student",
    search: "Search Student",
    update: "Update Record",
    delete: "Delete Record",
    linkedlist: "Linked List Lab",
    guide: "DS Guide"
};

function navigateTo(pageName) {
    const page = document.getElementById(`page-${pageName}`);

    if (!page) {
        return;
    }

    $$(".page-section").forEach(section => {
        section.classList.add("hidden");
    });

    page.classList.remove("hidden");

    $$(".nav-link[data-page]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === pageName
        );
    });

    $("#topbarTitle").textContent = pageTitles[pageName] || "StudentHub";

    // Refresh the current page with the latest records.
    if (pageName === "dashboard") {
        renderDashboard();
    }

    if (pageName === "students") {
        renderStudentTable();
        $("#tableSearch").value = "";
    }

    if (pageName === "linkedlist") {
        renderLinkedList();
    }

    if (pageName === "add") {
        $("#addMessage").textContent = "";
        $("#addReg").focus();
    }

    if (pageName === "search") {
        $("#searchResult").innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⌕</div>
                <h3>Ready to find a student?</h3>
                <p>Enter a registration number above to view a record.</p>
            </div>
        `;
        $("#searchReg").focus();
    }

    if (pageName === "update") {
        $("#updateLookupForm").reset();
        $("#updateEditor").classList.add("hidden");
        $("#updateLookupMessage").textContent = "";
        $("#updateMessage").textContent = "";
        $("#updateLookupReg").focus();
    }

    if (pageName === "delete") {
        $("#deleteLookupForm").reset();
        $("#deleteResult").innerHTML = "";
        $("#deleteLookupReg").focus();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

$$("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
        navigateTo(button.dataset.page);
    });
});

$$("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
        navigateTo(button.dataset.go);
    });
});


/* ==========================================
   STUDENT LOOKUP
   ========================================== */

function findStudent(registrationNumber) {
    const target = normalizeReg(registrationNumber);

    return students.find(student => {
        return normalizeReg(student.reg) === target;
    });
}


/* ==========================================
   ADD STUDENT
   ========================================== */

$("#addStudentForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const reg = normalizeReg($("#addReg").value);
    const name = $("#addName").value.trim();
    const marks = Number($("#addMarks").value);

    const messageElement = $("#addMessage");

    if (!reg || !name) {
        setMessage(
            messageElement,
            "Please enter a registration number and name.",
            "error"
        );
        return;
    }

    if (!Number.isFinite(marks) || marks < 0 || marks > 100) {
        setMessage(
            messageElement,
            "Marks must be a number between 0 and 100.",
            "error"
        );
        return;
    }

    if (findStudent(reg)) {
        setMessage(
            messageElement,
            "This registration number already exists.",
            "error"
        );
        return;
    }

    const newStudent = {
        reg,
        name,
        marks
    };

    // Add the new student to the collection.
    students.push(newStudent);

    if (!saveStudents()) {
        students.pop();
        return;
    }

    $("#addStudentForm").reset();

    setMessage(
        messageElement,
        `Student ${name} was added successfully.`,
        "success"
    );

    renderDashboard();
    renderStudentTable();
    renderLinkedList();

    showToast("Student record added successfully.");
});


/* ==========================================
   DASHBOARD
   ========================================== */

function renderDashboard() {
    const total = students.length;

    $("#totalStudents").textContent = total;

    if (total === 0) {
        $("#averageMarks").innerHTML = '0.0<span class="small-unit"> / 100</span>';
        $("#topPerformer").textContent = "—";
        $("#topPerformerMarks").textContent = "No records yet";

        $("#recentStudents").innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">▤</div>
                <h3>No students yet</h3>
                <p>Add your first student to get started.</p>
                <button class="primary-button" data-go="add">
                    Add Student
                </button>
            </div>
        `;

        // Rebind the dynamically created navigation button.
        $("#recentStudents [data-go]").addEventListener("click", () => {
            navigateTo("add");
        });

        return;
    }

    const sum = students.reduce((totalMarks, student) => {
        return totalMarks + student.marks;
    }, 0);

    const average = sum / total;

    $("#averageMarks").innerHTML =
        `${average.toFixed(1)}<span class="small-unit"> / 100</span>`;

    const top = students.reduce((best, current) => {
        return current.marks > best.marks ? current : best;
    });

    $("#topPerformer").textContent = top.name;
    $("#topPerformerMarks").textContent =
        `${formatMarks(top.marks)} / 100 marks`;

    const recent = [...students].slice(-5).reverse();

    $("#recentStudents").innerHTML = recent.map(student => `
        <div class="recent-row">
            <div class="student-avatar">${escapeHTML(initials(student.name))}</div>

            <div class="student-summary">
                <strong>${escapeHTML(student.name)}</strong>
                <small>${escapeHTML(student.reg)}</small>
            </div>

            <span class="mark-pill">${formatMarks(student.marks)}%</span>
        </div>
    `).join("");
}


/* ==========================================
   STUDENT TABLE
   ========================================== */

function renderStudentTable(query = "") {
    const tbody = $("#studentTableBody");
    const search = query.trim().toLowerCase();

    const filtered = students.filter(student => {
        return student.reg.toLowerCase().includes(search) ||
            student.name.toLowerCase().includes(search);
    });

    $("#recordCount").textContent =
        `${filtered.length} record${filtered.length === 1 ? "" : "s"} found`;

    $("#emptyStudents").classList.toggle(
        "hidden",
        filtered.length !== 0
    );

    tbody.innerHTML = filtered.map(student => {
        const performance = getPerformance(student.marks);

        return `
            <tr>
                <td>
                    <span class="reg-badge">${escapeHTML(student.reg)}</span>
                </td>

                <td>${escapeHTML(student.name)}</td>

                <td>${formatMarks(student.marks)} / 100</td>

                <td>
                    <span class="performance ${performance.className}">
                        ${performance.label}
                    </span>
                </td>

                <td>
                    <div class="row-actions">
                        <button class="small-action"
                                data-edit="${escapeHTML(student.reg)}">
                            Edit
                        </button>

                        <button class="small-action delete"
                                data-delete="${escapeHTML(student.reg)}">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    // Bind edit buttons.
    $$("[data-edit]").forEach(button => {
        button.addEventListener("click", () => {
            openUpdatePage(button.dataset.edit);
        });
    });

    // Bind delete buttons.
    $$("[data-delete]").forEach(button => {
        button.addEventListener("click", () => {
            requestStudentDeletion(button.dataset.delete);
        });
    });
}

$("#tableSearch").addEventListener("input", (event) => {
    renderStudentTable(event.target.value);
});


/* ==========================================
   SEARCH STUDENT
   ========================================== */

$("#searchStudentForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const reg = normalizeReg($("#searchReg").value);
    const student = findStudent(reg);

    if (!student) {
        $("#searchResult").innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⌕</div>
                <h3>Student not found</h3>
                <p>No record exists for registration number
                   <strong>${escapeHTML(reg)}</strong>.</p>
            </div>
        `;

        return;
    }

    const performance = getPerformance(student.marks);

    $("#searchResult").innerHTML = `
        <div class="student-detail-card">
            <div class="student-detail-top">
                <div class="student-avatar">
                    ${escapeHTML(initials(student.name))}
                </div>

                <div>
                    <p class="eyebrow">RECORD FOUND</p>
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
                    <strong>${formatMarks(student.marks)} / 100</strong>
                </div>

                <div class="detail-item">
                    <small>PERFORMANCE</small>
                    <strong>${performance.label}</strong>
                </div>
            </div>

            <div class="form-actions">
                <button class="secondary-button" id="searchEditButton">
                    Edit Record
                </button>
            </div>
        </div>
    `;

    $("#searchEditButton").addEventListener("click", () => {
        openUpdatePage(student.reg);
    });
});


/* ==========================================
   UPDATE STUDENT
   ========================================== */

function openUpdatePage(reg) {
    navigateTo("update");

    $("#updateLookupReg").value = reg;

    loadUpdateRecord(reg);
}

$("#updateLookupForm").addEventListener("submit", (event) => {
    event.preventDefault();

    loadUpdateRecord($("#updateLookupReg").value);
});

function loadUpdateRecord(reg) {
    const student = findStudent(reg);

    $("#updateLookupMessage").textContent = "";

    if (!student) {
        $("#updateEditor").classList.add("hidden");

        setMessage(
            $("#updateLookupMessage"),
            "No student found with that registration number.",
            "error"
        );

        return;
    }

    $("#updateOriginalReg").value = student.reg;
    $("#updateReg").value = student.reg;
    $("#updateName").value = student.name;
    $("#updateMarks").value = student.marks;

    $("#updateEditor").classList.remove("hidden");

    $("#updateMessage").textContent = "";

    $("#updateReg").focus();
}

$("#updateStudentForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const originalReg = normalizeReg($("#updateOriginalReg").value);
    const newReg = normalizeReg($("#updateReg").value);
    const newName = $("#updateName").value.trim();
    const newMarks = Number($("#updateMarks").value);

    const messageElement = $("#updateMessage");

    if (!newReg || !newName) {
        setMessage(
            messageElement,
            "Registration number and name are required.",
            "error"
        );
        return;
    }

    if (!Number.isFinite(newMarks) || newMarks < 0 || newMarks > 100) {
        setMessage(
            messageElement,
            "Marks must be between 0 and 100.",
            "error"
        );
        return;
    }

    const duplicate = students.find(student => {
        return normalizeReg(student.reg) === newReg &&
            normalizeReg(student.reg) !== originalReg;
    });

    if (duplicate) {
        setMessage(
            messageElement,
            "Another student already uses this registration number.",
            "error"
        );
        return;
    }

    const index = students.findIndex(student => {
        return normalizeReg(student.reg) === originalReg;
    });

    if (index === -1) {
        setMessage(
            messageElement,
            "The original student record could not be found.",
            "error"
        );
        return;
    }

    const previousRecord = { ...students[index] };

    students[index] = {
        reg: newReg,
        name: newName,
        marks: newMarks
    };

    if (!saveStudents()) {
        students[index] = previousRecord;
        return;
    }

    setMessage(
        messageElement,
        "Student record updated successfully.",
        "success"
    );

    $("#updateOriginalReg").value = newReg;
    $("#updateLookupReg").value = newReg;

    renderDashboard();
    renderStudentTable();
    renderLinkedList();

    showToast("Student record updated.");
});

$("#cancelUpdate").addEventListener("click", () => {
    $("#updateEditor").classList.add("hidden");
    $("#updateStudentForm").reset();
    $("#updateLookupReg").focus();
});


/* ==========================================
   CONFIRMATION DIALOG
   ========================================== */

function confirmAction(title, message) {
    const dialog = $("#confirmDialog");

    $("#confirmTitle").textContent = title;
    $("#confirmText").textContent = message;

    return new Promise(resolve => {
        pendingConfirmAction = resolve;

        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        } else {
            resolve(window.confirm(message));
            pendingConfirmAction = null;
}
                                      
