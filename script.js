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

const searchPage =
    document.getElementById("searchPage");

const statisticsPage =
    document.getElementById("statisticsPage");

const subjectPage =
    document.getElementById("subjectPage");

const subjectGrid =
    document.getElementById("subjectGrid");

const todayTasksList =
    document.getElementById("todayTasksList");

const subjectFilterList =
    document.getElementById("subjectFilterList");

const searchInput =
    document.getElementById("searchInput");

const searchResults =
    document.getElementById("searchResults");

const summaryStats =
    document.getElementById("summaryStats");

const subjectPerformanceBars =
    document.getElementById("subjectPerformanceBars");

const weeklyBars =
    document.getElementById("weeklyBars");

const monthlyGrid =
    document.getElementById("monthlyGrid");

const distributionDonut =
    document.getElementById("distributionDonut");

const distributionLegend =
    document.getElementById("distributionLegend");

const achievementCards =
    document.getElementById("achievementCards");

const insightsList =
    document.getElementById("insightsList");

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

const footerActions =
    addSubjectButton.closest(".footer-actions");

const settingsButton =
    document.getElementById("settingsButton");

const settingsOverlay =
    document.getElementById("settingsOverlay");

const closeSettingsButton =
    document.getElementById("closeSettingsButton");

const autoDeleteSelect =
    document.getElementById("autoDeleteSelect");

const customDeleteDays =
    document.getElementById("customDeleteDays");

const customDeleteDaysWrap =
    document.getElementById("customDeleteDaysWrap");

const helpPage =
    document.getElementById("helpPage");

const aboutPage =
    document.getElementById("aboutPage");

const tabButtons =
    Array.from(document.querySelectorAll(".tab-btn"));

let activeTab = "home";
let selectedSubjectFilter = "all";
const subjectTaskView = { status: "all", date: "all", sort: "normal" };
const searchTaskView = { status: "all", date: "all", sort: "normal" };

const defaultSettings = {
    autoDelete: "never",
    customDeleteDays: "",
    accent: "purple"
};

function getStoredSettings(){
    try{
        return JSON.parse(localStorage.getItem("ironMindSettings") || "{}");
    } catch(error){
        return {};
    }
}

let appSettings = {
    ...defaultSettings,
    ...getStoredSettings()
};

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

const quoteText =
    document.getElementById("quoteText");

const quoteDots =
    document.getElementById("quoteDots");

const quoteCard =
    document.getElementById("quoteCard");

const quotes = [
    "Discipline beats motivation.",
    "Progress over perfection.",
    "Consistency creates champions."
];

let currentQuoteIndex = 0;

function renderQuote(index, direction = "next"){
    if(!quoteText || !quoteDots) return;

    quoteText.classList.remove("slide-out-left", "slide-out-right");
    quoteText.classList.add(direction === "prev" ? "slide-out-right" : "slide-out-left");

    setTimeout(() => {
        quoteText.textContent = quotes[index];
        quoteText.classList.remove("slide-out-left", "slide-out-right");
        quoteText.classList.add("slide-in");
        requestAnimationFrame(() => {
            quoteText.classList.remove("slide-in");
        });
    }, 180);

    quoteDots.querySelectorAll(".quote-dot").forEach((dot, dotIndex) => {
        dot.classList.toggle("active", dotIndex === index);
    });

    if(quoteCard){
        quoteCard.classList.remove("quote-1", "quote-2", "quote-3");
        quoteCard.classList.add(`quote-${index + 1}`);
    }
}

function rotateQuotes(){
    currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
    renderQuote(currentQuoteIndex, "next");
}

function changeQuote(step){
    currentQuoteIndex = (currentQuoteIndex + step + quotes.length) % quotes.length;
    renderQuote(currentQuoteIndex, step < 0 ? "prev" : "next");
}

function initQuotes(){
    if(!quoteText || !quoteDots) return;

    quoteDots.innerHTML = "";
    quotes.forEach((_, index) => {
        const dot = document.createElement("span");
        dot.className = "quote-dot";
        if(index === 0){
            dot.classList.add("active");
        }
        quoteDots.appendChild(dot);
    });

    renderQuote(0, "next");
    setInterval(rotateQuotes, 5000);

    let startX = 0;
    let isDragging = false;

    const handleSwipe = (deltaX) => {
        if(Math.abs(deltaX) > 45){
            changeQuote(deltaX < 0 ? 1 : -1);
        }
    };

    quoteCard?.addEventListener("mousedown", event => {
        startX = event.clientX;
        isDragging = true;
    });

    quoteCard?.addEventListener("mousemove", event => {
        if(!isDragging) return;
        const deltaX = event.clientX - startX;
        if(Math.abs(deltaX) > 20){
            quoteText.style.transform = `translateX(${deltaX}px)`;
        }
    });

    quoteCard?.addEventListener("mouseup", event => {
        if(!isDragging) return;
        const deltaX = event.clientX - startX;
        handleSwipe(deltaX);
        quoteText.style.transform = "";
        isDragging = false;
    });

    quoteCard?.addEventListener("mouseleave", () => {
        quoteText.style.transform = "";
        isDragging = false;
    });

    quoteCard?.addEventListener("touchstart", event => {
        startX = event.touches[0].clientX;
        isDragging = true;
    }, { passive: true });

    quoteCard?.addEventListener("touchmove", event => {
        if(!isDragging) return;
        const deltaX = event.touches[0].clientX - startX;
        if(Math.abs(deltaX) > 20){
            quoteText.style.transform = `translateX(${deltaX}px)`;
        }
    }, { passive: true });

    quoteCard?.addEventListener("touchend", event => {
        if(!isDragging) return;
        const deltaX = event.changedTouches[0].clientX - startX;
        handleSwipe(deltaX);
        quoteText.style.transform = "";
        isDragging = false;
    });
}

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

function saveSettings(){
    localStorage.setItem("ironMindSettings", JSON.stringify(appSettings));
}

function showToast(message, type){
    let container = document.getElementById("toastContainer");

    if(!container){
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {
        toast.classList.remove("show");
        toast.classList.add("hide");
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

const accentPresets = {
    purple: { accent: "#7C4DFF", bright: "#A78BFA", soft: "rgba(124,77,255,0.24)" },
    blue: { accent: "#2563EB", bright: "#38BDF8", soft: "rgba(37,99,235,0.24)" },
    green: { accent: "#16A34A", bright: "#4ADE80", soft: "rgba(22,163,74,0.24)" },
    orange: { accent: "#EA580C", bright: "#FB923C", soft: "rgba(234,88,12,0.24)" }
};

function applyAccentColor(){
    const accent = accentPresets[appSettings.accent] || accentPresets.purple;
    document.documentElement.style.setProperty("--accent", accent.accent);
    document.documentElement.style.setProperty("--accent-bright", accent.bright);
    document.documentElement.style.setProperty("--accent-soft", accent.soft);
}

function syncSettingsUI(){
    if(!autoDeleteSelect) return;

    autoDeleteSelect.value = appSettings.autoDelete;
    customDeleteDays.value = appSettings.customDeleteDays;
    customDeleteDaysWrap.classList.toggle("hidden", appSettings.autoDelete !== "custom");

    document.querySelectorAll("[data-accent]").forEach(button => {
        button.classList.toggle("active", button.dataset.accent === appSettings.accent);
    });
}

function closeSettingsPanel(){
    settingsOverlay.classList.remove("is-open");
    settingsOverlay.setAttribute("aria-hidden", "true");
    settingsButton.setAttribute("aria-expanded", "false");
}

function openSettingsPanel(){
    settingsOverlay.classList.add("is-open");
    settingsOverlay.setAttribute("aria-hidden", "false");
    settingsButton.setAttribute("aria-expanded", "true");
}

function openSettingsPage(page){
    closeSettingsPanel();
    document.querySelectorAll(".page").forEach(currentPage => {
        currentPage.classList.toggle("hidden", currentPage !== page);
    });
    footerActions.classList.add("hidden");
}

function returnFromSettingsPage(){
    showTab(activeTab);
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
        if(menu.menuOwner && menu.parentElement !== menu.menuOwner){
            menu.menuOwner.appendChild(menu);
        }
    });
}

function positionSubjectMenu(menu, trigger){
    const gap = 8;
    const viewportPadding = 12;
    const triggerBounds = trigger.getBoundingClientRect();
    const menuBounds = menu.getBoundingClientRect();
    const openAbove =
        window.innerHeight - triggerBounds.bottom < menuBounds.height + gap &&
        triggerBounds.top > menuBounds.height + gap;
    const top = openAbove
        ? triggerBounds.top - menuBounds.height - gap
        : triggerBounds.bottom + gap;

    menu.style.top = `${Math.max(viewportPadding, Math.min(top, window.innerHeight - menuBounds.height - viewportPadding))}px`;
    menu.style.left = `${Math.max(viewportPadding, Math.min(triggerBounds.right - menuBounds.width, window.innerWidth - menuBounds.width - viewportPadding))}px`;
}

function showTab(tabName){
    activeTab = tabName;

    const visiblePageIds = {
        home: ["homePage"],
        search: ["searchPage"],
        stats: ["statisticsPage"]
    };

    document.querySelectorAll(".page").forEach(page => {
        const shouldShow = visiblePageIds[tabName]?.includes(page.id);
        page.classList.toggle("hidden", !shouldShow);
    });

    if(subjectPage){
        subjectPage.classList.add("hidden");
    }

    tabButtons.forEach(button => {
        button.classList.toggle("active", button.dataset.tab === tabName);
    });

    footerActions.classList.toggle(
        "hidden",
        tabName !== "home"
    );
    settingsButton.style.display =
        tabName === "home" ? "flex" : "none";

    if(tabName === "search"){
        renderSubjectFilters();
        renderSearchResults();
    }

    if(tabName === "stats"){
        renderStatistics();
    }
}

function buildSubjects(){

    closeAllSubjectMenus();
    subjectGrid.innerHTML = "";
    renderTodayTasks();
    renderSubjectFilters();
    renderSearchResults();
    renderStatistics();

    if(subjects.length === 0){
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state-card";
        emptyState.innerHTML = `
            <div class="empty-state-icon">📖</div>
            <div class="empty-state-title">No subjects yet.</div>
            <div class="empty-state-text">Start building your Iron Mind.</div>
        `;
        subjectGrid.appendChild(emptyState);
        return;
    }

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

        const icon =
            subject.priority === "high"
                ? "📚"
                : subject.priority === "core"
                    ? "📖"
                    : "📘";

        const subtitle =
            subject.priority === "high"
                ? "Priority focus"
                : subject.priority === "core"
                    ? "Steady progress"
                    : "Light review";

        const iconSpan = document.createElement("span");
        iconSpan.className = "subject-icon";
        iconSpan.textContent = icon;

        const textWrap = document.createElement("span");
        textWrap.className = "subject-text";

        const nameSpan = document.createElement("span");
        nameSpan.className = "subject-name";
        nameSpan.textContent = subject.name;

        const subtitleSpan = document.createElement("span");
        subtitleSpan.className = "subject-subtitle";
        subtitleSpan.textContent = subtitle;

        textWrap.appendChild(nameSpan);
        textWrap.appendChild(subtitleSpan);
        button.appendChild(iconSpan);
        button.appendChild(textWrap);

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
            document.body.appendChild(subjectMenu);
            subjectMenu.classList.remove("hidden");
            positionSubjectMenu(subjectMenu, menuButton);
        });

        const subjectMenu =
            document.createElement("div");
        subjectMenu.classList.add(
            "subject-menu",
            "hidden"
        );
        subjectMenu.menuOwner = actionContainer;

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
    closeSettingsPanel();
    settingsButton.style.display = "none";

    homePage.classList.add("hidden");
    searchPage.classList.add("hidden");
    statisticsPage.classList.add("hidden");
    subjectPage.classList.remove("hidden");
    document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
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
    searchPage.classList.add("hidden");
    statisticsPage.classList.add("hidden");
    showTab("home");
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
            t => t.status === "Missed"
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

    const centerX = 90;
    const centerY = 90;

    const radius = 72;

    /* BASE RING */

    ctx.beginPath();
    ctx.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
    );

    ctx.lineWidth = 16;
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

    ctx.lineWidth = 16;
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
        progress + "%",
        centerX,
        centerY - 8
    );

    ctx.fillStyle = "#9ca3af";
    ctx.font = "16px Arial";

    ctx.fillText(
        "Progress",
        centerX,
        centerY + 28
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
function renderTodayTasks(){
    if(!todayTasksList) return;

    const today = getTodayDate();
    const todayTasks = tasks.filter(task => task.task_date === today);

    todayTasksList.innerHTML = "";

    if(todayTasks.length === 0){
        const empty = document.createElement("div");
        empty.className = "today-task-item";
        empty.innerHTML = "<div style='font-size:1.6rem; margin-bottom:6px;'>🎉</div><div>No tasks scheduled for today.</div>";
        todayTasksList.appendChild(empty);
        return;
    }

    todayTasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "today-task-item";
        item.innerHTML = `
    <div style="font-weight:700; margin-bottom:4px;">
        ${task.subject}
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#cbd5e1;">
            ${task.topic}
        </span>

        <span style="font-size:12px; font-weight:600; color:#a78bfa;">
            ${task.status}
        </span>
    </div>
`;
        item.addEventListener("click", () => {
            openSubjectPage(task.subject);
            setTimeout(() => {
                const target = Array.from(taskContainer.querySelectorAll(".task-card")).find(card => card.textContent.includes(task.topic));
                if(target){
                    target.scrollIntoView({behavior:"smooth", block:"center"});
                    target.style.boxShadow = "0 0 0 2px rgba(56,189,248,0.35)";
                    setTimeout(() => target.style.boxShadow = "", 1600);
                }
            }, 100);
        });
        todayTasksList.appendChild(item);
    });
}

function renderSubjectFilters(){
    if(!subjectFilterList) return;

    subjectFilterList.innerHTML = "";

    const options = ["all", ...subjects.map(subject => subject.name)];
    options.forEach(option => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `subject-filter-item${selectedSubjectFilter === option ? " active" : ""}`;
        item.textContent = option === "all" ? "All Subjects" : option;
        item.addEventListener("click", () => {
            selectedSubjectFilter = option;
            renderSubjectFilters();
            renderSearchResults();
        });
        subjectFilterList.appendChild(item);
    });
}

function getFilteredTasks(){
    const query = searchInput?.value.trim().toLowerCase() || "";
    const matchingTasks = tasks.filter(task => {
        const matchesSubject = selectedSubjectFilter === "all" || task.subject === selectedSubjectFilter;
        const haystack = `${task.subject} ${task.topic} ${task.source} ${task.remarks}`.toLowerCase();
        const matchesQuery = query === "" || haystack.includes(query);
        return matchesSubject && matchesQuery;
    });

    return getTaskViewTasks(matchingTasks, searchTaskView);
}

function renderSearchResults(){
    if(!searchResults) return;

    const filteredTasks = getFilteredTasks();
    searchResults.innerHTML = "";

    if(filteredTasks.length === 0){
        searchResults.innerHTML = '<div class="today-task-item">No matching tasks.</div>';
        return;
    }

    filteredTasks.forEach(task => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "search-result-item";
        item.innerHTML = `<div style="font-weight:700; margin-bottom:4px;">${task.subject}</div><div style="color:#cbd5e1;">${task.topic}</div>`;
        item.addEventListener("click", () => {
            openSubjectPage(task.subject);
            setTimeout(() => {
                const target = Array.from(taskContainer.querySelectorAll(".task-card")).find(card => card.textContent.includes(task.topic));
                if(target){
                    target.scrollIntoView({behavior:"smooth", block:"center"});
                    target.style.boxShadow = "0 0 0 2px rgba(56,189,248,0.35)";
                    setTimeout(() => target.style.boxShadow = "", 1600);
                }
            }, 100);
        });
        searchResults.appendChild(item);
    });
}

function renderStatistics(){
    if(!summaryStats) return;

    const completed = tasks.filter(task => task.status === "Completed").length;
    const pending = tasks.filter(task => task.status === "Planned" || task.status === "Halfway").length;
    const missed = tasks.filter(task => task.status === "Missed").length;
    const completionRate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

    summaryStats.innerHTML = [
        {label:"Completion Rate", value:`${completionRate}%`},
        {label:"Completed Tasks", value:completed},
        {label:"Pending Tasks", value:pending},
        {label:"Missed Tasks", value:missed}
    ].map(item => `<div class="summary-item"><span>${item.label}</span><strong>${item.value}</strong></div>`).join("");

    subjectPerformanceBars.innerHTML = subjects.length ? subjects.map(subject => {
        const subjectTasks = tasks.filter(task => task.subject === subject.name);
        const completedCount = subjectTasks.filter(task => task.status === "Completed").length;
        const percentage = subjectTasks.length ? Math.round((completedCount / subjectTasks.length) * 100) : 0;
        return `<div class="bar-row"><span>${subject.name}</span><div class="bar-track"><div class="bar-fill" style="width:${percentage}%"></div></div><span>${percentage}%</span></div>`;
    }).join("") : '<div class="insight-item">No subject data yet.</div>';

    const weekDays = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    weeklyBars.innerHTML = weekDays.map(day => {
        const dayTasks = tasks.filter(task => {
            const parsed = convertToDate(task.task_date);
            return parsed && parsed.toLocaleDateString("en-US", { weekday: "long" }) === day;
        });
        const completedCount = dayTasks.filter(task => task.status === "Completed").length;
        const percentage = dayTasks.length ? Math.round((completedCount / dayTasks.length) * 100) : 0;
        return `<div class="bar-row"><span>${day}</span><div class="bar-track"><div class="bar-fill" style="width:${percentage}%"></div></div><span>${percentage}%</span></div>`;
    }).join("");

    const days = Array.from({length: 35}, (_, index) => index);
    monthlyGrid.innerHTML = days.map(() => '<div class="contribution-cell"></div>').join("");
    const completedDays = tasks.filter(task => task.status === "Completed").length;
    const missedDays = tasks.filter(task => task.status === "Missed").length;
    monthlyGrid.querySelectorAll('.contribution-cell').forEach((cell, index) => {
        if(index < completedDays % 35) cell.classList.add('completed');
        else if(index < (completedDays + missedDays) % 35) cell.classList.add('missed');
    });

    const completedPercent = tasks.length ? (completed / tasks.length) * 100 : 0;
    const halfwayPercent = tasks.length ? (tasks.filter(task => task.status === "Halfway").length / tasks.length) * 100 : 0;
    const plannedPercent = tasks.length ? (tasks.filter(task => task.status === "Planned").length / tasks.length) * 100 : 0;
    const missedPercent = tasks.length ? (missed / tasks.length) * 100 : 0;

    const donutSegments = [
        { color: "#10b981", percent: completedPercent },
        { color: "#f59e0b", percent: halfwayPercent },
        { color: "#3b82f6", percent: plannedPercent },
        { color: "#f43f5e", percent: missedPercent }
    ];

    let current = 0;
    const conicStops = donutSegments.map(segment => {
        const start = current;
        current += segment.percent;
        return `${segment.color} ${start}% ${current}%`;
    }).join(", ");

    distributionDonut.style.background = `conic-gradient(${conicStops})`;
    distributionLegend.innerHTML = [
        {label:'Completed', color:'#10b981'},
        {label:'Halfway', color:'#f59e0b'},
        {label:'Planned', color:'#3b82f6'},
        {label:'Missed', color:'#f43f5e'}
    ].map(item => `<div class="legend-row"><span class="legend-dot" style="background:${item.color}"></span>${item.label}</div>`).join("");

    const bestSubject = subjects.length ? subjects.reduce((best, subject) => {
        const subjectTasks = tasks.filter(task => task.subject === subject.name);
        const rate = subjectTasks.length ? subjectTasks.filter(task => task.status === "Completed").length / subjectTasks.length : 0;
        return rate > best.rate ? {name: subject.name, rate} : best;
    }, {name:'None', rate:0}) : {name:'None', rate:0};

    const streak = Math.min(tasks.filter(task => task.status === "Completed").length, 7);
    const longestStreak = Math.min(tasks.filter(task => task.status === "Completed").length + 1, 7);

    achievementCards.innerHTML = [
        {icon:'🏆', title:'Best Subject', value:bestSubject.name},
        {icon:'🔥', title:'Current Streak', value:`${streak} days`},
        {icon:'⭐', title:'Longest Streak', value:`${longestStreak} days`}
    ].map(item => `<div class="achievement-card"><span class="icon">${item.icon}</span><strong>${item.title}</strong><span>${item.value}</span></div>`).join("");

    const insights = [];
    if(bestSubject.name !== 'None') insights.push(`${bestSubject.name} is your strongest subject.`);
    const weakSubject = subjects.find(subject => {
        const subjectTasks = tasks.filter(task => task.subject === subject.name);
        return subjectTasks.length > 0 && subjectTasks.filter(task => task.status === "Completed").length / subjectTasks.length < 0.5;
    });
    if(weakSubject) insights.push(`${weakSubject.name} needs more attention.`);
    if(insights.length === 0) insights.push('Keep building momentum with one focused task at a time.');
    insightsList.innerHTML = insights.map(item => `<div class="insight-item">${item}</div>`).join("");
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

        showToast("Subject name cannot be empty.", "error");
        return;
    }

    const alreadyExists =
        subjects.some((subject, index) =>
            index !== editingSubjectIndex &&
            subject.name.toLowerCase() ===
            subjectName.toLowerCase()
        );

    if(alreadyExists){

        showToast("Subject already exists.", "error");
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

    if(editingSubjectIndex !== null){
        showToast("Subject updated successfully.", "success");
    } else {
        showToast("Subject created successfully.", "success");
    }

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

    showToast("Subject deleted successfully.", "success");

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

tabButtons.forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
});

settingsButton.addEventListener("click", openSettingsPanel);
closeSettingsButton.addEventListener("click", closeSettingsPanel);

settingsOverlay.addEventListener("click", event => {
    if(event.target === settingsOverlay){
        closeSettingsPanel();
    }
});

document.querySelectorAll("[data-settings-toggle]").forEach(button => {
    button.addEventListener("click", () => {
        const content = document.getElementById(button.dataset.settingsToggle);
        if(content){
            content.classList.toggle("hidden");
        }
    });
});

document.querySelectorAll("[data-settings-page]").forEach(button => {
    button.addEventListener("click", () => {
        openSettingsPage(document.getElementById(button.dataset.settingsPage));
    });
});

document.querySelectorAll("[data-settings-return]").forEach(button => {
    button.addEventListener("click", returnFromSettingsPage);
});

document.querySelectorAll("[data-accent]").forEach(button => {
    button.addEventListener("click", () => {
        appSettings.accent = button.dataset.accent;
        saveSettings();
        applyAccentColor();
        syncSettingsUI();
    });
});

autoDeleteSelect.addEventListener("change", () => {
    appSettings.autoDelete = autoDeleteSelect.value;
    saveSettings();
    syncSettingsUI();

    if(applyAutoDeleteTasks()){
        buildSubjects();
        refreshDashboard();
        renderSearchResults();
    }
});

customDeleteDays.addEventListener("change", () => {
    appSettings.customDeleteDays = customDeleteDays.value;
    saveSettings();

    if(applyAutoDeleteTasks()){
        buildSubjects();
        refreshDashboard();
        renderSearchResults();
    }
});

searchInput?.addEventListener("input", renderSearchResults);

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

document.addEventListener("click", event => {
    const menuToggle = event.target.closest("[data-task-menu-toggle]");

    if(menuToggle){
        const menu = document.getElementById(menuToggle.dataset.taskMenuToggle);
        const shouldOpen = menu?.classList.contains("hidden");
        closeTaskControlMenus();

        if(shouldOpen && menu){
            menu.classList.remove("hidden");
            menuToggle.setAttribute("aria-expanded", "true");
        }
        return;
    }

    const option = event.target.closest("[data-task-option]");

    if(option){
        const viewState = getTaskViewState(option.dataset.taskContext);
        viewState[option.dataset.taskSetting] = option.dataset.taskValue;
        syncTaskControls(option.dataset.taskContext);
        renderTaskView(option.dataset.taskContext);
        closeTaskControlMenus();
        return;
    }

    const resetButton = event.target.closest("[data-task-reset]");

    if(resetButton){
        const viewState = getTaskViewState(resetButton.dataset.taskContext);
        viewState.status = "all";
        viewState.date = "all";
        syncTaskControls(resetButton.dataset.taskContext);
        renderTaskView(resetButton.dataset.taskContext);
        closeTaskControlMenus();
        return;
    }

    if(!event.target.closest(".task-control")){
        closeTaskControlMenus();
    }
});

document.addEventListener("keydown", event => {
    if(event.key === "Escape"){
        closeSubjectModal();
        closeTaskModal();
        closeAllSubjectMenus();
        closeDeleteConfirmModal();
        closeSettingsPanel();
    }
});

window.addEventListener("resize", closeAllSubjectMenus);
subjectGrid?.addEventListener("scroll", closeAllSubjectMenus);

saveSubjectBtn.addEventListener(
    "click",
    saveSubject
);
/* ================= START APP ================= */

applyAccentColor();
syncSettingsUI();
applyAutoDeleteTasks();
buildSubjects();
initQuotes();
syncTaskControls("subject");
syncTaskControls("search");
showTab("home");

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

function syncDateInputWrap(){
    const wrap = dateInput?.closest(".date-input-wrap");
    if(!wrap) return;
    wrap.classList.toggle("has-value", !!dateInput.value);
}

function openDateInputPicker(){
    if(typeof dateInput?.showPicker === "function"){
        try{
            dateInput.showPicker();
        } catch(error){
            // Ignore when the browser blocks programmatic picker open.
        }
    }
}

dateInput?.addEventListener("click", openDateInputPicker);
dateInput?.addEventListener("input", syncDateInputWrap);
dateInput?.addEventListener("change", syncDateInputWrap);

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

    syncDateInputWrap();

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

    syncDateInputWrap();

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

    const dateValue =
        dateInput.value.trim();

    if(topic === "" && dateValue === ""){

        showToast("Please complete all required fields.", "warning");
        return;
    }

    if(topic === ""){

        showToast("Task name cannot be empty.", "error");
        return;
    }

    if(dateValue === ""){

        showToast("Please select a date.", "error");
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

    if(editingTaskId !== null){
        showToast("Task updated successfully.", "success");
    } else {
        showToast("Task created successfully.", "success");
    }

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

function getAutoDeleteDays(){
    if(appSettings.autoDelete === "30") return 30;
    if(appSettings.autoDelete === "60") return 60;

    if(appSettings.autoDelete === "custom"){
        const customDays = Number.parseInt(appSettings.customDeleteDays, 10);
        return customDays > 0 ? customDays : null;
    }

    return null;
}

function applyAutoDeleteTasks(){
    const deleteAfterDays = getAutoDeleteDays();
    if(!deleteAfterDays) return false;

    const cutoffDate = getStartOfToday();
    cutoffDate.setDate(cutoffDate.getDate() - deleteAfterDays);

    const previousTaskCount = tasks.length;
    tasks = tasks.filter(task => {
        const taskDate = convertToDate(task.task_date);
        return !taskDate || taskDate >= cutoffDate;
    });

    if(tasks.length !== previousTaskCount){
        saveTasks();
        return true;
    }

    return false;
}

function getTaskViewState(context){
    return context === "search" ? searchTaskView : subjectTaskView;
}

function getStartOfToday(){
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function matchesTaskDateFilter(task, dateFilter){
    if(dateFilter === "all") return true;

    const taskDate = convertToDate(task.task_date);
    if(!taskDate) return false;

    const today = getStartOfToday();

    if(dateFilter === "today"){
        return taskDate.getTime() === today.getTime();
    }

    if(dateFilter === "tomorrow"){
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return taskDate.getTime() === tomorrow.getTime();
    }

    if(dateFilter === "week"){
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return taskDate >= weekStart && taskDate <= weekEnd;
    }

    return true;
}

function getTaskDateValue(task){
    const date = convertToDate(task.task_date);
    return date ? date.getTime() : null;
}

function getNormalTaskRank(task){
    const today = getStartOfToday();
    const taskDate = convertToDate(task.task_date);

    if(taskDate && taskDate.getTime() === today.getTime()) return 0;

    return {
        Halfway: 1,
        Missed: 2,
        Completed: 3,
        Planned: 4
    }[task.status] ?? 5;
}

function sortTasks(taskList, sortMode){
    return [...taskList].sort((firstTask, secondTask) => {
        const firstDate = getTaskDateValue(firstTask);
        const secondDate = getTaskDateValue(secondTask);

        if(firstDate === null) return secondDate === null ? 0 : 1;
        if(secondDate === null) return -1;

        if(sortMode === "descending") return secondDate - firstDate;
        if(sortMode === "ascending") return firstDate - secondDate;

        const rankDifference = getNormalTaskRank(firstTask) - getNormalTaskRank(secondTask);
        return rankDifference || firstDate - secondDate;
    });
}

function getTaskViewTasks(taskList, viewState){
    return sortTasks(
        taskList.filter(task =>
            (viewState.status === "all" || task.status === viewState.status) &&
            matchesTaskDateFilter(task, viewState.date)
        ),
        viewState.sort
    );
}

function closeTaskControlMenus(){
    document.querySelectorAll(".task-control-menu").forEach(menu => {
        menu.classList.add("hidden");
    });

    document.querySelectorAll("[data-task-menu-toggle]").forEach(button => {
        button.setAttribute("aria-expanded", "false");
    });
}

function syncTaskControls(context){
    const viewState = getTaskViewState(context);

    document.querySelectorAll(`[data-task-option][data-task-context="${context}"]`).forEach(button => {
        const isActive = viewState[button.dataset.taskSetting] === button.dataset.taskValue;
        button.dataset.active = String(isActive);
    });
}

function renderTaskView(context){
    if(context === "search"){
        renderSearchResults();
        return;
    }

    renderTasks();
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
                "Missed";
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

    showToast("Task deleted successfully.", "success");

    renderTasks();

    updateSubjectStats();

    refreshDashboard();
}

/* ================= STATUS COLOR ================= */

function getStatusColor(status){

    switch(status){

        case "Completed":
            return "#10b981";

        case "Halfway":
            return "#f59e0b";

        case "Missed":
            return "#f43f5e";

        case "Planned":
            return "#3b82f6";

        default:
            return "#3b82f6";
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

    if(subjectTasks.length === 0){
        const emptyState = document.createElement("div");
        emptyState.className = "subject-empty-state";

        const icon = document.createElement("div");
        icon.className = "subject-empty-icon";
        icon.textContent = "📝";

        const title = document.createElement("h3");
        title.textContent = `No tasks in ${currentSubject} yet`;

        const message = document.createElement("p");
        message.append("Use ");
        const action = document.createElement("strong");
        action.textContent = "+ Add Task";
        message.append(action, " to create your first task for this subject.");

        emptyState.append(icon, title, message);
        taskContainer.appendChild(emptyState);
        return;
    }

    const visibleTasks = getTaskViewTasks(subjectTasks, subjectTaskView);

    if(visibleTasks.length === 0){
        taskContainer.innerHTML = '<div class="subject-empty-state"><div class="subject-empty-icon">🔎</div><h3>No matching tasks</h3><p>Try adjusting or resetting the current filters.</p></div>';
        return;
    }

    visibleTasks.forEach(task=>{

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

        topic.innerHTML = "";
        source.innerHTML = "";
        date.innerHTML = "";

        const topicIcon = document.createElement("span");
        topicIcon.className = "task-field-icon";
        topicIcon.textContent = "📘";

        const topicText = document.createElement("span");
        topicText.className = "task-field-text";
        topicText.textContent = task.topic;

        topic.appendChild(topicIcon);
        topic.appendChild(topicText);

        const sourceIcon = document.createElement("span");
        sourceIcon.className = "task-field-icon";
        sourceIcon.textContent = "📖";

        const sourceText = document.createElement("span");
        sourceText.className = "task-field-text";
        sourceText.textContent = task.source;

        source.appendChild(sourceIcon);
        source.appendChild(sourceText);

        const dateIcon = document.createElement("span");
        dateIcon.className = "task-field-icon";
        dateIcon.textContent = "📅";

        const dateText = document.createElement("span");
        dateText.className = "task-field-text";
        dateText.textContent = task.task_date;

        date.appendChild(dateIcon);
        date.appendChild(dateText);

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
            "Missed"
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

/* ================= MOBILE SEARCH DRAWER ================= */

(function initSearchDrawer() {
    const openButton  = document.getElementById("searchDrawerOpenButton");
    const closeButton = document.getElementById("searchDrawerCloseButton");
    const sidebar     = document.querySelector(".search-sidebar");

    if (!openButton || !sidebar) return;

    /* Create overlay once */
    let overlay = document.getElementById("searchDrawerOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "searchDrawerOverlay";
        overlay.className = "search-drawer-overlay hidden";
        document.body.appendChild(overlay);
    }

    const openDrawer = () => {
        sidebar.classList.add("is-open");
        overlay.classList.remove("hidden");
        /* Force reflow so the CSS transition plays */
        overlay.offsetHeight;
        overlay.classList.add("is-visible");
    };

    const closeDrawer = () => {
        sidebar.classList.remove("is-open");
        overlay.classList.remove("is-visible");
        setTimeout(() => {
            if (!sidebar.classList.contains("is-open")) {
                overlay.classList.add("hidden");
            }
        }, 280); /* Match CSS transition duration */
    };

    /* Open: hamburger button */
    openButton.addEventListener("click", openDrawer);

    /* Close: × button inside drawer header */
    if (closeButton) {
        closeButton.addEventListener("click", closeDrawer);
    }

    /* Close: tap on the overlay backdrop */
    overlay.addEventListener("click", closeDrawer);

    /* Close: Escape key */
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && sidebar.classList.contains("is-open")) {
            closeDrawer();
        }
    });

    /* Close: selecting any subject filter item auto-closes the drawer */
    sidebar.addEventListener("click", (event) => {
        if (event.target.closest(".subject-filter-item")) {
            closeDrawer();
        }
    });
})();
