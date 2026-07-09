/* ==================================================
   IRON MIND TRACKER
   PART 1
   Dashboard + Subjects + Storage + Progress Circle
================================================== */

/* ================= SUBJECTS ================= */

// Start with no built-in subjects. If the app has previously stored
// subjects we'll clear them once so the user gets a clean slate and
// can re-create subjects using the Add Subject button.
const DEFAULT_SUBJECTS = [];

// One-time reset: if the reset flag is not present, remove any stored
// subjects and mark reset as done. This prevents repeatedly erasing
// user data on every page load while still removing pre-built subjects
// now that the app is being published.
if(!localStorage.getItem('ironMindResetDone')){
    localStorage.removeItem('ironMindSubjects');
    localStorage.setItem('ironMindResetDone','1');
}

let subjects =
    JSON.parse(localStorage.getItem("ironMindSubjects"))
    || DEFAULT_SUBJECTS;

/* ================= STORAGE ================= */

let tasks =
    JSON.parse(localStorage.getItem("ironMindTasks"))
    || [];

/* ================= GLOBAL VARIABLES ================= */

let currentSubject = null;
let editingSubjectIndex = null;

/* ================= ELEMENTS ================= */

const homePage =
    document.getElementById("homePage");

const subjectPage =
    document.getElementById("subjectPage");

const subjectGrid =
    document.getElementById("subjectGrid");

const subjectTitle =
    document.getElementById("subjectTitle");

const subjectProgress =
    document.getElementById("subjectProgress");

const taskContainer =
    document.getElementById("taskContainer");

const backButton =
    document.getElementById("backButton");

const notCompletedCount =
    document.getElementById("notCompletedCount");

const todayStats =
    document.getElementById("todayStats");

const progressCanvas =
    document.getElementById("progressCanvas");
const addSubjectButton =
    document.getElementById("addSubjectButton");

const subjectModal =
    document.getElementById("subjectModal");

const subjectNameInput =
    document.getElementById("subjectNameInput");

const subjectPriorityInputs =
    document.querySelectorAll("input[name='subjectPriority']");

const saveSubjectBtn =
    document.getElementById("saveSubjectBtn");

const subjectModalTitle =
    document.getElementById("subjectModalTitle");

const deleteConfirmModal =
    document.getElementById("deleteConfirmModal");

const deleteConfirmMessage =
    document.getElementById("deleteConfirmMessage");

const confirmDeleteBtn =
    document.getElementById("confirmDeleteBtn");

const cancelDeleteBtn =
    document.getElementById("cancelDeleteBtn");

let pendingDeleteCallback = null;
let editingTaskId = null;

function updatePrioritySelection(){
    subjectPriorityInputs.forEach(input => {
        const label = input.closest("label");
        if(!label) return;
        if(input.checked){
            label.classList.add("selected");
        } else {
            label.classList.remove("selected");
        }
    });
}

subjectPriorityInputs.forEach(input => {
    input.addEventListener("change", updatePrioritySelection);
});

const cancelSubjectBtn =
    document.getElementById("cancelSubjectBtn");
/* ================= SAVE ================= */

function saveTasks(){

    localStorage.setItem(
        "ironMindTasks",
        JSON.stringify(tasks)
    );
}

function saveSubjects(){

    localStorage.setItem(
        "ironMindSubjects",
        JSON.stringify(subjects)
    );
}
/* ================= DATE HELPERS ================= */

function getTodayDate(){

    const today = new Date();

    const day =
        String(today.getDate()).padStart(2,"0");

    const month =
        String(today.getMonth()+1).padStart(2,"0");

    const year =
        today.getFullYear();

    return `${day}-${month}-${year}`;
}

function formatDate(inputDate){

    if(!inputDate) return "";

    const dateObj = new Date(inputDate);

    const day =
        String(dateObj.getDate()).padStart(2,"0");

    const month =
        String(dateObj.getMonth()+1).padStart(2,"0");

    const year =
        dateObj.getFullYear();

    return `${day}-${month}-${year}`;
}

/* ================= SUBJECT BUTTONS ================= */

function getPriorityRank(priority){

    if(priority === "high") return 1;

    if(priority === "core") return 2;

    return 3;
}

function closeAllSubjectMenus(){
    document.querySelectorAll(".subject-menu").forEach(menu => {
        menu.classList.add("hidden");
    });
}

function buildSubjects(){

    subjectGrid.innerHTML = "";

    const sortedSubjects =
        subjects.map((subject,index)=>({
            ...subject,
            originalIndex: index
        })).sort(
            (a,b)=>
                getPriorityRank(a.priority)
                - getPriorityRank(b.priority)
        );

    sortedSubjects.forEach(subject=>{

        const subjectItem =
            document.createElement("div");
        subjectItem.classList.add("subject-item");

        const button =
            document.createElement("button");

        button.classList.add(
            "subject-btn",
            subject.priority
        );

        button.textContent =
            subject.name;

        button.addEventListener(
            "click",
            ()=>{
                openSubjectPage(
                    subject.name
                );
            }
        );

        const actionContainer =
            document.createElement("div");
        actionContainer.classList.add(
            "subject-action"
        );

        const menuButton =
            document.createElement("button");
        menuButton.type = "button";
        menuButton.classList.add(
            "subject-menu-btn"
        );
        menuButton.textContent = "⋮";
        menuButton.addEventListener("click", event => {
            event.stopPropagation();
            closeAllSubjectMenus();
            subjectMenu.classList.toggle("hidden");
        });

        const subjectMenu =
            document.createElement("div");
        subjectMenu.classList.add(
            "subject-menu",
            "hidden"
        );

        const createMenuItem = (text, action) => {
            const item = document.createElement("button");
            item.type = "button";
            item.classList.add("subject-menu-item");
            item.textContent = text;
            item.addEventListener("click", event => {
                event.stopPropagation();
                closeAllSubjectMenus();
                action();
            });
            return item;
        };

        subjectMenu.appendChild(createMenuItem("Edit", () => {
            openEditSubjectModal(subject.originalIndex);
        }));

        subjectMenu.appendChild(createMenuItem("Delete", () => {
            openDeleteConfirmModal(
                () => deleteSubject(subject.originalIndex),
                `Are you sure you want to delete "${subject.name}"?`
            );
        }));

        subjectMenu.appendChild(createMenuItem("Cancel", () => {
            closeAllSubjectMenus();
        }));

        actionContainer.appendChild(menuButton);
        actionContainer.appendChild(subjectMenu);

        subjectItem.appendChild(button);
        subjectItem.appendChild(actionContainer);

        subjectGrid.appendChild(subjectItem);

    });

}

/* ================= SUBJECT PAGE ================= */

function openSubjectPage(subjectName){

    currentSubject = subjectName;

    homePage.classList.add("hidden");

    subjectPage.classList.remove("hidden");

    subjectTitle.textContent =
        subjectName;

    updateSubjectStats();

    if(typeof renderTasks === "function"){
        renderTasks();
    }
}

function updateAddTaskButtonLayout(taskCount = 0){

    if(!subjectHeader){
        return;
    }

    subjectHeader.classList.toggle(
        "empty-state",
        taskCount === 0
    );
}

function goHome(){

    subjectPage.classList.add("hidden");

    homePage.classList.remove("hidden");

    refreshDashboard();
}

/* ================= SUBJECT STATS ================= */

function getSubjectStats(subjectName){

    const subjectTasks =
        tasks.filter(
            t => t.subject === subjectName
        );

    const total =
        subjectTasks.length;

    const completed =
        subjectTasks.filter(
            t => t.status === "Completed"
        ).length;

    let progress = 0;

    if(total > 0){

        progress =
            Math.round(
                (completed / total) * 100
            );
    }

    return {
        total,
        completed,
        progress
    };
}

function updateSubjectStats(){

    if(!currentSubject) return;

    const stats =
        getSubjectStats(
            currentSubject
        );

    subjectProgress.textContent =
        `Progress: ${stats.progress}% (${stats.completed}/${stats.total} Completed)`;
}

/* ================= GLOBAL STATS ================= */

function getGlobalStats(){

    const total =
        tasks.length;

    const completed =
        tasks.filter(
            t => t.status === "Completed"
        ).length;

    const notCompleted =
        tasks.filter(
            t => t.status === "Not Completed"
        ).length;

    let progress = 0;

    if(total > 0){

        progress =
            Math.round(
                (completed / total) * 100
            );
    }

    return {
        total,
        completed,
        progress,
        notCompleted
    };
}

/* ================= TODAY STATS ================= */

function getTodayStats(){

    const today =
        getTodayDate();

    const todayTasks =
        tasks.filter(
            t => t.task_date === today
        );

    const total =
        todayTasks.length;

    const completed =
        todayTasks.filter(
            t => t.status === "Completed"
        ).length;

    let progress = 0;

    if(total > 0){

        progress =
            Math.round(
                (completed / total) * 100
            );
    }

    return {
        total,
        completed,
        progress
    };
}

/* ================= PROGRESS CIRCLE ================= */

function drawProgressCircle(progress){

    const ctx =
        progressCanvas.getContext("2d");

    ctx.clearRect(
        0,
        0,
        progressCanvas.width,
        progressCanvas.height
    );

    const centerX = 85;
    const centerY = 85;

    const radius = 60;

    /* BASE RING */

    ctx.beginPath();
    ctx.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
    );

    ctx.lineWidth = 14;
    ctx.strokeStyle = "#1e293b";
    ctx.stroke();

    let color = "#22c55e";

    if(progress < 40){

        color = "#ef4444";
    }
    else if(progress < 75){

        color = "#facc15";
    }

    const endAngle =
        ((progress / 100) * 2 * Math.PI)
        - Math.PI/2;

    ctx.beginPath();

    ctx.arc(
        centerX,
        centerY,
        radius,
        -Math.PI/2,
        endAngle
    );

    ctx.lineWidth = 12;
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "bold 26px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
        progress + "%",
        centerX,
        centerY - 5
    );

    ctx.fillStyle = "#9ca3af";
    ctx.font = "12px Arial";

    ctx.fillText(
        "Progress",
        centerX,
        centerY + 22
    );
}

/* ================= DASHBOARD ================= */

function refreshDashboard(){

    const today =
        getTodayStats();

    const global =
        getGlobalStats();

    todayStats.textContent =
        `Today: ${today.completed}/${today.total}`;

    notCompletedCount.textContent =
        global.notCompleted;

    drawProgressCircle(
        today.progress
    );
}
function openSubjectModal(){

    closeAllSubjectMenus();
    editingSubjectIndex = null;

    subjectModalTitle.textContent = "Add Subject";
    saveSubjectBtn.textContent = "Create";

    subjectNameInput.value = "";

    subjectPriorityInputs.forEach(input => {
        input.checked = input.value === "high";
    });

    updatePrioritySelection();

    subjectModal.classList.remove("hidden");
}

function openEditSubjectModal(index){

    closeAllSubjectMenus();
    editingSubjectIndex = index;

    const subject = subjects[index];

    subjectModalTitle.textContent = "Edit Subject";
    saveSubjectBtn.textContent = "Save";

    subjectNameInput.value = subject.name;

    subjectPriorityInputs.forEach(input => {
        input.checked = input.value === subject.priority;
    });

    updatePrioritySelection();

    subjectModal.classList.remove("hidden");
}

function closeSubjectModal(){

    subjectModal.classList.add("hidden");
}

function openDeleteConfirmModal(action, message){
    closeAllSubjectMenus();
    pendingDeleteCallback = action;
    deleteConfirmMessage.textContent = message;
    deleteConfirmModal.classList.remove("hidden");
}

function closeDeleteConfirmModal(){
    pendingDeleteCallback = null;
    deleteConfirmModal.classList.add("hidden");
}

confirmDeleteBtn.addEventListener("click", () => {
    if(typeof pendingDeleteCallback === "function"){
        pendingDeleteCallback();
    }
    closeDeleteConfirmModal();
});

cancelDeleteBtn.addEventListener("click", () => {
    closeDeleteConfirmModal();
});

function getSelectedSubjectPriority(){

    const selected = [...subjectPriorityInputs].find(
        input => input.checked
    );

    return selected ? selected.value : "high";
}

function saveSubject(){

    const subjectName =
        subjectNameInput.value.trim();

    const subjectPriority =
        getSelectedSubjectPriority();

    if(subjectName === ""){

        alert("Subject name is required.");
        return;
    }

    const alreadyExists =
        subjects.some((subject, index) =>
            index !== editingSubjectIndex &&
            subject.name.toLowerCase() ===
            subjectName.toLowerCase()
        );

    if(alreadyExists){

        alert("This subject already exists.");
        return;
    }

    if(editingSubjectIndex !== null){

        const oldName =
            subjects[editingSubjectIndex].name;

        subjects[editingSubjectIndex] = {
            name: subjectName,
            priority: subjectPriority
        };

        tasks = tasks.map(task => {
            if(task.subject === oldName){
                return {
                    ...task,
                    subject: subjectName
                };
            }
            return task;
        });

        saveTasks();

        if(currentSubject === oldName){
            currentSubject = subjectName;
            subjectTitle.textContent = subjectName;
        }
    } else {

        subjects.push({
            name: subjectName,
            priority: subjectPriority
        });
    }

    saveSubjects();

    closeSubjectModal();

    buildSubjects();

    if(currentSubject){
        renderTasks();
        updateSubjectStats();
    }
}

function deleteSubject(index){

    const subjectName = subjects[index].name;

    subjects.splice(index, 1);

    tasks = tasks.filter(
        task => task.subject !== subjectName
    );

    saveSubjects();
    saveTasks();

    if(currentSubject === subjectName){
        goHome();
    }

    buildSubjects();
    refreshDashboard();
}
/* ================= EVENTS ================= */

backButton.addEventListener(
    "click",
    goHome
);
addSubjectButton.addEventListener(
    "click",
    openSubjectModal
);

cancelSubjectBtn.addEventListener(
    "click",
    closeSubjectModal
);

subjectModal.addEventListener("click", event => {
    if(event.target === subjectModal){
        closeSubjectModal();
    }
});

deleteConfirmModal.addEventListener("click", event => {
    if(event.target === deleteConfirmModal){
        closeDeleteConfirmModal();
    }
});

document.addEventListener("click", event => {
    if(!event.target.closest(".subject-action") &&
       !event.target.closest(".subject-menu")){
        closeAllSubjectMenus();
    }
});

document.addEventListener("keydown", event => {
    if(event.key === "Escape"){
        closeSubjectModal();
        closeTaskModal();
        closeAllSubjectMenus();
        closeDeleteConfirmModal();
    }
});

saveSubjectBtn.addEventListener(
    "click",
    saveSubject
);
/* ================= START APP ================= */

buildSubjects();

refreshDashboard();
/* ==================================================
   PART 2
   Task CRUD + Modal + Overdue Logic + Rendering
================================================== */

/* ================= ELEMENTS ================= */

const taskModal =
    document.getElementById("taskModal");

const addTaskButton =
    document.getElementById("addTaskButton");

const subjectHeader =
    document.querySelector(".subject-header");

const saveTaskBtn =
    document.getElementById("saveTaskBtn");

const cancelTaskBtn =
    document.getElementById("cancelTaskBtn");

const topicInput =
    document.getElementById("topicInput");

const sourceInput =
    document.getElementById("sourceInput");

const dateInput =
    document.getElementById("dateInput");

const remarksInput =
    document.getElementById("remarksInput");

const taskTemplate =
    document.getElementById("taskTemplate");

const taskModalTitle =
    document.getElementById("taskModalTitle");

/* ================= TASK ID ================= */

function generateId(){

    return Date.now() +
           Math.floor(Math.random()*1000);
}

/* ================= MODAL ================= */

function openTaskModal(){

    editingTaskId = null;

    taskModalTitle.textContent = "Add Task";

    topicInput.value = "";
    sourceInput.value = "";
    dateInput.value = "";
    remarksInput.value = "";

    taskModal.classList.remove("hidden");
}

function openEditTaskModal(taskId){

    editingTaskId = taskId;

    taskModalTitle.textContent = "Edit Task";

    const task = tasks.find(t => t.id === taskId);

    if(!task) return;

    topicInput.value = task.topic;
    sourceInput.value = task.source;
    dateInput.value = task.task_date;
    remarksInput.value = task.remarks;

    taskModal.classList.remove("hidden");
}

function closeTaskModal(){

    taskModal.classList.add("hidden");
}

/* ================= SAVE TASK ================= */

function saveTask(){

    if(!currentSubject){

        return;
    }

    const topic =
        topicInput.value.trim();

    if(topic === ""){

        alert("Topic is required.");
        return;
    }

    if(editingTaskId !== null){

        const task = tasks.find(t => t.id === editingTaskId);

        if(task){
            task.topic = topic;
            task.source = sourceInput.value.trim();
            task.task_date = formatDate(dateInput.value);
            task.remarks = remarksInput.value.trim();
        }

    } else {

        const task = {

            id: generateId(),

            subject: currentSubject,

            topic: topic,

            source:
                sourceInput.value.trim(),

            task_date:
                formatDate(dateInput.value),

            status: "Planned",

            remarks:
                remarksInput.value.trim()
        };

        tasks.push(task);
    }

    saveTasks();

    closeTaskModal();

    renderTasks();

    updateSubjectStats();

    refreshDashboard();
}

/* ================= DATE PARSER ================= */

function convertToDate(dateString){

    if(!dateString){

        return null;
    }

    const parts =
        dateString.split("-");

    if(parts.length !== 3){

        return null;
    }

    const day =
        parseInt(parts[0]);

    const month =
        parseInt(parts[1]) - 1;

    const year =
        parseInt(parts[2]);

    return new Date(
        year,
        month,
        day
    );
}

/* ================= OVERDUE CHECK ================= */

function processOverdueTasks(){

    const today =
        new Date();

    today.setHours(
        0,0,0,0
    );

    tasks.forEach(task=>{

        const taskDate =
            convertToDate(
                task.task_date
            );

        if(!taskDate){

            return;
        }

        if(
            taskDate < today &&
            task.status !== "Completed"
        ){

            task.status =
                "Not Completed";
        }

    });

    saveTasks();
}

/* ================= DELETE TASK ================= */

function deleteTask(taskId){

    tasks =
        tasks.filter(
            task => task.id !== taskId
        );

    saveTasks();

    renderTasks();

    updateSubjectStats();

    refreshDashboard();
}

/* ================= STATUS COLOR ================= */

function getStatusColor(status){

    switch(status){

        case "Completed":
            return "#22c55e";

        case "Halfway":
            return "#facc15";

        case "Not Completed":
            return "#ef4444";

        case "Planned":
            return "#7c3aed";

        default:
            return "#7c3aed";
    }
}

/* ================= RENDER TASKS ================= */

function renderTasks(){

    processOverdueTasks();

    taskContainer.innerHTML = "";

    const subjectTasks =
        tasks.filter(
            task =>
            task.subject === currentSubject
        );

    updateAddTaskButtonLayout(
        subjectTasks.length
    );

    subjectTasks.sort((a,b)=>{

        const d1 =
            convertToDate(
                a.task_date
            );

        const d2 =
            convertToDate(
                b.task_date
            );

        return d1 - d2;
    });

    subjectTasks.forEach(task=>{

        const clone =
            taskTemplate.content.cloneNode(true);

        const card =
            clone.querySelector(".task-card");

        const topic =
            clone.querySelector(".task-topic");

        const source =
            clone.querySelector(".task-source");

        const date =
            clone.querySelector(".task-date");

        const remarks =
            clone.querySelector(".task-remarks");

        const status =
            clone.querySelector(".task-status");

        const taskActions =
            clone.querySelector(".task-actions");

        const editBtn =
            taskActions.querySelector(".edit-btn");

        const deleteBtn =
            taskActions.querySelector(".delete-btn");

        topic.textContent =
            task.topic;

        source.textContent =
            task.source;

        date.textContent =
            task.task_date;

        remarks.value =
            task.remarks;

        status.value =
            task.status;

        status.style.backgroundColor =
            getStatusColor(task.status);

        status.style.color = "white";

        /* Overdue Style */

        if(
            task.status ===
            "Not Completed"
        ){

            card.classList.add(
                "overdue"
            );
        }

        /* Save Remarks */

        remarks.addEventListener(
            "blur",
            ()=>{

                task.remarks =
                    remarks.value;

                saveTasks();
            }
        );

        /* Update Status */

        status.addEventListener(
            "change",
            ()=>{

                task.status =
                    status.value;

                status.style.backgroundColor =
                    getStatusColor(status.value);

                status.style.color = "white";

                saveTasks();

                renderTasks();

                updateSubjectStats();

                refreshDashboard();
            }
        );

        /* Delete */

        editBtn.addEventListener(
            "click",
            ()=>{
                openEditTaskModal(task.id);
            }
        );

        deleteBtn.addEventListener(
            "click",
            ()=>{
                openDeleteConfirmModal(
                    ()=> deleteTask(task.id),
                    `Are you sure you want to delete this task?`
                );
            }
        );

        taskContainer.appendChild(
            clone
        );

    });

}

/* ================= EVENTS ================= */

addTaskButton.addEventListener(
    "click",
    openTaskModal
);

cancelTaskBtn.addEventListener(
    "click",
    closeTaskModal
);

saveTaskBtn.addEventListener(
    "click",
    saveTask
);

/* ================= INITIAL CHECK ================= */

processOverdueTasks();
refreshDashboard();