
const COURSES = [
  {name:"Computer Science and Engineering",short:"CSE",desc:"Core computing, software engineering and computer systems."},
  {name:"CSE - Artificial Intelligence",short:"CSE-AI",desc:"Artificial intelligence, machine learning and intelligent systems."},
  {name:"CSE - AI & Machine Learning",short:"CSE-AIML",desc:"Machine learning, deep learning and predictive analytics."},
  {name:"CSE - Data Science",short:"CSE-DS",desc:"Data analytics, big data and statistical computing."},
  {name:"CSE - Cyber Security",short:"CSE-CS",desc:"Network security, cryptography and digital forensics."},
  {name:"CSE - Internet of Things",short:"CSE-IOT",desc:"Connected devices, embedded systems and smart technology."},
  {name:"CSE - Cloud Computing",short:"CSE-CC",desc:"Cloud infrastructure, distributed systems and virtualization."},
  {name:"Information Technology",short:"IT",desc:"Information systems, web technologies and enterprise computing."},
  {name:"Electronics and Communication Engineering",short:"ECE",desc:"Electronics, communication systems and embedded technology."},
  {name:"Electrical and Electronics Engineering",short:"EEE",desc:"Electrical systems, power electronics and control engineering."},
  {name:"Mechanical Engineering",short:"ME",desc:"Manufacturing, mechanics and mechanical design."},
  {name:"Civil Engineering",short:"CE",desc:"Structural engineering, construction and infrastructure."},
  {name:"Artificial Intelligence and Data Science",short:"AI&DS",desc:"AI applications, intelligent data processing and analytics."}
];

const SUBJECTS = [
  "Data Structures","Database Management Systems",
  "Mathematics","Computer Networks",
  "Operating Systems","Object Oriented Programming"
];

const STORAGE_KEY = "studyhub_students_v1";
const SETTINGS_KEY = "studyhub_settings_v1";

const $ = id => document.getElementById(id);

function money(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN",{
    maximumFractionDigits:0
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[char]);
}

function initials(name) {
  return String(name || "ST").trim().split(/\s+/)
    .slice(0,2).map(part=>part[0] || "").join("").toUpperCase();
}

function attendancePercentage(record) {
  const held = Number(record.held || 0);
  return held ? Math.round(Number(record.attended || 0) / held * 100) : 0;
}

function gradeFromMarks(marks) {
  const m = Number(marks);
  if(m >= 90) return "A+";
  if(m >= 80) return "A";
  if(m >= 70) return "B";
  if(m >= 60) return "C";
  if(m >= 50) return "D";
  return "F";
}

function statusFromFees(student) {
  if(Number(student.paidFee) >= Number(student.totalFee)) return "Paid";
  if(Number(student.paidFee) > 0) return "Partial";
  return "Pending";
}

function makeId() {
  return "ST" + Date.now().toString(36) +
    Math.random().toString(36).slice(2,6);
}

function createAttendance(seed = 0) {
  const result = {};
  SUBJECTS.forEach((subject,index) => {
    const held = 40 + index * 2;
    const attended = Math.max(0,Math.min(held,
      Math.round(held * (seed ? 0.68 + ((seed + index) % 5)*0.065 : 0.9))
    ));
    result[subject] = {held,attended};
  });
  return result;
}

function sampleStudents() {
  const names = [
    ["Aarav Sharma","251FA19001","CSE", "1st Year",91,9.1,9.0],
    ["Ananya Reddy","251FA19002","CSE-AI", "1st Year",87,8.8,8.7],
    ["Rahul Kumar","241FA19003","CSE-DS", "2nd Year",78,8.0,7.9],
    ["Priya Nair","241FA19004","IT", "2nd Year",94,9.5,9.3],
    ["Arjun Rao","231FA19005","CSE-CS", "3rd Year",68,7.1,7.3],
    ["Sneha Patel","231FA19006","ECE", "3rd Year",83,8.5,8.4],
    ["Karthik Reddy","221FA19007","CSE-AIML", "4th Year",88,9.0,8.9],
    ["Meera Das","221FA19008","EEE", "4th Year",73,7.6,7.8],
    ["Vikram Singh","251FA19009","ME", "1st Year",65,7.0,7.1],
    ["Diya Sharma","241FA19010","CSE-IOT", "2nd Year",96,9.7,9.6]
  ];

  return names.map((n,i) => ({
    id:makeId(),
    name:n[0],
    reg:n[1],
    course:n[2],
    year:n[3],
    marks:n[4],
    sgpa:n[5],
    cgpa:n[6],
    email:n[0].toLowerCase().replace(" ",".")+"@student.edu",
    phone:"9"+String(876543210+i).slice(1),
    gender:i%2 ? "Female":"Male",
    dob:"",
    semester:String((parseInt(n[3][0])-1)*2+1),
    section:["A","B","C"][i%3],
    totalFee:100000,
    paidFee:[100000,75000,50000,100000,25000,85000,100000,50000,0,90000][i],
    attendance:createAttendance(i+1),
    payments:[]
  }));
}

let students = loadStudents();
let performanceChart = null;
let attendanceChart = null;
let courseChart = null;
let toastTimer;

function loadStudents() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(Array.isArray(stored)) return stored;
  } catch(error) {
    console.error("Could not load student records:",error);
  }
  const initial = sampleStudents();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(initial));
  return initial;
}

function saveStudents() {
  localStorage.setItem(STORAGE_KEY,JSON.stringify(students));
}

function persistAndRefresh() {
  saveStudents();
  refreshAll();
}

function showToast(message) {
  $("toastMessage").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>$("toast").classList.remove("show"),2600);
}

function refreshIcons() {
  if(window.lucide) window.lucide.createIcons();
}

function showPage(page) {
  const target = $("page-"+page);
  if(!target) return;

  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  target.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(btn=>{
    btn.classList.toggle("active",btn.dataset.page===page);
  });

  const names = {
    dashboard:"Dashboard",students:"Student Records",
    attendance:"Attendance",academics:"Academic Records",
    fees:"Fee Management",courses:"Courses & Branches",
    reports:"Reports",settings:"Settings"
  };

  $("breadcrumb").textContent = names[page] || page;

  closeSidebar();
  refreshAll();
  refreshIcons();
}

window.showPage = showPage;

function openSidebar() {
  $("sidebar").classList.add("open");
  $("mobileOverlay").classList.add("show");
}

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("mobileOverlay").classList.remove("show");
}

function openModal(id) {
  $(id).classList.add("open");
  refreshIcons();
}

function closeModal(id) {
  $(id).classList.remove("open");
}

window.closeModal = closeModal;

function populateCourseOptions() {
  const options = COURSES.map(c=>
    `<option value="${escapeHTML(c.short)}">${escapeHTML(c.name)}</option>`
  ).join("");

  $("sCourse").innerHTML=options;
  $("courseFilter").innerHTML='<option value="">All Courses</option>'+options;
}

function populateSubjectOptions() {
  $("attendanceSubject").innerHTML =
    '<option value="">All Subjects</option>' +
    SUBJECTS.map(s=>`<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");
}

function studentCell(student) {
  return `<div class="student-cell">
    <div class="student-avatar">${escapeHTML(initials(student.name))}</div>
    <div><strong>${escapeHTML(student.name)}</strong>
    <span>${escapeHTML(student.email || "No email provided")}</span></div>
  </div>`;
}

function attendanceBadge(value) {
  const cls=value>=75?"good":"danger";
  return `<span class="status ${cls}">${value}%</span>`;
}

function feeBadge(student) {
  const status=statusFromFees(student);
  return `<span class="status ${status.toLowerCase()}">${status}</span>`;
}

function getAttendanceAverage(student) {
  const records=Object.values(student.attendance || {});
  if(!records.length) return 0;
  const held=records.reduce((sum,r)=>sum+Number(r.held||0),0);
  const attended=records.reduce((sum,r)=>sum+Number(r.attended||0),0);
  return held?Math.round(attended/held*100):0;
}

function averageAttendance() {
  if(!students.length) return 0;
  return Math.round(students.reduce((sum,s)=>sum+getAttendanceAverage(s),0)/students.length);
}

function getTotals() {
  return {
    totalFee:students.reduce((s,x)=>s+Number(x.totalFee||0),0),
    paid:students.reduce((s,x)=>s+Number(x.paidFee||0),0),
    pending:students.reduce((s,x)=>s+Math.max(0,Number(x.totalFee||0)-Number(x.paidFee||0)),0),
    marks:students.length?students.reduce((s,x)=>s+Number(x.marks||0),0)/students.length:0,
    cgpa:students.length?students.reduce((s,x)=>s+Number(x.cgpa||0),0)/students.length:0
  };
}

// DASHBOARD

function renderDashboard() {
  const t=getTotals();
  const avg=averageAttendance();

  $("totalStudents").textContent=students.length;
  $("averageAttendance").textContent=avg+"%";
  $("feesCollected").textContent=money(t.paid);
  $("pendingFees").textContent=money(t.pending);
  $("chartAttendance").textContent=avg+"%";

  const good=students.filter(s=>getAttendanceAverage(s)>=75).length;
  $("goodCount").textContent=good;
  $("lowCount").textContent=students.length-good;

  $("recentStudents").innerHTML=students.slice(-5).reverse().map(s=>`
    <tr>
      <td>${studentCell(s)}</td>
      <td>${escapeHTML(s.reg)}</td>
      <td>${escapeHTML(s.course)}</td>
      <td>${escapeHTML(s.year)}</td>
      <td>${attendanceBadge(getAttendanceAverage(s))}</td>
      <td><span class="status good">Active</span></td>
    </tr>`).join("") || emptyRow(6);

  renderCharts();
}

function renderCharts() {
  if(!window.Chart) return;

  const perf=$("performanceChart");
  const att=$("attendanceChart");

  if(perf) {
    const ctx=perf.getContext("2d");
    const marks=students.map(s=>Number(s.marks||0));
    if(performanceChart) performanceChart.destroy();
    performanceChart=new Chart(ctx,{
      type:"bar",
      data:{
        labels:students.map(s=>s.name.split(" ")[0]),
        datasets:[{
          label:"Marks",
          data:marks,
          backgroundColor:"#9a81ec",
          borderRadius:6,
          maxBarThickness:24
        }]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          y:{beginAtZero:true,max:100,grid:{color:"#f1eff6"},ticks:{font:{size:10}}},
          x:{grid:{display:false},ticks:{font:{size:9}}}
        }
      }
    });
  }

  if(att) {
    const ctx=att.getContext("2d");
    const good=students.filter(s=>getAttendanceAverage(s)>=75).length;
    if(attendanceChart) attendanceChart.destroy();
    attendanceChart=new Chart(ctx,{
      type:"doughnut",
      data:{
        labels:["Good attendance","Below 75%"],
        datasets:[{
          data:[good,Math.max(0,students.length-good)],
          backgroundColor:["#7655dc","#eeeaf5"],
          borderWidth:0,
          hoverOffset:4
        }]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        cutout:"78%",
        plugins:{legend:{display:false}}
      }
    });
  }

  const courseCanvas=$("courseChart");
  if(courseCanvas && $("page-reports").classList.contains("active")) {
    const counts=COURSES.map(c=>students.filter(s=>s.course===c.short).length);
    if(courseChart) courseChart.destroy();
    courseChart=new Chart(courseCanvas.getContext("2d"),{
      type:"bar",
      data:{
        labels:COURSES.map(c=>c.short),
        datasets:[{
          label:"Students",
          data:counts,
          backgroundColor:"#9a81ec",
          borderRadius:5,
          maxBarThickness:35
        }]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          y:{beginAtZero:true,ticks:{precision:0},grid:{color:"#f1eff6"}},
          x:{grid:{display:false},ticks:{font:{size:9}}}
        }
      }
    });
  }
}

// STUDENT MANAGEMENT

function renderStudents() {
  const query=$("studentSearch").value.trim().toLowerCase();
  const course=$("courseFilter").value;
  const year=$("yearFilter").value;

  const filtered=students.filter(s=>
    (s.name.toLowerCase().includes(query)||s.reg.toLowerCase().includes(query)) &&
    (!course||s.course===course) &&
    (!year||s.year===year)
  );

  $("studentCountLabel").textContent=filtered.length+" student records";

  $("studentsTable").innerHTML=filtered.map(s=>`
    <tr>
      <td>${studentCell(s)}</td>
      <td><strong>${escapeHTML(s.reg)}</strong></td>
      <td>${escapeHTML(s.course)}</td>
      <td>${escapeHTML(s.year)}</td>
      <td>${escapeHTML(s.phone||"—")}</td>
      <td><div class="action-group">
        <button class="action-btn" title="View profile" onclick="viewStudent('${s.id}')"><i data-lucide="eye"></i></button>
        <button class="action-btn" title="Edit" onclick="editStudent('${s.id}')"><i data-lucide="pencil"></i></button>
        <button class="action-btn delete" title="Delete" onclick="deleteStudent('${s.id}')"><i data-lucide="trash-2"></i></button>
      </div></td>
    </tr>`).join("") || emptyRow(6,"No matching students found");

  refreshIcons();
}

function resetFilters() {
  $("studentSearch").value="";
  $("courseFilter").value="";
  $("yearFilter").value="";
  renderStudents();
}

window.resetFilters=resetFilters;

function openStudentModal(id=null) {
  $("studentForm").reset();
  $("editId").value="";
  $("sTotalFee").value=100000;
  $("sPaidFee").value=0;
  $("sMarks").value=0;
  $("sSGPA").value=0;
  $("sCGPA").value=0;
  $("studentModalTitle").textContent=id?"Edit Student":"Add New Student";

  if(id) {
    const s=students.find(x=>x.id===id);
    if(!s) return;
    $("editId").value=s.id;
    $("sName").value=s.name;
    $("sReg").value=s.reg;
    $("sEmail").value=s.email||"";
    $("sPhone").value=s.phone||"";
    $("sGender").value=s.gender||"Not specified";
    $("sDob").value=s.dob||"";
    $("sCourse").value=s.course;
    $("sYear").value=s.year;
    $("sSemester").value=s.semester||"1";
    $("sSection").value=s.section||"";
    $("sMarks").value=s.marks;
    $("sSGPA").value=s.sgpa;
    $("sCGPA").value=s.cgpa;
    $("sTotalFee").value=s.totalFee;
    $("sPaidFee").value=s.paidFee;
  }

  openModal("studentModal");
}

window.openStudentModal=openStudentModal;

$("studentForm").addEventListener("submit",e=>{
  e.preventDefault();

  const id=$("editId").value;
  const reg=$("sReg").value.trim();
  const existing=students.find(s=>s.reg.toLowerCase()===reg.toLowerCase()&&s.id!==id);

  if(existing) {
    showToast("This registration number already exists.");
    return;
  }

  const totalFee=Number($("sTotalFee").value);
  const paidFee=Number($("sPaidFee").value);
  const marks=Number($("sMarks").value);
  const sgpa=Number($("sSGPA").value);
  const cgpa=Number($("sCGPA").value);

  if(totalFee<0||paidFee<0||paidFee>totalFee) {
    showToast("Please check the fee amounts.");
    return;
  }

  if(marks<0||marks>100||sgpa<0||sgpa>10||cgpa<0||cgpa>10) {
    showToast("Please enter valid academic values.");
    return;
  }

  const record={
    id:id||makeId(),
    name:$("sName").value.trim(),
    reg,
    email:$("sEmail").value.trim(),
    phone:$("sPhone").value.trim(),
    gender:$("sGender").value,
    dob:$("sDob").value,
    course:$("sCourse").value,
    year:$("sYear").value,
    semester:$("sSemester").value,
    section:$("sSection").value.trim(),
    marks,sgpa,cgpa,totalFee,paidFee,
    attendance:id?students.find(s=>s.id===id).attendance:createAttendance(),
    payments:id?students.find(s=>s.id===id).payments||[]:[]
  };

  if(id) {
    students=students.map(s=>s.id===id?record:s);
    showToast("Student record updated successfully.");
  } else {
    students.push(record);
    showToast("New student registered successfully.");
  }

  closeModal("studentModal");
  persistAndRefresh();
});

function editStudent(id) {
  openStudentModal(id);
}
window.editStudent=editStudent;

function deleteStudent(id) {
  const s=students.find(x=>x.id===id);
  if(!s) return;
  if(!confirm("Delete the student record of "+s.name+"? This action cannot be undone.")) return;
  students=students.filter(x=>x.id!==id);
  persistAndRefresh();
  showToast("Student record deleted.");
}
window.deleteStudent=deleteStudent;

function viewStudent(id) {
  const s=students.find(x=>x.id===id);
  if(!s) return;

  $("profileContent").innerHTML=`
    <div class="profile-hero">
      <div class="student-avatar">${escapeHTML(initials(s.name))}</div>
      <div><h3>${escapeHTML(s.name)}</h3>
      <p>${escapeHTML(s.reg)} · ${escapeHTML(s.course)}</p></div>
    </div>
    <div class="profile-section">Personal Information</div>
    <div class="profile-details">
      ${detail("Email",s.email||"Not provided")}
      ${detail("Phone",s.phone||"Not provided")}
      ${detail("Gender",s.gender)}
      ${detail("Date of Birth",s.dob||"Not provided")}
    </div>
    <div class="profile-section">Academic Information</div>
    <div class="profile-details">
      ${detail("Course",s.course)}
      ${detail("Year",s.year)}
      ${detail("Semester",s.semester)}
      ${detail("Section",s.section||"—")}
      ${detail("Marks",s.marks+"/100")}
      ${detail("Grade",gradeFromMarks(s.marks))}
      ${detail("SGPA",Number(s.sgpa).toFixed(2))}
      ${detail("CGPA",Number(s.cgpa).toFixed(2))}
      ${detail("Attendance",getAttendanceAverage(s)+"%")}
    </div>
    <div class="profile-section">Fee Information</div>
    <div class="profile-details">
      ${detail("Total Fees",money(s.totalFee))}
      ${detail("Paid Fees",money(s.paidFee))}
      ${detail("Balance",money(Math.max(0,s.totalFee-s.paidFee)))}
      ${detail("Payment Status",statusFromFees(s))}
    </div>
    <div class="modal-actions">
      <button class="outline-button" onclick="closeModal('profileModal')">Close</button>
      <button class="primary-button" onclick="closeModal('profileModal');editStudent('${s.id}')">Edit Record</button>
    </div>`;
  openModal("profileModal");
}
window.viewStudent=viewStudent;

function detail(label,value) {
  return `<div class="detail-item"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
}

// ATTENDANCE MANAGEMENT

function renderAttendance() {
  const query=$("attendanceSearch").value.toLowerCase().trim();
  const subject=$("attendanceSubject").value;
  let rows=[];

  students.forEach(s=>{
    Object.entries(s.attendance||{}).forEach(([sub,record])=>{
      if((!subject||sub===subject) &&
         (s.name.toLowerCase().includes(query)||s.reg.toLowerCase().includes(query))) {
        rows.push({s,sub,record});
      }
    });
  });

  $("attendanceTable").innerHTML=rows.map(({s,sub,record})=>{
    const pct=attendancePercentage(record);
    return `<tr>
      <td>${studentCell(s)}</td>
      <td>${escapeHTML(sub)}</td>
      <td>${record.held}</td>
      <td>${record.attended}</td>
      <td>${attendanceBadge(pct)}</td>
      <td><button class="action-btn" title="Update attendance" onclick="editAttendance('${s.id}','${encodeURIComponent(sub)}')"><i data-lucide="pencil"></i></button></td>
    </tr>`;
  }).join("")||emptyRow(6,"No attendance records found");

  const avg=averageAttendance();
  $("attAverage").textContent=avg+"%";
  $("attGood").textContent=students.filter(s=>getAttendanceAverage(s)>=75).length;
  $("attLow").textContent=students.filter(s=>getAttendanceAverage(s)<75).length;
  refreshIcons();
}

function editAttendance(id,encodedSubject) {
  const s=students.find(x=>x.id===id);
  const subject=decodeURIComponent(encodedSubject);
  if(!s) return;
  const record=s.attendance[subject]||{held:0,attended:0};
  $("attStudentId").value=id;
  $("attSubject").value=subject;
  $("attSubjectDisplay").value=s.name+" — "+subject;
  $("attHeld").value=record.held;
  $("attAttended").value=record.attended;
  openModal("attendanceModal");
}
window.editAttendance=editAttendance;

$("attendanceForm").addEventListener("submit",e=>{
  e.preventDefault();
  const id=$("attStudentId").value;
  const subject=$("attSubject").value;
  const held=Number($("attHeld").value);
  const attended=Number($("attAttended").value);

  if(held<0||attended<0||attended>held) {
    showToast("Attended classes cannot exceed classes held.");
    return;
  }

  const s=students.find(x=>x.id===id);
  if(!s) return;
  s.attendance[subject]={held,attended};
  closeModal("attendanceModal");
  persistAndRefresh();
  showToast("Attendance updated successfully.");
});

// ACADEMICS

function renderAcademics() {
  const query=$("academicSearch").value.toLowerCase().trim();
  const filtered=students.filter(s=>
    s.name.toLowerCase().includes(query)||s.reg.toLowerCase().includes(query)
  );

  $("academicsTable").innerHTML=filtered.map(s=>`
    <tr>
      <td>${studentCell(s)}</td>
      <td>${escapeHTML(s.reg)}</td>
      <td>${escapeHTML(s.course)}</td>
      <td><strong>${s.marks}/100</strong></td>
      <td><span class="status ${s.marks>=50?"good":"danger"}">${gradeFromMarks(s.marks)}</span></td>
      <td>${Number(s.sgpa).toFixed(2)}</td>
      <td>${Number(s.cgpa).toFixed(2)}</td>
      <td><button class="action-btn" title="Update academic record" onclick="editStudent('${s.id}')"><i data-lucide="pencil"></i></button></td>
    </tr>`).join("")||emptyRow(8);

  const t=getTotals();
  $("avgMarks").textContent=t.marks.toFixed(1);
  $("avgCGPA").textContent=t.cgpa.toFixed(2);
  $("evaluatedCount").textContent=students.length;
  refreshIcons();
}
window.renderAcademics=renderAcademics;

// FEES

function renderFees() {
  const query=$("feeSearch").value.toLowerCase().trim();
  const filter=$("feeFilter").value;
  const filtered=students.filter(s=>
    (s.name.toLowerCase().includes(query)||s.reg.toLowerCase().includes(query)) &&
    (!filter||statusFromFees(s)===filter)
  );

  $("feesTable").innerHTML=filtered.map(s=>`
    <tr>
      <td>${studentCell(s)}</td>
      <td>${escapeHTML(s.reg)}</td>
      <td>${money(s.totalFee)}</td>
      <td><strong>${money(s.paidFee)}</strong></td>
      <td>${money(Math.max(0,s.totalFee-s.paidFee))}</td>
      <td>${feeBadge(s)}</td>
      <td><button class="action-btn" title="Record payment" onclick="openFeeModal('${s.id}')"><i data-lucide="plus"></i></button></td>
    </tr>`).join("")||emptyRow(7);

  const t=getTotals();
  $("totalFeeAmount").textContent=money(t.totalFee);
  $("receivedFeeAmount").textContent=money(t.paid);
  $("outstandingFeeAmount").textContent=money(t.pending);
  refreshIcons();
}

function openFeeModal(id) {
  const s=students.find(x=>x.id===id);
  if(!s) return;
  const balance=Math.max(0,s.totalFee-s.paidFee);
  $("feeStudentId").value=id;
  $("feeStudentInfo").innerHTML=`
    <strong>${escapeHTML(s.name)}</strong><br>
    ${escapeHTML(s.reg)}<br>
    Total: ${money(s.totalFee)} · Paid: ${money(s.paidFee)} ·
    <strong>Balance: ${money(balance)}</strong>`;
  $("feePayment").value="";
  $("feePayment").max=balance;
  $("feePayment").placeholder="Maximum "+balance;
  $("feeDate").value=new Date().toISOString().slice(0,10);
  $("feeReference").value="";
  openModal("feeModal");
}
window.openFeeModal=openFeeModal;

$("feeForm").addEventListener("submit",e=>{
  e.preventDefault();
  const id=$("feeStudentId").value;
  const amount=Number($("feePayment").value);
  const s=students.find(x=>x.id===id);
  if(!s||amount<=0) {
    showToast("Enter a valid payment amount.");
    return;
  }
  const balance=Math.max(0,s.totalFee-s.paidFee);
  if(amount>balance) {
    showToast("Payment exceeds the outstanding balance.");
    return;
  }

  s.paidFee=Number(s.paidFee)+amount;
  s.payments=s.payments||[];
  s.payments.push({
    amount,
    date:$("feeDate").value,
    reference:$("feeReference").value.trim()
  });

  closeModal("feeModal");
  persistAndRefresh();
  showToast("Payment recorded successfully.");
});

// COURSES

function renderCourses() {
  $("courseGrid").innerHTML=COURSES.map(c=>{
    const count=students.filter(s=>s.course===c.short).length;
    return `<div class="course-card">
      <div class="course-symbol"><i data-lucide="graduation-cap"></i></div>
      <h3>${escapeHTML(c.name)}</h3>
      <p>${escapeHTML(c.desc)}</p>
      <div class="course-meta"><span>Enrolled students</span><strong>${count}</strong></div>
    </div>`;
  }).join("");
  refreshIcons();
}

// REPORTS

function renderReports() {
  const t=getTotals();
  $("reportStudents").textContent=students.length;
  $("reportMarks").textContent=t.marks.toFixed(1);
  $("reportFees").textContent=money(t.paid);
  $("reportAttendance").textContent=averageAttendance()+"%";
  renderCharts();
}

// SETTINGS

function saveSettings() {
  const settings={
    institution:$("institutionName").value.trim(),
    year:$("academicYear").value.trim()
  };
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
  showToast("Portal settings saved.");
}

function loadSettings() {
  try {
    const s=JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if(s) {
      $("institutionName").value=s.institution||"STUDYHUB Academic Institution";
      $("academicYear").value=s.year||"2026-27";
    }
  } catch(e) {}
  $("settingsStudentCount").textContent=students.length;
}

window.saveSettings=saveSettings;

function exportCSV() {
  if(!students.length) {
    showToast("There are no student records to export.");
    return;
  }

  const columns=[
    "Name","Registration Number","Email","Phone","Gender",
    "Course","Year","Semester","Section","Marks","Grade",
    "SGPA","CGPA","Attendance (%)","Total Fees","Paid Fees",
    "Balance","Fee Status"
  ];

  const rows=students.map(s=>[
    s.name,s.reg,s.email,s.phone,s.gender,s.course,s.year,
    s.semester,s.section,s.marks,gradeFromMarks(s.marks),
    s.sgpa,s.cgpa,getAttendanceAverage(s),s.totalFee,s.paidFee,
    Math.max(0,s.totalFee-s.paidFee),statusFromFees(s)
  ]);

  const csv=[columns,...rows].map(row=>
    row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")
  ).join("\r\n");

  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="STUDYHUB_Student_Records.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Student data exported successfully.");
}
window.exportCSV=exportCSV;

function resetData() {
  if(!confirm("Restore the original sample records? Your current student data will be replaced.")) return;
  students=sampleStudents();
  persistAndRefresh();
  showToast("Sample records restored.");
}
window.resetData=resetData;

function emptyRow(columns,message="No records available") {
  return `<tr><td colspan="${columns}" style="text-align:center;padding:30px;color:#aaa6b5">${escapeHTML(message)}</td></tr>`;
}

// GLOBAL REFRESH

function refreshAll() {
  renderDashboard();
  renderStudents();
  renderAttendance();
  renderAcademics();
  renderFees();
  renderCourses();
  renderReports();
  loadSettings();
  refreshIcons();
}

function initializeApp() {
  populateCourseOptions();
  populateSubjectOptions();

  $("currentDate").textContent=new Intl.DateTimeFormat("en-IN",{
    day:"numeric",month:"short",year:"numeric"
  }).format(new Date());

  document.querySelectorAll(".nav-link").forEach(btn=>{
    btn.addEventListener("click",()=>showPage(btn.dataset.page));
  });

  $("menuToggle").addEventListener("click",openSidebar);
  $("closeSidebar").addEventListener("click",closeSidebar);
  $("mobileOverlay").addEventListener("click",closeSidebar);

  document.querySelectorAll(".modal-overlay").forEach(modal=>{
    modal.addEventListener("click",e=>{
      if(e.target===modal) modal.classList.remove("open");
    });
  });

  document.addEventListener("keydown",e=>{
    if(e.key==="Escape") {
      document.querySelectorAll(".modal-overlay.open").forEach(m=>m.classList.remove("open"));
      closeSidebar();
    }
  });

  loadSettings();
  refreshAll();
  showPage("dashboard");
}

initializeApp();
