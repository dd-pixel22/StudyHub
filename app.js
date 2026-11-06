const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- Singly linked list ---------- */
class Node{constructor(reg,name,marks,course){this.reg=reg;this.name=name;this.marks=marks;this.course=course;this.next=null}}
let head=null;
const toArray=()=>{const a=[];for(let p=head;p;p=p.next)a.push(p);return a};
function addNode(reg,name,marks,course){const n=new Node(reg,name,marks,course);if(!head){head=n;return}let p=head;while(p.next)p=p.next;p.next=n}
function findNode(reg){let p=head,steps=0;while(p){steps++;if(p.reg.toLowerCase()===reg.toLowerCase())return{p,steps};p=p.next}return{p:null,steps}}
function deleteNode(reg){let p=head,prev=null;while(p&&p.reg.toLowerCase()!==reg.toLowerCase()){prev=p;p=p.next}
  if(!p)return null;if(prev)prev.next=p.next;else head=p.next;return p}
function save(){try{localStorage.setItem('srms',JSON.stringify(toArray().map(({reg,name,marks,course})=>({reg,name,marks,course}))))}catch(e){}}
function load(){let d=null;try{d=JSON.parse(localStorage.getItem('srms'))}catch(e){}
  if(!Array.isArray(d))d=[{reg:'21BCE1001',name:'Aarav Sharma',marks:88,course:'CSECS'},{reg:'21BCE1017',name:'Meera Reddy',marks:74.5,course:'AIML'},{reg:'21BCE1042',name:'Rohan Iyer',marks:36,course:'CSBS'},{reg:'21BCE1058',name:'Sana Khan',marks:92,course:'DS'}];
  head=null;d.forEach(s=>addNode(s.reg,s.name,s.marks,s.course||'–'))}

/* ---------- Theme ---------- */
function setTheme(t){document.documentElement.dataset.theme=t;
  $('themeBtn').textContent=t==='dark'?'☀️ Light mode':'🌙 Dark mode';
  try{localStorage.setItem('srms-theme',t)}catch(e){}}
let theme='dark';try{theme=localStorage.getItem('srms-theme')||'dark'}catch(e){}
setTheme(theme);
$('themeBtn').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));

/* ---------- UI ---------- */
let tt;function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2400)}
const pass=m=>m>=40?'<span class="tag pass">Pass</span>':'<span class="tag fail">Fail</span>';
const titles={dashboard:['Welcome back, Student! 👋','Here’s what’s happening with your records.'],add:['Add Student','Create a new node at the end of the list.'],search:['Search','Find a student by registration number.'],delete:['Delete','Remove a student record from the list.'],records:['All Records','Every node, from head to NULL.'],source:['C Source','The command-line version of this project.'],exit:['Goodbye','Thanks for using the system.']};
function go(p){location.hash=p}
function route(){const p=titles[location.hash.slice(1)]?location.hash.slice(1):'dashboard';
  document.querySelectorAll('.page').forEach(s=>s.classList.toggle('on',s.id===p));
  document.querySelectorAll('nav a').forEach(a=>{a.classList.toggle('on',a.dataset.p===p);a.toggleAttribute('aria-current',a.dataset.p===p)});
  $('ttl').textContent=titles[p][0];$('sub').textContent=titles[p][1];render();window.scrollTo(0,0)}
addEventListener('hashchange',route);

function render(){
  const a=toArray(),n=a.length,sum=a.reduce((s,x)=>s+x.marks,0),top=a.reduce((b,x)=>!b||x.marks>b.marks?x:b,null);
  $('s1').textContent=n;$('s2').textContent=n?(sum/n).toFixed(1):0;$('s3').textContent=top?top.marks:0;$('s3n').textContent=top?top.name:'No data yet';
  $('s4').textContent=n?Math.round(a.filter(x=>x.marks>=40).length/n*100)+'%':'0%';
  $('recent').innerHTML=n?a.slice(-4).reverse().map(x=>`<div class="row"><span class="dot"></span><div>${esc(x.name)}<small>${esc(x.reg)} · ${esc(x.course)}</small></div><em>${x.marks}</em></div>`).join(''):'<div class="empty">No students yet.</div>';
  const bands=[['0–39',0,39.99],['40–59',40,59.99],['60–79',60,79.99],['80–100',80,100]],c=bands.map(b=>a.filter(x=>x.marks>=b[1]&&x.marks<=b[2]).length),mx=Math.max(1,...c);
  $('bars').innerHTML=bands.map((b,i)=>`<div>${c[i]}<i style="height:${c[i]/mx*100}%"></i>${b[0]}</div>`).join('');
  $('chain').innerHTML='<span class="head">HEAD</span><span class="arr">→</span>'+(n?a.map(x=>`<span class="nd"><b>${esc(x.reg)}</b><b>next</b></span><span class="arr">→</span>`).join(''):'')+'<span class="nul">NULL</span>';
  $('tb').innerHTML=a.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.reg)}</td><td>${esc(x.name)}</td><td>${esc(x.course)}</td><td>${x.marks}</td><td>${pass(x.marks)}</td><td><button class="x" data-del="${esc(x.reg)}" aria-label="Delete ${esc(x.name)}">Delete</button></td></tr>`).join('');
  $('none').hidden=n>0;$('tb').closest('.tw').hidden=n===0}
$('tb').addEventListener('click',e=>{const r=e.target.dataset.del;if(r&&confirm('Delete record '+r+'?')){deleteNode(r);save();render();toast('Record deleted')}});

$('fAdd').addEventListener('submit',e=>{e.preventDefault();
  const reg=$('aReg').value.trim(),name=$('aName').value.trim(),course=$('aCourse').value,m=$('aMarks').value.trim(),marks=Number(m);
  if(!reg||!name||!course||m===''){return toast('Fill in all fields and select a course')}
  if(isNaN(marks)||marks<0||marks>100){return toast('Marks must be between 0 and 100')}
  if(findNode(reg).p){return toast('That registration number already exists')}
  addNode(reg,name,marks,course);save();e.target.reset();toast('Student added');$('aReg').focus()});

$('fSearch').addEventListener('submit',e=>{e.preventDefault();const q=$('qReg').value.trim();if(!q)return toast('Enter a registration number');
  const {p,steps}=findNode(q);
  $('qOut').innerHTML=p?`<div class="card result found"><h3>Record found</h3><div class="kv"><span>Reg. no.</span>${esc(p.reg)}<span>Name</span>${esc(p.name)}<span>Course</span>${esc(p.course)}<span>Marks</span>${p.marks} ${pass(p.marks)}<span>Position</span>Node ${steps}, found after ${steps} comparison${steps>1?'s':''}</div></div>`
  :`<div class="card result miss"><h3>No match</h3><p class="panel-note" style="margin:0">No student has the registration number “${esc(q)}”. All ${steps} node${steps===1?'':'s'} were checked.</p></div>`});

$('fDel').addEventListener('submit',e=>{e.preventDefault();const q=$('dReg').value.trim();if(!q)return toast('Enter a registration number');
  const d=deleteNode(q);if(d){save();$('dOut').innerHTML=`<div class="card result found"><h3>Record deleted</h3><p class="panel-note" style="margin:0">${esc(d.name)} (${esc(d.reg)}) was unlinked from the list.</p></div>`;e.target.reset();toast('Record deleted')}
  else $('dOut').innerHTML=`<div class="card result miss"><h3>Nothing deleted</h3><p class="panel-note" style="margin:0">No student has the registration number “${esc(q)}”.</p></div>`});

$('code').textContent=`#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct Student {
    char reg[20];
    char name[50];
    char course[10];   /* CSECS, AIML, CSBS or DS */
    float marks;
    struct Student *next;
};
struct Student *head = NULL;

void addStudent() {
    struct Student *n = malloc(sizeof(struct Student)), *p;
    printf("Reg no: ");  scanf("%19s", n->reg);
    printf("Name: ");    scanf(" %49[^\\n]", n->name);
    printf("Course (CSECS/AIML/CSBS/DS): "); scanf("%9s", n->course);
    printf("Marks: ");   scanf("%f", &n->marks);
    n->next = NULL;
    if (!head) { head = n; return; }
    for (p = head; p->next; p = p->next);
    p->next = n;
}

void searchStudent() {
    char r[20]; struct Student *p = head;
    printf("Reg no: "); scanf("%19s", r);
    for (; p; p = p->next)
        if (strcmp(p->reg, r) == 0) {
            printf("%s | %s | %s | %.1f\\n", p->reg, p->name, p->course, p->marks);
            return;
        }
    printf("Not found.\\n");
}

void deleteStudent() {
    char r[20]; struct Student *p = head, *prev = NULL;
    printf("Reg no: "); scanf("%19s", r);
    while (p && strcmp(p->reg, r) != 0) { prev = p; p = p->next; }
    if (!p) { printf("Not found.\\n"); return; }
    if (prev) prev->next = p->next; else head = p->next;
    free(p);
    printf("Deleted.\\n");
}

void displayAll() {
    struct Student *p = head;
    if (!p) { printf("List is empty.\\n"); return; }
    for (; p; p = p->next)
        printf("%s | %s | %s | %.1f\\n", p->reg, p->name, p->course, p->marks);
}

int main() {
    int c;
    do {
        printf("\\n1.Add 2.Search 3.Delete 4.Display 5.Exit\\nChoice: ");
        scanf("%d", &c);
        switch (c) {
            case 1: addStudent();    break;
            case 2: searchStudent(); break;
            case 3: deleteStudent(); break;
            case 4: displayAll();    break;
            case 5: printf("Goodbye!\\n"); break;
            default: printf("Invalid choice.\\n");
        }
    } while (c != 5);
    return 0;
}`;

load();route();
