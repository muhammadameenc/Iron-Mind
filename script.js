/* ==================================================
   IRON MIND TRACKER
   PART 1
   Dashboard + Subjects + Storage + Progress Circle
================================================== */

/* ================= SUBJECTS ================= */

const appHealthRuntimeIssues = [];
const workspaceStorage = window.IRON_MIND_WORKSPACE.storage;
window.addEventListener("error", event => {
    if(!event.filename) return;
    try{
        if(new URL(event.filename, window.location.href).origin === window.location.origin){
            appHealthRuntimeIssues.push("script-error");
        }
    }catch(error){ /* Ignore errors without a comparable same-origin URL. */ }
});
window.addEventListener("unhandledrejection", () => appHealthRuntimeIssues.push("unhandled-rejection"));

const DEFAULT_SUBJECTS = [];

let subjects =
    JSON.parse(workspaceStorage.getItem("ironMindSubjects"))
    || DEFAULT_SUBJECTS;

/* ================= STORAGE ================= */

let tasks =
    JSON.parse(workspaceStorage.getItem("ironMindTasks"))
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
let monthlyActivityRefreshTimer = null;

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

const recycleBinButton = document.getElementById("recycleBinButton");
const recycleBinDialog = document.getElementById("recycleBinDialog");
const recycleBinList = document.getElementById("recycleBinList");
const recycleBinCount = document.getElementById("recycleBinCount");
const recycleBinStatus = document.getElementById("recycleBinStatus");
const recycleBinRetentionSelect = document.getElementById("recycleBinRetentionSelect");
const recycleBinTypeFilter = document.getElementById("recycleBinTypeFilter");
const recycleBinDateFilter = document.getElementById("recycleBinDateFilter");
const recycleBinSearch = document.getElementById("recycleBinSearch");

const tabButtons =
    Array.from(document.querySelectorAll(".tab-btn"));

let activeTab = "home";
let selectedSubjectFilter = "all";
const subjectTaskView = { status: "all", date: "all", sort: "normal" };
const searchTaskView = { status: "all", date: "all", sort: "normal" };

// Back button navigation variables
let lastBackPressTime = 0;
let backPressTimer = null;
const BACK_PRESS_TIMEOUT = 2000; // 2 seconds

const defaultSettings = {
    autoDelete: "never",
    customDeleteDays: "",
    recycleBinRetentionDays: 30,
    theme: "dark"
};

function getStoredSettings(){
    try{
        const stored = JSON.parse(workspaceStorage.getItem("ironMindSettings") || "{}");
        
        // Migrate old accent color themes to dark mode
        if (stored.theme === "purple" || stored.theme === "green" || stored.theme === "orange") {
            stored.theme = "dark";
            // Save migrated settings immediately
            workspaceStorage.setItem("ironMindSettings", JSON.stringify(stored));
        }
        
        return stored;
    } catch(error){
        return {};
    }
}

let appSettings = {
    ...defaultSettings,
    ...getStoredSettings()
};

const RECYCLE_BIN_KEY = "ironMindRecycleBin";
const RECYCLE_BIN_RETENTION_OPTIONS = [7, 30, 60, 90];
let recycleBinStorageReady = true;
let recycleBinEntries = (() => {
    try{
        const stored = JSON.parse(workspaceStorage.getItem(RECYCLE_BIN_KEY) || "[]");
        if(!Array.isArray(stored)) throw new Error("Recycle Bin data is not an array.");
        if(stored.some(item => !item || typeof item !== "object" || Array.isArray(item))) throw new Error("Recycle Bin data contains an invalid record.");
        return stored;
    }catch(error){
        recycleBinStorageReady = false;
        return [];
    }
})();
if(!RECYCLE_BIN_RETENTION_OPTIONS.includes(Number(appSettings.recycleBinRetentionDays))){
    appSettings.recycleBinRetentionDays = 30;
}
if(workspaceStorage.getItem(RECYCLE_BIN_KEY) === null){
    try{ workspaceStorage.setItem(RECYCLE_BIN_KEY, "[]"); }
    catch(error){ recycleBinStorageReady = false; }
}

// One-time cache reset for users with old cached data
(function migrateThemeSettings() {
    try {
        const currentSettings = JSON.parse(workspaceStorage.getItem("ironMindSettings") || "{}");
        const oldThemes = ["purple", "green", "orange"];
        if (oldThemes.includes(currentSettings.theme)) {
            currentSettings.theme = "dark";
            workspaceStorage.setItem("ironMindSettings", JSON.stringify(currentSettings));
            appSettings.theme = "dark";
        }
    } catch (e) {
        // Ignore errors, use defaults
    }
})();

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

    workspaceStorage.setItem(
        "ironMindTasks",
        JSON.stringify(tasks)
    );
}

function saveSubjects(){

    workspaceStorage.setItem(
        "ironMindSubjects",
        JSON.stringify(subjects)
    );
}

function saveSettings(){
    workspaceStorage.setItem("ironMindSettings", JSON.stringify(appSettings));
}

function makeRecycleBinEntry(type, name, parent, payload){
    return {
        id: typeof window.crypto?.randomUUID === "function" ? window.crypto.randomUUID() : `trash-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        type,
        name: String(name || "Untitled item"),
        parent: parent || null,
        deletedAt: new Date().toISOString(),
        payload
    };
}

function persistRecycleBinAndStorage(nextEntries, changes = []){
    if(!recycleBinStorageReady) return false;
    const writes = [...changes, [RECYCLE_BIN_KEY, nextEntries]];
    const snapshots = [];
    try{
        writes.forEach(([key]) => snapshots.push([key, workspaceStorage.getItem(key)]));
        writes.forEach(([key, value]) => workspaceStorage.setItem(key, JSON.stringify(value)));
        recycleBinEntries = nextEntries;
        updateRecycleBinCount();
        return true;
    }catch(error){
        snapshots.forEach(([key, value]) => {
            try{
                if(value === null) workspaceStorage.removeItem(key);
                else workspaceStorage.setItem(key, value);
            }catch(restoreError){ /* Keep the original data in memory if storage rollback is blocked. */ }
        });
        return false;
    }
}

function getRecycleRetentionDays(){
    const days = Number(appSettings.recycleBinRetentionDays);
    return RECYCLE_BIN_RETENTION_OPTIONS.includes(days) ? days : 30;
}

function recycleExpirationDate(entry){
    const deletedAt = Date.parse(entry?.deletedAt || "");
    if(!Number.isFinite(deletedAt)) return null;
    const expiresAt = new Date(deletedAt);
    expiresAt.setDate(expiresAt.getDate() + getRecycleRetentionDays());
    return expiresAt;
}

function addItemsToRecycleBin(items, type, parent = null){
    const nextEntries = [...recycleBinEntries];
    items.forEach(({ name, payload }) => nextEntries.push(makeRecycleBinEntry(type, name, parent, payload)));
    return persistRecycleBinAndStorage(nextEntries);
}

/* ================= BACKUP & DATA MANAGEMENT ================= */

const COMPLETE_BACKUP_FORMAT = "iron-mind-complete-app-backup";
const COMPLETE_BACKUP_FORMAT_VERSION = 1;
const COMPLETE_BACKUP_MAX_BYTES = 256 * 1024 * 1024;
let failedBackupRestoreSnapshot = null;
const backupRecoveryButton = document.getElementById("backupRecoveryButton");
const backupCrc32Table = (() => {
    const table = new Uint32Array(256);
    for(let index = 0; index < table.length; index++){
        let value = index;
        for(let bit = 0; bit < 8; bit++) value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
        table[index] = value >>> 0;
    }
    return table;
})();

function calculateBackupCrc32(bytes){
    let crc = 0xFFFFFFFF;
    for(let index = 0; index < bytes.length; index++) crc = backupCrc32Table[(crc ^ bytes[index]) & 0xFF] ^ (crc >>> 8);
    return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, "0");
}

function setBackupStatus(message){
    const status = document.getElementById("backupStatus");
    if(status) status.textContent = message;
}

function readAllIronMindLocalData(){
    const data = {};
    const storage = workspaceStorage;
    for(let index = 0; index < storage.length; index++){
        const key = storage.key(index);
        if(key && key.startsWith("ironMind")) data[key] = storage.getItem(key);
    }
    return data;
}

function backupFilename(prefix){
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const time = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
    return `${prefix}_${date}_${time}.json`;
}

function startBackupDownload(data, filename, successLabel, maximumBytes = Infinity){
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    if(blob.size > maximumBytes) throw new Error("This backup is too large for the browser to prepare safely (256 MB limit).");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    try{
        link.click();
    }finally{
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    const size = formatBackupBytes(blob.size);
    setBackupStatus(`Download started: ${filename} (${size}).`);
    showToast(`${successLabel} download started (${size}).`, "success");
}

function formatBackupBytes(value){
    const units = ["B", "KB", "MB", "GB"];
    let amount = value;
    let unit = 0;
    while(amount >= 1024 && unit < units.length - 1){ amount /= 1024; unit += 1; }
    return `${amount.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

function readCompleteBackupLocalData(){
    const applicationData = readAllIronMindLocalData();
    try{
        const storedSettings = JSON.parse(applicationData.ironMindSettings || "{}");
        if(storedSettings && typeof storedSettings === "object" && !Array.isArray(storedSettings)){
            storedSettings.recycleBinRetentionDays = getRecycleRetentionDays();
            applicationData.ironMindSettings = JSON.stringify(storedSettings);
        }
    }catch(error){ /* Backup validation will reject malformed settings without changing stored data. */ }
    const requiredSnapshots = [
        ["ironMindSubjects", subjects],
        ["ironMindTasks", tasks],
        ["ironMindSettings", appSettings],
        ["ironMindProjectTopics", projectTopicRecords],
        ["ironMindProjectSubjectIds", projectSubjectIds],
        ["ironMindProjectSubjects", projectSubjectRecords],
        ["ironMindProjectNotes", projectNoteRecords],
        ["ironMindProjectExpandedTopics", projectExpandedBySubject],
        [RECYCLE_BIN_KEY, recycleBinEntries]
    ];
    requiredSnapshots.forEach(([key, value]) => {
        if(applicationData[key] === undefined) applicationData[key] = JSON.stringify(value);
    });
    return applicationData;
}

function blobToBase64(blob){
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("A saved resource file could not be read."));
        reader.onload = () => {
            const result = String(reader.result || "");
            const separator = result.indexOf(",");
            if(separator < 0) reject(new Error("A saved resource file could not be encoded."));
            else resolve(result.slice(separator + 1));
        };
        reader.readAsDataURL(blob);
    });
}

async function blobToBackupContents(blob){
    if(typeof blob.arrayBuffer !== "function") throw new Error("This browser cannot safely read saved resource file bytes.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const data = await blobToBase64(blob);
    return { encoding: "base64", crc32: calculateBackupCrc32(bytes), data };
}

function openExistingResourcesDatabaseSafely(){
    return new Promise((resolve, reject) => {
        let refusedUpgrade = false;
        const request = window.indexedDB.open(PROJECT_RESOURCES_DB_NAME);
        request.onupgradeneeded = () => {
            refusedUpgrade = true;
            try{ request.transaction.abort(); }catch(error){ /* Abort to prevent accidental database/schema creation. */ }
        };
        request.onsuccess = () => {
            if(refusedUpgrade){ request.result.close(); reject(new Error("The resource database changed during backup. Retry after closing other app tabs.")); }
            else resolve(request.result);
        };
        request.onerror = () => reject(refusedUpgrade
            ? new Error("The resource database changed during backup. No schema changes were made.")
            : request.error || new Error("The existing resource database could not be opened."));
        request.onblocked = () => reject(new Error("The resource database is busy in another app tab."));
    });
}

async function getExistingResourceDatabase(){
    if(!window.indexedDB) throw new Error("This browser does not support IndexedDB, so a complete backup cannot include saved resource files.");
    if(projectResourcesDbPromise){
        return { database: await projectResourcesDbPromise, shouldClose: false };
    }
    if(typeof window.indexedDB.databases !== "function"){
        throw new Error("This browser cannot safely check whether saved resource files exist. A complete backup was not created.");
    }
    const databases = await window.indexedDB.databases();
    if(!databases.some(database => database.name === PROJECT_RESOURCES_DB_NAME)) return null;
    return { database: await openExistingResourcesDatabaseSafely(), shouldClose: true };
}

function readResourceRecords(database){
    return new Promise((resolve, reject) => {
        let records = [];
        let transaction;
        try{
            if(!database.objectStoreNames.contains(PROJECT_RESOURCE_STORE)) throw new Error("The existing database is missing its resources store.");
            transaction = database.transaction(PROJECT_RESOURCE_STORE, "readonly");
            const store = transaction.objectStore(PROJECT_RESOURCE_STORE);
            if(!store.indexNames.contains("byOwner")) throw new Error("The resources store is missing the byOwner index.");
            const request = store.getAll();
            request.onsuccess = () => { records = request.result || []; };
            request.onerror = () => reject(request.error || new Error("Saved resource metadata could not be read."));
            transaction.oncomplete = () => resolve(records);
            transaction.onerror = () => reject(transaction.error || new Error("Saved resources could not be read."));
            transaction.onabort = () => reject(transaction.error || new Error("Saved resources could not be read."));
        }catch(error){
            try{ transaction?.abort(); }catch(abortError){ /* The transaction may already be inactive. */ }
            reject(error);
        }
    });
}

async function exportCompleteBackup(){
    const button = document.getElementById("exportCompleteBackupButton");
    if(button) button.disabled = true;
    setBackupStatus("Preparing complete backup…");
    let databaseInfo = null;
    try{
        if(!recycleBinStorageReady) throw new Error("Recycle Bin data could not be read safely. The complete backup was cancelled.");
        const applicationData = readCompleteBackupLocalData();
        const appVersion = "unversioned";
        databaseInfo = await getExistingResourceDatabase();
        const resources = databaseInfo ? await readResourceRecords(databaseInfo.database) : [];
        const rawFileBytes = resources.reduce((total, resource) => {
            if(!(resource.file instanceof Blob)) throw new Error("A saved resource is missing its original file contents. The complete backup was cancelled.");
            if(resource.fileSize !== resource.file.size) throw new Error("A saved resource has inconsistent file-size metadata. The complete backup was cancelled.");
            return total + resource.file.size;
        }, 0);
        const projectedBytes = JSON.stringify(applicationData).length + Math.ceil(rawFileBytes * 4 / 3);
        if(projectedBytes > COMPLETE_BACKUP_MAX_BYTES){
            throw new Error("This complete backup would exceed the 256 MB browser-safe limit. No data was omitted; export is cancelled.");
        }
        const resourceRecords = [];
        for(let index = 0; index < resources.length; index++){
            setBackupStatus(`Encoding saved resource ${index + 1} of ${resources.length}…`);
            const { file, ...metadata } = resources[index];
            resourceRecords.push({ ...metadata, fileContents: await blobToBackupContents(file) });
        }
        const backup = {
            format: COMPLETE_BACKUP_FORMAT,
            formatVersion: COMPLETE_BACKUP_FORMAT_VERSION,
            createdAt: new Date().toISOString(),
            application: { name: "IRON MIND", version: appVersion },
            dataCategories: ["tasks", "subjects", "settings", "projects", "topics and subtopics", "notes with formatting, equations, tables, and embedded images", "resources and original file contents", "Recycle Bin and retention settings"],
            applicationData,
            resources: resourceRecords
        };
        startBackupDownload(backup, backupFilename("IRON_MIND_Complete_Backup"), "Complete app backup", COMPLETE_BACKUP_MAX_BYTES);
    }catch(error){
        const message = error?.message || "The complete app backup could not be prepared. No backup was downloaded.";
        setBackupStatus(message);
        showToast(message, "error");
    }finally{
        if(databaseInfo?.shouldClose) databaseInfo.database.close();
        if(button) button.disabled = false;
    }
}

function parseBackupArray(applicationData, key, label){
    const rawValue = applicationData[key];
    if(rawValue === undefined) return [];
    const value = JSON.parse(rawValue);
    if(!Array.isArray(value)) throw new Error(`The ${label} data must be an array.`);
    return value;
}

function parseBackupObject(applicationData, key, label){
    const rawValue = applicationData[key];
    if(rawValue === undefined) return {};
    const value = JSON.parse(rawValue);
    if(!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`The ${label} data must be an object.`);
    return value;
}

function decodeBackupFileContents(encoded, mimeType, expectedSize, expectedCrc32){
    if(typeof encoded !== "string" || encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)){
        throw new Error("A resource file has invalid base64 content.");
    }
    const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
    const decodedSize = encoded.length / 4 * 3 - padding;
    if(decodedSize !== expectedSize) throw new Error("A resource file’s encoded contents do not match its recorded size.");
    if(decodedSize > COMPLETE_BACKUP_MAX_BYTES) throw new Error("The backup contains resource files larger than the browser-safe limit.");
    if(typeof expectedCrc32 !== "string" || !/^[a-f0-9]{8}$/i.test(expectedCrc32)) throw new Error("A resource file is missing its integrity checksum.");
    const chunks = [];
    const chunkLength = 65536;
    let crc = 0xFFFFFFFF;
    for(let offset = 0; offset < encoded.length; offset += chunkLength){
        const binary = atob(encoded.slice(offset, offset + chunkLength));
        const bytes = new Uint8Array(binary.length);
        for(let index = 0; index < binary.length; index++){
            const byte = binary.charCodeAt(index);
            bytes[index] = byte;
            crc = backupCrc32Table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
        }
        chunks.push(bytes);
    }
    const actualCrc32 = ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, "0");
    if(actualCrc32.toLowerCase() !== expectedCrc32.toLowerCase()) throw new Error("A resource file failed its integrity check; the backup was not applied.");
    return new Blob(chunks, { type: mimeType || "application/octet-stream" });
}

function validateCompleteBackup(backup){
    if(backup.format !== COMPLETE_BACKUP_FORMAT || backup.formatVersion !== COMPLETE_BACKUP_FORMAT_VERSION){
        throw new Error("This complete backup format or version is not supported.");
    }
    if(typeof backup.createdAt !== "string" || !Number.isFinite(Date.parse(backup.createdAt))) throw new Error("The backup creation date is missing or invalid.");
    if(!backup.application || backup.application.name !== "IRON MIND" || typeof backup.application.version !== "string") throw new Error("This backup is not for IRON MIND or is missing application metadata.");
    if(!Array.isArray(backup.dataCategories)) throw new Error("The backup is missing its data category manifest.");
    const requiredCategories = ["tasks", "subjects", "settings", "projects", "topics and subtopics", "notes with formatting, equations, tables, and embedded images", "resources and original file contents"];
    if(requiredCategories.some(category => !backup.dataCategories.includes(category))) throw new Error("The backup does not declare all required IRON MIND data categories.");
    if(!backup.applicationData || typeof backup.applicationData !== "object" || Array.isArray(backup.applicationData)) throw new Error("The backup is missing its application data.");
    if(!Array.isArray(backup.resources)) throw new Error("The backup is missing its resource-file list.");
    const applicationData = {};
    for(const [key, value] of Object.entries(backup.applicationData)){
        if(!key.startsWith("ironMind") || typeof value !== "string") throw new Error("The backup contains an invalid application data entry.");
        applicationData[key] = value;
    }
    parseBackupArray(applicationData, "ironMindSubjects", "subject");
    parseBackupArray(applicationData, "ironMindTasks", "task");
    const projectSubjects = parseBackupArray(applicationData, "ironMindProjectSubjects", "Project subject");
    const topics = parseBackupArray(applicationData, "ironMindProjectTopics", "topic");
    const notes = parseBackupArray(applicationData, "ironMindProjectNotes", "note");
    parseBackupObject(applicationData, "ironMindSettings", "settings");
    const legacySubjectIds = parseBackupObject(applicationData, "ironMindProjectSubjectIds", "Project subject identifier");
    parseBackupObject(applicationData, "ironMindProjectExpandedTopics", "topic expansion");
    const recycleEntries = parseBackupArray(applicationData, RECYCLE_BIN_KEY, "Recycle Bin");
    const recycleEntryIds = new Set();
    recycleEntries.forEach(entry => {
        if(!entry || typeof entry !== "object" || Array.isArray(entry) || typeof entry.id !== "string" || !entry.id || recycleEntryIds.has(entry.id) || typeof entry.name !== "string" || typeof entry.type !== "string" || typeof entry.deletedAt !== "string"){
            throw new Error("The backup contains invalid or duplicated Recycle Bin records.");
        }
        if(!["task", "subject", "projectSubject", "topic", "note", "resource"].includes(entry.type) || !entry.payload || typeof entry.payload !== "object" || Array.isArray(entry.payload)){
            throw new Error("The backup contains an unsupported or incomplete Recycle Bin item.");
        }
        const payload = entry.payload;
        const validPayload = entry.type === "task" ? (typeof payload.task?.id === "string" && payload.task.id || Number.isFinite(payload.task?.id))
            : entry.type === "subject" ? typeof payload.subject?.name === "string" && Array.isArray(payload.tasks)
            : entry.type === "projectSubject" ? typeof payload.subject?.id === "string" && Array.isArray(payload.topics) && Array.isArray(payload.notes)
            : entry.type === "topic" ? typeof payload.subjectId === "string" && Array.isArray(payload.topics) && Array.isArray(payload.notes)
            : entry.type === "note" ? typeof payload.note?.id === "string"
            : typeof payload.resource?.id === "string";
        if(!validPayload) throw new Error("The backup contains an incomplete Recycle Bin item payload.");
        recycleEntryIds.add(entry.id);
    });
    const subjectIds = new Set(projectSubjects.map(subject => subject?.id).filter(id => typeof id === "string"));
    Object.values(legacySubjectIds).forEach(id => { if(typeof id === "string") subjectIds.add(id); });
    const topicIds = new Set(topics.filter(topic => topic && typeof topic.id === "string" && typeof topic.subjectId === "string").map(topic => `${topic.subjectId}\u0000${topic.id}`));
    const seenResourceIds = new Set();
    let totalBytes = 0;
    const resources = backup.resources.map(resource => {
        if(!resource || typeof resource !== "object" || Array.isArray(resource)) throw new Error("The backup contains invalid resource metadata.");
        const { fileContents, ...metadata } = resource;
        if(typeof metadata.id !== "string" || !metadata.id || seenResourceIds.has(metadata.id)) throw new Error("A resource identifier is missing or duplicated.");
        seenResourceIds.add(metadata.id);
        if(typeof metadata.displayName !== "string" || typeof metadata.originalFilename !== "string" || typeof metadata.mimeType !== "string") throw new Error("A resource is missing its name or file metadata.");
        if(!Number.isSafeInteger(metadata.fileSize) || metadata.fileSize < 0) throw new Error("A resource has an invalid file size.");
        if(typeof metadata.subjectId !== "string" || typeof metadata.ownerId !== "string" || !["subject", "topic"].includes(metadata.ownerType)) throw new Error("A resource has invalid topic or subject relationships.");
        if(metadata.ownerType === "subject" && metadata.ownerId !== metadata.subjectId) throw new Error("A resource points to an inconsistent Project subject.");
        const hasSubject = subjectIds.has(metadata.subjectId);
        const hasTopic = metadata.ownerType !== "topic" || topicIds.has(`${metadata.subjectId}\u0000${metadata.ownerId}`);
        const owningTrashEntry = recycleEntries.find(entry => ["projectSubject", "topic"].includes(entry.type) && resourceMatchesRecycleEntry(metadata, entry));
        if(!hasSubject || !hasTopic){
            if(!owningTrashEntry) throw new Error("A resource refers to a missing Project subject or topic and has no matching Recycle Bin parent.");
        }
        if(metadata.recycleBinEntryId){
            const resourceEntry = recycleEntries.find(entry => entry.id === metadata.recycleBinEntryId && entry.type === "resource" && entry.payload?.resource?.id === metadata.id);
            if(!resourceEntry) throw new Error("A trashed resource is missing its matching Recycle Bin entry.");
        }
        if(metadata.order !== undefined && !Number.isFinite(metadata.order)) throw new Error("A resource has invalid ordering metadata.");
        const extension = metadata.originalFilename.split(".").pop()?.toLowerCase() || "";
        if(!PROJECT_RESOURCE_EXTENSIONS.has(extension)) throw new Error("The backup contains a resource file type IRON MIND does not support.");
        if(!fileContents || fileContents.encoding !== "base64") throw new Error("A resource’s original file contents are missing or use an unsupported encoding.");
        totalBytes += metadata.fileSize;
        if(totalBytes > COMPLETE_BACKUP_MAX_BYTES) throw new Error("The backup contains more than 256 MB of resource files and cannot be safely restored in this browser.");
        return { ...metadata, file: decodeBackupFileContents(fileContents.data, metadata.mimeType, metadata.fileSize, fileContents.crc32) };
    });
    recycleEntries.filter(entry => entry.type === "resource").forEach(entry => {
        if(!resources.some(resource => resource.id === entry.payload.resource.id && resource.recycleBinEntryId === entry.id)){
            throw new Error("A Recycle Bin resource is missing its matching uploaded file contents.");
        }
    });
    const noteIds = new Set();
    notes.forEach(note => {
        if(!note || typeof note.id !== "string" || !note.id || noteIds.has(note.id) || typeof note.subjectId !== "string" || typeof note.ownerId !== "string" || !["subject", "topic"].includes(note.ownerType)){
            throw new Error("A note record has invalid identifiers or ownership metadata.");
        }
        noteIds.add(note.id);
        if(!subjectIds.has(note.subjectId)) throw new Error("A note refers to a Project subject that is missing from the backup.");
        if(note.ownerType === "subject" && note.ownerId !== note.subjectId) throw new Error("A note points to an inconsistent Project subject.");
        if(note.ownerType === "topic" && !topicIds.has(`${note.subjectId}\u0000${note.ownerId}`)) throw new Error("A note refers to a topic that is missing from the backup.");
    });
    return { createdAt: backup.createdAt, applicationData, resources, projectSubjects, topics, notes, recycleEntries, resourceBytes: totalBytes };
}

function previewBackupCategories(validated){
    const data = validated.applicationData;
    const categories = [];
    if(data.ironMindTasks !== undefined) categories.push("tasks");
    if(data.ironMindSubjects !== undefined || data.ironMindProjectSubjects !== undefined) categories.push("subjects and projects");
    if(data.ironMindProjectTopics !== undefined) categories.push("topics and subtopics");
    if(data.ironMindProjectNotes !== undefined) categories.push("notes, formatting, equations, tables, and embedded images");
    if(data.ironMindSettings !== undefined) categories.push("app settings");
    categories.push(`${validated.resources.length} resource file(s) with original contents`);
    const trashedCount = Array.isArray(validated.recycleEntries) ? validated.recycleEntries.length : 0;
    categories.push(`${trashedCount} Recycle Bin item${trashedCount === 1 ? "" : "s"}`);
    return categories.join("; ");
}

function prepareBackupForImport(backup){
    if(backup?.format === COMPLETE_BACKUP_FORMAT){
        return { type: "complete", data: validateCompleteBackup(backup) };
    }
    if(!backup?.version || !backup.applicationData || typeof backup.applicationData !== "object" || Array.isArray(backup.applicationData)){
        throw new Error("This is not a supported IRON MIND backup file.");
    }
    const applicationData = {};
    for(const [key, value] of Object.entries(backup.applicationData)){
        if(!key.startsWith("ironMind")) throw new Error("The task backup contains an invalid data key.");
        applicationData[key] = value;
    }
    return { type: "legacy", backup: { ...backup, applicationData } };
}

function snapshotIronMindLocalStorage(){
    return readAllIronMindLocalData();
}

function replaceIronMindLocalStorage(data){
    const storage = workspaceStorage;
    for(let index = storage.length - 1; index >= 0; index--){
        const key = storage.key(index);
        if(key && key.startsWith("ironMind")) storage.removeItem(key);
    }
    Object.entries(data).forEach(([key, value]) => storage.setItem(key, value));
}

function restoreIronMindLocalStorageSnapshot(snapshot){
    replaceIronMindLocalStorage(snapshot);
}

async function replaceResourceRecords(database, resources){
    await new Promise((resolve, reject) => {
        let transaction;
        try{
            if(!database.objectStoreNames.contains(PROJECT_RESOURCE_STORE)) throw new Error("The resources object store is missing.");
            transaction = database.transaction(PROJECT_RESOURCE_STORE, "readwrite");
            const store = transaction.objectStore(PROJECT_RESOURCE_STORE);
            if(!store.indexNames.contains("byOwner")) throw new Error("The resources byOwner index is missing.");
            store.clear();
            resources.forEach(resource => store.add(resource));
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error("Resource data could not be restored."));
            transaction.onabort = () => reject(transaction.error || new Error("Resource restore was rolled back."));
        }catch(error){
            try{ transaction?.abort(); }catch(abortError){ /* The transaction may already be inactive. */ }
            reject(error);
        }
    });
}

function deleteResourceDatabaseSafely(){
    return new Promise((resolve, reject) => {
        const request = window.indexedDB.deleteDatabase(PROJECT_RESOURCES_DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error("The newly created resource database could not be removed."));
        request.onblocked = () => reject(new Error("The newly created resource database is open in another tab and could not be removed."));
    });
}

function updateAfterSuccessfulRestore(message){
    setBackupStatus(`${message} Reloading the app…`);
    showToast(message, "success");
    setTimeout(() => window.location.reload(), 1000);
}

function restoreLegacyTaskBackup(backup){
    const snapshot = snapshotIronMindLocalStorage();
    try{
        Object.entries(backup.applicationData).forEach(([key, value]) => workspaceStorage.setItem(key, String(value)));
        failedBackupRestoreSnapshot = null;
        backupRecoveryButton?.classList.add("hidden");
        updateAfterSuccessfulRestore("Task data backup restored successfully.");
    }catch(error){
        try{ restoreIronMindLocalStorageSnapshot(snapshot); }
        catch(rollbackError){
            failedBackupRestoreSnapshot = { kind: "local-only", localStorage: snapshot };
            backupRecoveryButton?.classList.remove("hidden");
            setBackupStatus("Restore failed and local rollback could not be completed. Keep this tab open and contact support before reloading.");
            showToast("Restore failed; recovery could not be completed.", "error");
            return;
        }
        const message = error?.message || "The task backup could not be restored.";
        setBackupStatus(`${message} Existing data was restored.`);
        showToast("Task backup restore failed. Existing data was restored.", "error");
    }
}

async function restoreCompleteBackup(validated){
    setBackupStatus("Preparing restore and safety snapshot…");
    let localSnapshot;
    let previousResources = [];
    let databaseInfo = null;
    let database = null;
    let databaseCreated = false;
    let resourcesCommitted = false;
    try{
        localSnapshot = snapshotIronMindLocalStorage();
        databaseInfo = await getExistingResourceDatabase();
        database = databaseInfo?.database || null;
        if(database) previousResources = await readResourceRecords(database);
        if(!database && validated.resources.length){
            database = await openProjectResourcesDatabase();
            databaseCreated = true;
        }
        failedBackupRestoreSnapshot = {
            kind: "complete",
            localStorage: localSnapshot,
            resources: previousResources,
            databaseWasPresent: Boolean(databaseInfo),
            databaseCreated
        };
        replaceIronMindLocalStorage(validated.applicationData);
        if(database){
            await replaceResourceRecords(database, validated.resources);
            resourcesCommitted = true;
        }
        failedBackupRestoreSnapshot = null;
        backupRecoveryButton?.classList.add("hidden");
        updateAfterSuccessfulRestore("Complete app backup restored successfully.");
    }catch(error){
        let rollbackFailed = false;
        if(resourcesCommitted && database){
            try{ await replaceResourceRecords(database, previousResources); }
            catch(rollbackError){ rollbackFailed = true; }
        }
        if(localSnapshot){
            try{ restoreIronMindLocalStorageSnapshot(localSnapshot); }
            catch(rollbackError){ rollbackFailed = true; }
        }
        if(databaseCreated){
            try{
                database?.close();
                projectResourcesDbPromise = null;
                await deleteResourceDatabaseSafely();
            }catch(rollbackError){ rollbackFailed = true; }
        }
        if(!rollbackFailed){
            failedBackupRestoreSnapshot = null;
            backupRecoveryButton?.classList.add("hidden");
        }else if(failedBackupRestoreSnapshot){
            backupRecoveryButton?.classList.remove("hidden");
        }
        const message = rollbackFailed
            ? "Restore failed and automatic rollback was incomplete. The pre-restore snapshot is still in memory; use Recover Pre-Restore Snapshot before leaving this page."
            : `${error?.message || "The complete backup could not be restored."} Existing data was restored.`;
        setBackupStatus(message);
        showToast(rollbackFailed ? "Restore failed; automatic rollback was incomplete." : "Restore failed. Existing data was restored.", "error");
    }finally{
        if(databaseInfo?.shouldClose) databaseInfo.database.close();
    }
}

async function recoverFailedBackupRestore(){
    const snapshot = failedBackupRestoreSnapshot;
    if(!snapshot) return;
    backupRecoveryButton.disabled = true;
    setBackupStatus("Recovering the pre-restore snapshot…");
    try{
        if(snapshot.kind === "complete" && snapshot.databaseWasPresent){
            const databaseInfo = await getExistingResourceDatabase();
            if(!databaseInfo) throw new Error("The original resource database is not available.");
            try{ await replaceResourceRecords(databaseInfo.database, snapshot.resources); }
            finally{ if(databaseInfo.shouldClose) databaseInfo.database.close(); }
        }else if(snapshot.kind === "complete" && snapshot.databaseCreated){
            if(projectResourcesDbPromise){
                try{ (await projectResourcesDbPromise).close(); }catch(error){ /* It may already be closed. */ }
                projectResourcesDbPromise = null;
            }
            await deleteResourceDatabaseSafely();
        }
        restoreIronMindLocalStorageSnapshot(snapshot.localStorage);
        failedBackupRestoreSnapshot = null;
        backupRecoveryButton.classList.add("hidden");
        updateAfterSuccessfulRestore("The pre-restore snapshot was recovered successfully.");
    }catch(error){
        setBackupStatus(`${error?.message || "Snapshot recovery failed."} The snapshot remains available in memory; retry after resolving the storage issue.`);
        showToast("Snapshot recovery failed. The snapshot remains available in this tab.", "error");
    }finally{
        backupRecoveryButton.disabled = false;
    }
}

function importBackup(){
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = event => {
        const file = event.target.files?.[0];
        if(!file) return;
        if(file.size > COMPLETE_BACKUP_MAX_BYTES){
            const message = "This backup exceeds the 256 MB browser-safe import limit.";
            setBackupStatus(message);
            showToast(message, "error");
            return;
        }
        setBackupStatus("Reading backup file…");
        const reader = new FileReader();
        reader.onload = loadEvent => {
            try{
                const backup = JSON.parse(loadEvent.target.result);
                const prepared = prepareBackupForImport(backup);
                if(prepared.type === "complete"){
                    const validated = prepared.data;
                    const categories = previewBackupCategories(validated);
                    deleteConfirmTitle.textContent = "Restore Complete App Backup";
                    openDeleteConfirmModal(
                        () => restoreCompleteBackup(validated),
                        `Backup date: ${new Date(validated.createdAt).toLocaleString()}. Contains: ${categories}. Restoring will replace current IRON MIND data and resource files. Continue?`
                    );
                    return;
                }
                deleteConfirmTitle.textContent = "Import Backup";
                openDeleteConfirmModal(
                    () => restoreLegacyTaskBackup(prepared.backup),
                    "This existing JSON backup will update its included IRON MIND data. It does not contain original resource file contents stored in IndexedDB. Continue?"
                );
            }catch(error){
                const message = error?.message || "Invalid or incompatible backup file.";
                setBackupStatus(message);
                showToast(message, "error");
            }
        };
        reader.onerror = () => {
            const message = "The selected backup file could not be read.";
            setBackupStatus(message);
            showToast(message, "error");
        };
        reader.readAsText(file);
    };
    input.click();
}

function deleteAllData(){
    deleteConfirmTitle.textContent = "Delete All Data";
    deleteConfirmMessage.textContent = "This will permanently remove all your data from IRON MIND.";
    deleteConfirmModal.classList.remove("hidden");

    const handleFirstConfirm = () => {
        closeDeleteConfirmModal();
        confirmDeleteBtn.removeEventListener("click", handleFirstConfirm);
        cancelDeleteBtn.removeEventListener("click", handleFirstCancel);

        deleteConfirmTitle.textContent = "Final Confirmation";
        deleteConfirmMessage.textContent = "This action cannot be undone. Are you absolutely sure you want to delete all data?";
        deleteConfirmModal.classList.remove("hidden");

        const handleSecondConfirm = async () => {
            closeDeleteConfirmModal();
            confirmDeleteBtn.removeEventListener("click", handleSecondConfirm);
            cancelDeleteBtn.removeEventListener("click", handleSecondCancel);

            try{
                if(window.indexedDB){
                    if(projectResourcesDbPromise){
                        try{ (await projectResourcesDbPromise).close(); }catch(error){ /* The database may not have opened. */ }
                        projectResourcesDbPromise = null;
                    }
                    await deleteResourceDatabaseSafely();
                }
                for(let i = workspaceStorage.length - 1; i >= 0; i--){
                    const key = workspaceStorage.key(i);
                    if(key && key.startsWith("ironMind")) workspaceStorage.removeItem(key);
                }
            }catch(error){
                showToast(error?.message || "Data could not be deleted safely. No local records were removed.", "error");
                return;
            }

            showToast("All data deleted successfully.", "success");
            setTimeout(() => location.reload(), 1000);
        };

        const handleSecondCancel = () => {
            closeDeleteConfirmModal();
            confirmDeleteBtn.removeEventListener("click", handleSecondConfirm);
            cancelDeleteBtn.removeEventListener("click", handleSecondCancel);
        };

        confirmDeleteBtn.addEventListener("click", handleSecondConfirm);
        cancelDeleteBtn.addEventListener("click", handleSecondCancel);
    };

    const handleFirstCancel = () => {
        closeDeleteConfirmModal();
        confirmDeleteBtn.removeEventListener("click", handleFirstConfirm);
        cancelDeleteBtn.removeEventListener("click", handleFirstCancel);
    };

    confirmDeleteBtn.addEventListener("click", handleFirstConfirm);
    cancelDeleteBtn.addEventListener("click", handleFirstCancel);
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

// Check if any modal/popup/settings is open
function isAnyModalOpen() {
    const modals = [
        subjectModal,
        taskModal,
        deleteConfirmModal,
        settingsOverlay.classList.contains("is-open") // settings panel is open
    ];
    // Also check any subject menus
    const subjectMenus = document.querySelectorAll('.subject-menu:not(.hidden)');
    return modals.some(modal => modal && !modal.classList.contains("hidden")) || subjectMenus.length > 0;
}

// Close the top-most modal/popup/settings
function closeTopMostModal() {
    // Check subject menus first
    const subjectMenus = document.querySelectorAll('.subject-menu:not(.hidden)');
    if (subjectMenus.length > 0) {
        closeAllSubjectMenus();
        return true;
    }
    // Check settings panel
    if (settingsOverlay.classList.contains("is-open")) {
        closeSettingsPanel();
        return true;
    }
    // Check delete confirm modal
    if (deleteConfirmModal && !deleteConfirmModal.classList.contains("hidden")) {
        closeDeleteConfirmModal();
        return true;
    }
    if(recycleBinDialog && !recycleBinDialog.classList.contains("hidden")){
        closeRecycleBin();
        return true;
    }
    // Check task modal
    if (taskModal && !taskModal.classList.contains("hidden")) {
        closeTaskModal();
        return true;
    }
    // Check subject modal
    if (subjectModal && !subjectModal.classList.contains("hidden")) {
        closeSubjectModal();
        return true;
    }
    return false;
}

// Check if we're on a settings sub-page (help, about)
function isSettingsSubPage() {
    return !helpPage.classList.contains("hidden") || !aboutPage.classList.contains("hidden");
}

// Check if we're on subject page
function isSubjectPage() {
    return !subjectPage.classList.contains("hidden");
}

// Main back button handler
function handleBackPress() {
    // 1. Close any open modal/popup
    if (isAnyModalOpen()) {
        closeTopMostModal();
        return;
    }

    // 2. Return from settings sub-pages
    if (isSettingsSubPage()) {
        returnFromSettingsPage();
        return;
    }

    // 3. Return from subject page to home
    if (isSubjectPage()) {
        goHome();
        return;
    }

    if(activeTab === "project" && projectState.activeNoteId && typeof returnFromProjectNote === "function"){
        returnFromProjectNote();
        return;
    }

    if(activeTab === "project" && typeof closeProjectWorkspace === "function" && projectState.subjectId){
        closeProjectWorkspace();
        return;
    }

    // 4. If on search, project, or stats page, go back to home
    if (activeTab === "search" || activeTab === "project" || activeTab === "stats" || activeTab === "statistics") {
        showTab("home");
        return;
    }

    // 5. On home page: show exit toast or exit
    const now = Date.now();
    if (now - lastBackPressTime < BACK_PRESS_TIMEOUT) {
        // Exit the app (if in PWA or WebView)
        if (window.history.length > 1) {
            window.history.back();
        } else {
            // For browsers, try to close the tab (might not work due to security)
            window.close();
        }
    } else {
        // Show "Press back again to exit" toast
        showToast("Press back again to exit", "info");
        lastBackPressTime = now;
        // Reset timer after 2 seconds
        if (backPressTimer) {
            clearTimeout(backPressTimer);
        }
        backPressTimer = setTimeout(() => {
            lastBackPressTime = 0;
        }, BACK_PRESS_TIMEOUT);
    }
}

// Handle browser back button (popstate)
function handlePopState(event) {
    handleBackPress();
}

// Initialize navigation
function initNavigation() {
    // Add event listener for browser back button
    window.addEventListener('popstate', handlePopState);
    
    // Add click listener to existing back button
    if (backButton) {
        backButton.addEventListener('click', () => {
            handleBackPress();
        });
    }
    
    // Push initial state to history to prevent exiting on first back
    if (window.history.length === 1) {
        window.history.pushState({ page: 'home' }, '', window.location.href);
    }
}

// Also override showTab, openSubjectPage, openSettingsPage to manage history if needed
// Let's wrap these functions to update history
const originalShowTab = showTab;
showTab = function(tabName) {
    originalShowTab(tabName);
    // Update history state
    if (tabName === 'home') {
        window.history.pushState({ page: 'home' }, '', window.location.href);
    } else if (tabName === 'search') {
        window.history.pushState({ page: 'search' }, '', window.location.href);
    } else if (tabName === 'project') {
        window.history.pushState({ page: 'project' }, '', window.location.href);
    } else if (tabName === 'stats' || tabName === 'statistics') {
        window.history.pushState({ page: 'statistics' }, '', window.location.href);
    }
};

const originalOpenSubjectPage = openSubjectPage;
openSubjectPage = function(subjectName) {
    originalOpenSubjectPage(subjectName);
    window.history.pushState({ page: 'subject', subject: subjectName }, '', window.location.href);
};

const originalOpenSettingsPage = openSettingsPage;
openSettingsPage = function(page) {
    originalOpenSettingsPage(page);
    let pageName = 'help';
    if (page === aboutPage) pageName = 'about';
    window.history.pushState({ page: pageName }, '', window.location.href);
};

function applyTheme(){
    const theme = appSettings.theme || "dark";
    document.documentElement.setAttribute("data-theme", theme);
}

function syncSettingsUI(){
    if(!autoDeleteSelect) return;

    autoDeleteSelect.value = appSettings.autoDelete;
    customDeleteDays.value = appSettings.customDeleteDays;
    customDeleteDaysWrap.classList.toggle("hidden", appSettings.autoDelete !== "custom");

    document.querySelectorAll("[data-theme]").forEach(button => {
        button.classList.toggle("active", button.dataset.theme === appSettings.theme);
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
        project: ["projectPage"],
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
        const isActive = button.dataset.tab === tabName;
        button.classList.toggle("active", isActive);
        if(isActive){
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
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

    if(tabName === "project"){
        if(projectState.subjectId) renderProjectWorkspace();
        else renderProjectHome();
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
                `Move “${subject.name}” and its tasks to Recycle Bin? They can be restored for ${getRecycleRetentionDays()} days.`
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

    document.body.classList.add("subject-page-open");

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
    document.body.classList.remove("subject-page-open");
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
    const isLightMode = document.documentElement.getAttribute("data-theme") === "light";

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
    ctx.strokeStyle = isLightMode ? "#D1D5DB" : "#1e293b";
    ctx.stroke();

    /* Add subtle outline in light mode */
    if (isLightMode) {
        ctx.beginPath();
        ctx.arc(
            centerX,
            centerY,
            radius + 8, // Half of lineWidth (16/2) to center the outline around the ring
            0,
            Math.PI * 2
        );
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#9CA3AF";
        ctx.stroke();
    }

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

    ctx.fillStyle = color;
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
        progress + "%",
        centerX,
        centerY - 8
    );

    ctx.fillStyle = isLightMode ? "#4B5563" : "#e5e7eb";
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
        item.innerHTML = `<div style="font-weight:700; margin-bottom:4px;">${task.subject}</div><div style="color:var(--text-secondary); font-weight:normal;">${task.topic}</div>`;
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

function getMonthlyActivityDateKey(date){
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getMonthlyActivityCalendar(todayDate, taskList){
    const today = new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        todayDate.getDate()
    );
    const todayKey = getMonthlyActivityDateKey(today);
    const tasksByDate = new Map();

    taskList.forEach(task => {
        const taskDate = convertToDate(task.task_date);
        if(!taskDate) return;

        const dateKey = getMonthlyActivityDateKey(taskDate);
        const dateTasks = tasksByDate.get(dateKey) || [];
        dateTasks.push(task);
        tasksByDate.set(dateKey, dateTasks);
    });

    // Keep 29 dates before today so it lands in row 5, column 2, followed by
    // five upcoming dates in the 35-cell chronological view.
    const calendarStart = new Date(today);
    calendarStart.setDate(today.getDate() - 29);

    return Array.from({length: 35}, (_, index) => {
        const date = new Date(calendarStart);
        date.setDate(calendarStart.getDate() + index);

        const dateKey = getMonthlyActivityDateKey(date);
        const dateTasks = tasksByDate.get(dateKey) || [];
        const taskCount = dateTasks.length;
        const completedCount = dateTasks.filter(task => task.status === "Completed").length;
        const exactPercentage = taskCount ? (completedCount / taskCount) * 100 : null;
        const isToday = dateKey === todayKey;
        const isFuture = dateKey > todayKey;
        let activityClass = "";

        if(taskCount > 0 && !isFuture){
            if(completedCount === taskCount){
                activityClass = "completed";
            } else if(exactPercentage >= 50){
                activityClass = "partial";
            } else if(!isToday){
                activityClass = "low-activity";
            }
        }

        return {
            date,
            dateKey,
            isToday,
            taskCount,
            completedCount,
            percentage: exactPercentage === null ? null : Math.round(exactPercentage),
            activityClass
        };
    });
}

function renderMonthlyActivity(){
    if(!monthlyGrid) return;

    const today = getStartOfToday();
    const calendarDays = getMonthlyActivityCalendar(today, tasks);
    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    monthlyGrid.innerHTML = calendarDays.map(day => {
        const percentageLabel = day.percentage === null ? "—" : `${day.percentage}%`;
        const fullDateLabel = day.date.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        });
        const activityLabel = day.percentage === null
            ? "no tasks assigned"
            : `${percentageLabel} complete`;

        return `<div class="contribution-cell${day.activityClass ? ` ${day.activityClass}` : ""}${day.isToday ? " today" : ""}"${day.isToday ? ' aria-current="date"' : ""} aria-label="${fullDateLabel}: ${activityLabel}" title="${fullDateLabel}: ${activityLabel}"><span class="contribution-date-day">${day.date.getDate()}</span><span class="contribution-date-weekday">${weekdayLabels[day.date.getDay()]}</span><span class="contribution-date-percentage">${percentageLabel}</span></div>`;
    }).join("");

    if(monthlyActivityRefreshTimer !== null){
        clearTimeout(monthlyActivityRefreshTimer);
    }

    const now = new Date();
    const nextLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    monthlyActivityRefreshTimer = setTimeout(() => {
        monthlyActivityRefreshTimer = null;
        renderMonthlyActivity();
    }, nextLocalMidnight.getTime() - now.getTime());
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

    renderMonthlyActivity();

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
    deleteConfirmTitle.textContent = "Delete Subject";
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

    const subject = subjects[index];
    if(!subject) return;
    const subjectName = subject.name;
    const removedTasks = tasks.filter(task => task.subject === subjectName);
    const entry = makeRecycleBinEntry("subject", subjectName, { type: "task list" }, {
        subject: { ...subject },
        subjectIndex: index,
        tasks: removedTasks.map(task => ({ ...task }))
    });
    const nextSubjects = subjects.filter((item, subjectIndex) => subjectIndex !== index);
    const nextTasks = tasks.filter(task => task.subject !== subjectName);
    if(!persistRecycleBinAndStorage([...recycleBinEntries, entry], [
        ["ironMindSubjects", nextSubjects],
        ["ironMindTasks", nextTasks]
    ])){
        showToast("The subject could not be moved to Recycle Bin. No changes were made.", "error");
        return;
    }
    subjects = nextSubjects;
    tasks = nextTasks;

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
            const isExpanded = button.hasAttribute("aria-expanded")
                ? button.getAttribute("aria-expanded") === "true"
                : !content.classList.contains("hidden");
            content.classList.toggle("hidden", isExpanded);
            if(button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", String(!isExpanded));
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

document.querySelectorAll("[data-theme]").forEach(button => {
    button.addEventListener("click", () => {
        appSettings.theme = button.dataset.theme;
        saveSettings();
        applyTheme();
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

const exportCompleteBackupButton = document.getElementById("exportCompleteBackupButton");
const importBackupButton = document.getElementById("importBackupButton");
const deleteAllDataButton = document.getElementById("deleteAllDataButton");

exportCompleteBackupButton?.addEventListener("click", exportCompleteBackup);
importBackupButton?.addEventListener("click", importBackup);
deleteAllDataButton?.addEventListener("click", deleteAllData);
recycleBinButton?.addEventListener("click", openRecycleBin);
document.getElementById("recycleBinClose")?.addEventListener("click", closeRecycleBin);
recycleBinDialog?.addEventListener("click", event => {
    if(event.target === recycleBinDialog) closeRecycleBin();
});
[recycleBinSearch, recycleBinTypeFilter, recycleBinDateFilter].forEach(control => {
    control?.addEventListener("input", renderRecycleBin);
    control?.addEventListener("change", renderRecycleBin);
});
recycleBinList?.addEventListener("click", event => {
    const button = event.target.closest("[data-recycle-action]");
    if(!button) return;
    const entryId = button.closest("[data-recycle-entry]")?.dataset.recycleEntry;
    const entry = recycleBinEntries.find(item => item.id === entryId);
    if(!entry) return;
    if(button.dataset.recycleAction === "restore"){
        button.disabled = true;
        restoreRecycleBinEntry(entryId).catch(error => {
            setRecycleBinStatus(error.message);
            showToast(error.message, "error");
        }).finally(() => { if(button.isConnected) button.disabled = false; });
    }else if(button.dataset.recycleAction === "delete"){
        deleteConfirmTitle.textContent = "Delete Permanently?";
        openDeleteConfirmModal(async () => {
            try{
                const result = await permanentlyDeleteRecycleEntry(entryId);
                if(result){
                    const message = `${recycleTypeLabel(entry.type)} permanently deleted${result.removedFiles ? ` with ${result.removedFiles} uploaded file${result.removedFiles === 1 ? "" : "s"}` : ""}.`;
                    setRecycleBinStatus(message);
                    showToast(message, "success");
                    await renderRecycleBin();
                }
            }catch(error){
                setRecycleBinStatus(error.message);
                showToast(error.message, "error");
            }
        }, `Permanently delete “${entry.name}”? This cannot be undone. Active records and files still used by the app will be kept.`);
    }
});
document.getElementById("recycleBinRestoreAll")?.addEventListener("click", restoreAllRecycleBinItems);
document.getElementById("recycleBinDeleteAll")?.addEventListener("click", () => {
    if(!recycleBinEntries.length) return;
    deleteConfirmTitle.textContent = "Permanently Delete All Recycle Bin Items";
    openDeleteConfirmModal(permanentlyDeleteAllRecycleBinItems, `Permanently delete all ${recycleBinEntries.length} items currently in Recycle Bin? This cannot be undone. Active records and files still used by the app will be kept.`);
});
recycleBinRetentionSelect?.addEventListener("change", () => {
    const previous = getRecycleRetentionDays();
    const next = Number(recycleBinRetentionSelect.value);
    const willExpire = recycleBinEntries.filter(entry => {
        const deletedAt = Date.parse(entry.deletedAt || "");
        return Number.isFinite(deletedAt) && deletedAt + next * 86400000 <= Date.now() && deletedAt + previous * 86400000 > Date.now();
    }).length;
    const apply = () => {
        appSettings.recycleBinRetentionDays = next;
        try{ saveSettings(); }
        catch(error){
            appSettings.recycleBinRetentionDays = previous;
            recycleBinRetentionSelect.value = String(previous);
            setRecycleBinStatus("The retention setting could not be saved. Your previous setting remains in effect.");
            return;
        }
        recycleBinRetentionSelect.value = String(next);
        setRecycleBinStatus(`Retention set to ${next} days${willExpire ? `. ${willExpire} existing item${willExpire === 1 ? " is" : "s are"} now eligible for automatic removal.` : "."}`);
        cleanupExpiredRecycleBin({ report: true }).finally(renderRecycleBin);
    };
    if(willExpire){
        deleteConfirmTitle.textContent = "Apply Shorter Retention?";
        recycleBinRetentionSelect.value = String(previous);
        openDeleteConfirmModal(apply, `Changing retention to ${next} days makes ${willExpire} existing item${willExpire === 1 ? "" : "s"} eligible for permanent deletion immediately. Continue?`);
    }else apply();
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

// Check if any modal/popup/settings is open
function isAnyModalOpen() {
    const searchSidebar = document.querySelector('.search-sidebar');
    const projectSidebar = document.getElementById("projectTopicSidebar");
    const modals = [
        subjectModal,
        taskModal,
        deleteConfirmModal,
        recycleBinDialog,
        document.getElementById("projectDialog"),
        document.querySelector(".project-equation-dialog-backdrop"),
        settingsOverlay.classList.contains("is-open"), // settings panel is open
        searchSidebar && searchSidebar.classList.contains("is-open"), // search drawer is open
        projectSidebar && projectSidebar.classList.contains("is-open") // project topic drawer is open
    ];
    // Also check any subject menus
    const subjectMenus = document.querySelectorAll('.subject-menu:not(.hidden)');
    const projectMenus = document.querySelectorAll('.project-subject-menu:not(.hidden), .project-topic-menu:not(.hidden), .project-note-menu:not(.hidden)');
    return modals.some(modal => {
        if (typeof modal === 'boolean') return modal;
        return modal && !modal.classList.contains("hidden");
    }) || subjectMenus.length > 0 || projectMenus.length > 0;
}

// Close the top-most modal/popup/settings
function closeTopMostModal() {
    // Check subject menus first
    const subjectMenus = document.querySelectorAll('.subject-menu:not(.hidden)');
    if (subjectMenus.length > 0) {
        closeAllSubjectMenus();
        return true;
    }
    const projectMenus = document.querySelectorAll('.project-subject-menu:not(.hidden), .project-topic-menu:not(.hidden), .project-note-menu:not(.hidden)');
    if(projectMenus.length > 0){
        closeProjectContextMenus();
        return true;
    }
    if(projectEquationDialogState){
        closeProjectEquationDialog();
        return true;
    }
    const projectDialog = document.getElementById("projectDialog");
    if(projectDialog && !projectDialog.classList.contains("hidden")){
        closeProjectDialog();
        return true;
    }
    if(deleteConfirmModal && !deleteConfirmModal.classList.contains("hidden")){
        closeDeleteConfirmModal();
        return true;
    }
    if(recycleBinDialog && !recycleBinDialog.classList.contains("hidden")){
        closeRecycleBin();
        return true;
    }
    const projectSidebar = document.getElementById("projectTopicSidebar");
    if(projectSidebar && projectSidebar.classList.contains("is-open")){
        closeProjectTreeDrawer();
        return true;
    }
    // Check search drawer
    const searchSidebar = document.querySelector('.search-sidebar');
    const searchOverlay = document.getElementById('searchDrawerOverlay');
    if (searchSidebar && searchSidebar.classList.contains("is-open")) {
        // Close search drawer
        searchSidebar.classList.remove("is-open");
        if (searchOverlay) {
            searchOverlay.classList.remove("is-visible");
            setTimeout(() => {
                if (!searchSidebar.classList.contains("is-open")) {
                    searchOverlay.classList.add("hidden");
                }
            }, 280);
        }
        return true;
    }
    // Check settings panel
    if (settingsOverlay.classList.contains("is-open")) {
        closeSettingsPanel();
        return true;
    }
    // Check delete confirm modal
    if (deleteConfirmModal && !deleteConfirmModal.classList.contains("hidden")) {
        closeDeleteConfirmModal();
        return true;
    }
    // Check task modal
    if (taskModal && !taskModal.classList.contains("hidden")) {
        closeTaskModal();
        return true;
    }
    // Check subject modal
    if (subjectModal && !subjectModal.classList.contains("hidden")) {
        closeSubjectModal();
        return true;
    }
    return false;
}

function isKeyboardTextEntryTarget(target){
    if(!(target instanceof Element)) return false;
    return Boolean(
        target.isContentEditable ||
        target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], math-field")
    );
}

function handleShortcutBack(){
    if(closeTopMostModal()) return true;
    if(isSettingsSubPage()){
        returnFromSettingsPage();
        return true;
    }
    if(isSubjectPage()){
        goHome();
        return true;
    }
    if(activeTab === "project" && projectState.activeNoteId){
        returnFromProjectNote();
        return true;
    }
    if(activeTab === "project" && projectState.subjectId){
        closeProjectWorkspace();
        return true;
    }
    if(activeTab !== "home"){
        showTab("home");
        return true;
    }
    showToast("You’re already at Home", "info");
    return true;
}

function handleGlobalKeyboardShortcuts(event){
    if(event.key === "Escape"){
        if(closeTopMostModal()){
            event.preventDefault();
            event.stopPropagation();
        }
        return;
    }

    if(isKeyboardTextEntryTarget(event.target)) return;

    const key = event.key.toLowerCase();
    const exactAlt = event.altKey && !event.ctrlKey && !event.metaKey;
    if(exactAlt && event.shiftKey && key === "n"){
        const inProjectSubjectWorkspace = activeTab === "project" && Boolean(projectState.subjectId);
        if(!inProjectSubjectWorkspace) return;
        const titleInput = projectDialog.querySelector("#projectNewNoteTitle");
        if(titleInput && !projectDialog.classList.contains("hidden")){
            titleInput.focus();
        }else if(projectDialog.classList.contains("hidden") && !isAnyModalOpen()){
            const createNoteButton = document.getElementById("projectCreateNoteButton");
            if(!createNoteButton) return;
            createNoteButton.click();
        }else{
            return;
        }
        event.preventDefault();
        return;
    }

    if(exactAlt && !event.shiftKey && key === "n"){
        if(!isSubjectPage() || !currentSubject) return;
        if(!taskModal.classList.contains("hidden")){
            topicInput.focus();
        }else if(!isAnyModalOpen() && projectDialog.classList.contains("hidden")){
            openTaskModal();
            requestAnimationFrame(() => topicInput.focus());
        }else{
            return;
        }
        event.preventDefault();
        return;
    }

    if(event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && key === "k"){
        const inProjectSubjectWorkspace = activeTab === "project" && Boolean(projectState.subjectId);
        if(!inProjectSubjectWorkspace) return;
        if(!projectDialog.classList.contains("hidden")){
            if(projectDialog.classList.contains("is-search-popup")) projectDialog.querySelector("#projectSearchInput")?.focus();
            else return;
        }else if(!isAnyModalOpen()){
            openProjectSearchPopup();
        }else{
            return;
        }
        event.preventDefault();
        return;
    }

    if(exactAlt && !event.shiftKey && event.key === "ArrowLeft"){
        handleShortcutBack();
        event.preventDefault();
    }
}

document.addEventListener("keydown", handleGlobalKeyboardShortcuts);

window.addEventListener("resize", closeAllSubjectMenus);
subjectGrid?.addEventListener("scroll", closeAllSubjectMenus);

saveSubjectBtn.addEventListener(
    "click",
    saveSubject
);
/* ================= START APP ================= */

applyTheme();
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

    const expiredTasks = [];
    const remainingTasks = tasks.filter(task => {
        const taskDate = convertToDate(task.task_date);
        if(taskDate && taskDate < cutoffDate){ expiredTasks.push(task); return false; }
        return true;
    });

    if(expiredTasks.length){
        const nextEntries = [...recycleBinEntries, ...expiredTasks.map(task => makeRecycleBinEntry("task", task.topic || "Task", { subject: task.subject || "" }, { task: { ...task } }))];
        if(!persistRecycleBinAndStorage(nextEntries, [["ironMindTasks", remainingTasks]])){
            showToast("Older tasks could not be moved to Recycle Bin and were kept.", "error");
            return false;
        }
        tasks = remainingTasks;
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
    const task = tasks.find(item => item.id === taskId);
    if(!task) return;
    const entry = makeRecycleBinEntry("task", task.topic || "Task", { subject: task.subject || "" }, { task: { ...task } });
    const nextTasks = tasks.filter(item => item.id !== taskId);
    if(!persistRecycleBinAndStorage([...recycleBinEntries, entry], [["ironMindTasks", nextTasks]])){
        showToast("The task could not be moved to Recycle Bin. No changes were made.", "error");
        return;
    }
    tasks = nextTasks;

    showToast("Task moved to Recycle Bin.", "success");

    renderTasks();

    updateSubjectStats();

    refreshDashboard();
}

function updateRecycleBinCount(){
    if(recycleBinCount) recycleBinCount.textContent = String(recycleBinEntries.length);
}

function recycleTypeLabel(type){
    return ({ task: "Task", subject: "Task Subject", projectSubject: "Project Subject", topic: "Topic", note: "Note", resource: "Resource" })[type] || "Item";
}

function recycleEntryLocation(entry){
    const parent = entry.parent || {};
    if(entry.type === "topic" || entry.type === "note" || entry.type === "resource"){
        const parts = [parent.subjectName || "Project"];
        if(parent.topicName) parts.push(parent.topicName);
        else if(parent.parentName && parent.parentName !== "Subject root") parts.push(parent.parentName);
        if(entry.type === "note") parts.push("Note");
        return parts.join(" › ");
    }
    if(entry.type === "task") return parent.subject ? `Tasks › ${parent.subject}` : "Tasks";
    return parent.type || "Original location";
}

function recycleBinFilteredEntries(){
    const query = (recycleBinSearch?.value || "").trim().toLocaleLowerCase();
    const type = recycleBinTypeFilter?.value || "all";
    const dateRange = recycleBinDateFilter?.value || "all";
    const cutoff = dateRange === "all" ? null : Date.now() - Number(dateRange) * 86400000;
    return recycleBinEntries
        .filter(entry => type === "all" || entry.type === type)
        .filter(entry => {
            const deletedAt = Date.parse(entry.deletedAt || "");
            return cutoff === null || (Number.isFinite(deletedAt) && deletedAt >= cutoff);
        })
        .filter(entry => !query || `${entry.name} ${recycleTypeLabel(entry.type)} ${recycleEntryLocation(entry)}`.toLocaleLowerCase().includes(query))
        .sort((left, right) => Date.parse(right.deletedAt) - Date.parse(left.deletedAt));
}

function openRecycleBin(){
    recycleBinDialog?.classList.remove("hidden");
    recycleBinDialog?.setAttribute("aria-hidden", "false");
    if(recycleBinRetentionSelect) recycleBinRetentionSelect.value = String(getRecycleRetentionDays());
    cleanupExpiredRecycleBin({ report: true }).finally(() => renderRecycleBin());
    recycleBinDialog?.querySelector(".recycle-bin-panel")?.focus({ preventScroll: true });
}

function closeRecycleBin(){
    recycleBinDialog?.classList.add("hidden");
    recycleBinDialog?.setAttribute("aria-hidden", "true");
}

async function renderRecycleBin(){
    if(!recycleBinList) return;
    updateRecycleBinCount();
    if(recycleBinRetentionSelect) recycleBinRetentionSelect.value = String(getRecycleRetentionDays());
    const entries = recycleBinFilteredEntries();
    const summary = document.getElementById("recycleBinSummary");
    if(summary) summary.textContent = `${entries.length} recoverable item${entries.length === 1 ? "" : "s"} shown (${recycleBinEntries.length} total)`;
    document.getElementById("recycleBinRestoreAll").disabled = recycleBinEntries.length === 0;
    document.getElementById("recycleBinDeleteAll").disabled = recycleBinEntries.length === 0;
    if(!entries.length){
        recycleBinList.innerHTML = `<div class="recycle-bin-empty">${recycleBinEntries.length ? "No items match these filters." : "Your Recycle Bin is empty."}</div>`;
        return;
    }
    let storedResources = [];
    if(entries.some(entry => ["projectSubject", "topic", "resource"].includes(entry.type))){
        try{
            const databaseInfo = await getExistingResourceDatabase();
            if(databaseInfo){
                try{ storedResources = await readResourceRecords(databaseInfo.database); }
                finally{ if(databaseInfo.shouldClose) databaseInfo.database.close(); }
            }
        }catch(error){
            if(recycleBinStatus) recycleBinStatus.textContent = `Saved resource details could not be read: ${error.message}`;
        }
    }
    recycleBinList.innerHTML = entries.map(entry => {
        const expiry = recycleExpirationDate(entry);
        const validTimestamp = Number.isFinite(Date.parse(entry.deletedAt || ""));
        const remaining = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
        const expiryText = expiry
            ? remaining <= 0 ? "Expired; automatic removal pending" : `${remaining} day${remaining === 1 ? "" : "s"} left · expires ${expiry.toLocaleDateString()}`
            : "Expiration unavailable; item is kept until its deletion date is valid";
        const urgent = remaining !== null && remaining <= 3;
        const related = storedResources.filter(resource => resource.recycleBinEntryId === entry.id || resourceMatchesRecycleEntry(resource, entry));
        const relatedText = related.length ? ` · ${related.length} uploaded file${related.length === 1 ? "" : "s"} preserved` : "";
        const childCountText = entry.type === "projectSubject"
            ? ` · ${(entry.payload?.topics || []).length} topic${(entry.payload?.topics || []).length === 1 ? "" : "s"}, ${(entry.payload?.notes || []).length} note${(entry.payload?.notes || []).length === 1 ? "" : "s"}`
            : entry.type === "topic"
                ? ` · ${(entry.payload?.topics || []).length - 1} nested topic${(entry.payload?.topics || []).length === 2 ? "" : "s"}, ${(entry.payload?.notes || []).length} note${(entry.payload?.notes || []).length === 1 ? "" : "s"}`
                : entry.type === "subject" ? ` · ${(entry.payload?.tasks || []).length} task${(entry.payload?.tasks || []).length === 1 ? "" : "s"}` : "";
        return `<article class="recycle-bin-item" data-recycle-entry="${escapeProjectHtml(entry.id)}">
            <div class="recycle-bin-item-main">
                <h3 class="recycle-bin-item-title"><span>${escapeProjectHtml(entry.name)}</span><span class="recycle-bin-type">${recycleTypeLabel(entry.type)}</span></h3>
                <p class="recycle-bin-item-meta">${escapeProjectHtml(recycleEntryLocation(entry))}${childCountText}${relatedText} · Deleted ${validTimestamp ? new Date(entry.deletedAt).toLocaleString() : "date unavailable"}<br><span class="recycle-bin-expiry ${urgent ? "is-urgent" : ""}">${escapeProjectHtml(expiryText)}</span></p>
            </div>
            <div class="recycle-bin-item-actions"><button type="button" data-recycle-action="restore">Restore</button><button type="button" class="is-danger" data-recycle-action="delete">Delete Permanently</button></div>
        </article>`;
    }).join("");
}

function resourceMatchesRecycleEntry(resource, entry){
    if(entry.type === "resource") return resource.id === entry.payload?.resource?.id;
    if(entry.type === "projectSubject"){
        const subjectId = entry.payload?.subject?.id;
        const topicIds = new Set((entry.payload?.topics || []).map(topic => topic.id));
        return resource.subjectId === subjectId && ((resource.ownerType === "subject" && resource.ownerId === subjectId) || (resource.ownerType === "topic" && topicIds.has(resource.ownerId)));
    }
    if(entry.type === "topic"){
        const topicIds = new Set((entry.payload?.topics || []).map(topic => topic.id));
        return resource.subjectId === entry.payload?.subjectId && resource.ownerType === "topic" && topicIds.has(resource.ownerId);
    }
    return false;
}

function removeRecycleEntry(entryId){
    const nextEntries = recycleBinEntries.filter(item => item.id !== entryId);
    if(nextEntries.length === recycleBinEntries.length) throw new Error("This Recycle Bin item is no longer available.");
    return nextEntries;
}

function recycleEntryDependencies(entry){
    const topicIds = new Set(entry.payload?.topics?.map(topic => topic.id) || []);
    const subjectId = entry.payload?.subject?.id || entry.payload?.subjectId;
    const subjectName = entry.payload?.subject?.name;
    return recycleBinEntries.filter(candidate => {
        if(candidate.id === entry.id) return false;
        if(entry.type === "subject") return candidate.type === "task" && candidate.parent?.subject === subjectName;
        if(entry.type === "projectSubject") return ["topic", "note", "resource"].includes(candidate.type) && (
            candidate.payload?.subjectId === subjectId || candidate.payload?.note?.subjectId === subjectId || candidate.payload?.resource?.subjectId === subjectId
        );
        if(entry.type !== "topic") return false;
        if(candidate.type === "topic"){
            const candidateRoot = (candidate.payload?.topics || []).find(topic => !(candidate.payload?.topics || []).some(child => child.id === topic.parentId));
            return candidate.payload?.subjectId === subjectId && (candidateRoot && topicIds.has(candidateRoot.parentId) || (candidate.payload?.topics || []).some(topic => topicIds.has(topic.id)));
        }
        if(candidate.type === "note") return candidate.payload?.note?.subjectId === subjectId && topicIds.has(candidate.payload?.note?.ownerId);
        if(candidate.type === "resource") return candidate.payload?.resource?.subjectId === subjectId && candidate.payload?.resource?.ownerType === "topic" && topicIds.has(candidate.payload?.resource?.ownerId);
        return false;
    });
}

function isSupportedRecycleEntry(entry){
    if(!entry || typeof entry.id !== "string" || !entry.id || typeof entry.name !== "string" || !entry.payload || typeof entry.payload !== "object" || Array.isArray(entry.payload)) return false;
    const payload = entry.payload;
    if(entry.type === "task") return Boolean(payload.task && (typeof payload.task.id === "string" && payload.task.id || Number.isFinite(payload.task.id)));
    if(entry.type === "subject") return Boolean(payload.subject && typeof payload.subject.name === "string" && Array.isArray(payload.tasks));
    if(entry.type === "projectSubject") return Boolean(payload.subject && typeof payload.subject.id === "string" && Array.isArray(payload.topics) && Array.isArray(payload.notes));
    if(entry.type === "topic") return typeof payload.subjectId === "string" && Array.isArray(payload.topics) && Array.isArray(payload.notes);
    if(entry.type === "note") return Boolean(payload.note && typeof payload.note.id === "string");
    if(entry.type === "resource") return Boolean(payload.resource && typeof payload.resource.id === "string");
    return false;
}

function isCleanupEligibleRecycleEntry(entry, now = Date.now()){
    if(!isSupportedRecycleEntry(entry) || typeof entry.deletedAt !== "string") return false;
    const deletedAt = Date.parse(entry.deletedAt);
    return Number.isFinite(deletedAt) && deletedAt + getRecycleRetentionDays() * 86400000 <= now;
}

function hasDuplicateIds(existing, incoming, label){
    const existingIds = new Set(existing.map(item => item?.id).filter(Boolean));
    const seen = new Set();
    for(const item of incoming){
        if(!item || !(typeof item.id === "string" && item.id || Number.isFinite(item.id))) throw new Error(`A ${label} record is missing its identifier.`);
        if(existingIds.has(item.id) || seen.has(item.id)) throw new Error(`Cannot restore because a ${label} with the same identifier already exists. Resolve that item first; nothing was overwritten.`);
        seen.add(item.id);
    }
}

async function ensureRecycleEntryParents(entry, options = {}){
    if(entry.type === "task"){
        const subjectName = entry.payload?.task?.subject;
        if(subjectName && !subjects.some(subject => subject.name === subjectName)){
            const parentEntry = recycleBinEntries.find(item => item.type === "subject" && item.payload?.subject?.name === subjectName);
            if(parentEntry) await restoreRecycleBinEntry(parentEntry.id, { silent: true, deferUI: options.deferUI });
            else throw new Error(`The original task subject “${subjectName}” is missing. Restore it first or create that subject before restoring this task.`);
        }
        return;
    }
    if(!["topic", "note", "resource"].includes(entry.type)) return;
    const subjectId = entry.payload?.subjectId || entry.payload?.note?.subjectId || entry.payload?.resource?.subjectId;
    if(!subjectId) return;
    if(!projectSubjectRecords.some(item => getProjectSubjectId(item, false) === subjectId)){
        const deletedSubject = recycleBinEntries.find(item => item.type === "projectSubject" && item.payload?.subject?.id === subjectId);
        if(deletedSubject) await restoreRecycleBinEntry(deletedSubject.id, { silent: true, deferUI: options.deferUI });
        else throw new Error("The original Project subject is missing. Restore that subject first.");
    }
    const noteOrResource = entry.payload?.note || entry.payload?.resource;
    const ownerType = noteOrResource?.ownerType || entry.parent?.ownerType;
    const ownerId = noteOrResource?.ownerId || entry.parent?.ownerId;
    if(ownerType === "topic" && !projectTopicRecords.some(topic => topic.id === ownerId && topic.subjectId === subjectId)){
        const deletedParent = recycleBinEntries.find(item => item.type === "topic" && item.payload?.topics?.some(topic => topic.id === ownerId && topic.subjectId === subjectId));
        if(deletedParent && deletedParent.id !== entry.id) await restoreRecycleBinEntry(deletedParent.id, { silent: true, deferUI: options.deferUI });
        else throw new Error("The original topic is missing. Restore its parent topic first.");
    }
    if(entry.type === "topic"){
        const incoming = entry.payload?.topics || [];
        const root = incoming.find(topic => !incoming.some(candidate => candidate.id === topic.parentId));
        if(root?.parentId && !projectTopicRecords.some(topic => topic.id === root.parentId && topic.subjectId === root.subjectId)){
            const deletedParent = recycleBinEntries.find(item => item.type === "topic" && item.id !== entry.id && item.payload?.topics?.some(topic => topic.id === root.parentId && topic.subjectId === root.subjectId));
            if(deletedParent) await restoreRecycleBinEntry(deletedParent.id, { silent: true, deferUI: options.deferUI });
            else throw new Error("The original parent topic is missing. Restore it first.");
        }
    }
}

async function restoreRecycleBinEntry(entryId, options = {}){
    const entry = recycleBinEntries.find(item => item.id === entryId);
    if(!entry) throw new Error("This Recycle Bin item is no longer available.");
    if(!isSupportedRecycleEntry(entry)) throw new Error("This Recycle Bin record is incomplete or unsupported and was kept unchanged.");
    await ensureRecycleEntryParents(entry, options);
    const remaining = removeRecycleEntry(entry.id);
    const payload = entry.payload || {};

    if(entry.type === "task"){
        const task = payload.task;
        if(!task) throw new Error("This task’s saved data is incomplete, so it cannot be restored safely.");
        hasDuplicateIds(tasks, [task], "task");
        const nextTasks = [...tasks, { ...task }];
        if(!persistRecycleBinAndStorage(remaining, [["ironMindTasks", nextTasks]])) throw new Error("The task could not be restored because local storage could not be updated.");
        tasks = nextTasks;
    }else if(entry.type === "subject"){
        const subject = payload.subject;
        const storedTasks = payload.tasks || [];
        if(!subject || subjects.some(item => item.name?.toLocaleLowerCase() === subject.name?.toLocaleLowerCase())) throw new Error("A task subject with this name already exists. Nothing was overwritten.");
        hasDuplicateIds(tasks, storedTasks, "task");
        const nextSubjects = [...subjects];
        nextSubjects.splice(Math.min(Number(payload.subjectIndex) || 0, nextSubjects.length), 0, { ...subject });
        const nextTasks = [...tasks, ...storedTasks.map(task => ({ ...task }))];
        if(!persistRecycleBinAndStorage(remaining, [["ironMindSubjects", nextSubjects], ["ironMindTasks", nextTasks]])) throw new Error("The task subject could not be restored because local storage could not be updated.");
        subjects = nextSubjects;
        tasks = nextTasks;
    }else if(entry.type === "projectSubject"){
        const subject = payload.subject;
        const topics = payload.topics || [];
        const notes = payload.notes || [];
        if(!subject || projectSubjectRecords.some(item => getProjectSubjectId(item, false) === subject.id || item.name?.toLocaleLowerCase() === subject.name?.toLocaleLowerCase())) throw new Error("A Project subject with this identifier or name already exists. Nothing was overwritten.");
        hasDuplicateIds(projectTopicRecords, topics, "topic");
        hasDuplicateIds(projectNoteRecords, notes, "note");
        const nextSubjects = [...projectSubjectRecords, { ...subject }];
        const nextTopics = [...projectTopicRecords, ...topics.map(topic => ({ ...topic }))];
        const nextNotes = [...projectNoteRecords, ...notes.map(note => ({ ...note }))];
        const nextExpanded = { ...projectExpandedBySubject };
        if(payload.hadExpandedState) nextExpanded[subject.id] = [...(payload.expandedState || [])];
        const nextSubjectIds = { ...projectSubjectIds };
        for(const [name, id] of payload.subjectIdMappings || []){
            const existingMappingKey = Object.keys(nextSubjectIds).find(key => key.toLocaleLowerCase() === String(name).toLocaleLowerCase());
            if(existingMappingKey && nextSubjectIds[existingMappingKey] !== id) throw new Error("A Project subject mapping now points to another subject. Resolve it before restoring.");
            nextSubjectIds[name] = id;
        }
        if(!persistRecycleBinAndStorage(remaining, [
            ["ironMindProjectSubjects", nextSubjects], ["ironMindProjectTopics", nextTopics], [PROJECT_NOTES_KEY, nextNotes],
            ["ironMindProjectExpandedTopics", nextExpanded], ["ironMindProjectSubjectIds", nextSubjectIds]
        ])) throw new Error("The Project subject could not be restored because local storage could not be updated.");
        projectSubjectRecords = nextSubjects; projectTopicRecords = nextTopics; projectNoteRecords = nextNotes;
        projectExpandedBySubject = nextExpanded; projectSubjectIds = nextSubjectIds;
    }else if(entry.type === "topic"){
        const incoming = payload.topics || [];
        hasDuplicateIds(projectTopicRecords, incoming, "topic");
        for(const topic of incoming){
            if(projectTopicRecords.some(existing => existing.subjectId === topic.subjectId && existing.parentId === topic.parentId && existing.name?.toLocaleLowerCase() === topic.name?.toLocaleLowerCase())){
                throw new Error(`A topic named “${topic.name}” already exists in its original location. Rename or move the existing topic before restoring.`);
            }
        }
        const nextTopics = [...projectTopicRecords, ...incoming.map(topic => ({ ...topic }))];
        const root = incoming.find(topic => !incoming.some(candidate => candidate.id === topic.parentId));
        if(root){
            nextTopics.filter(topic => topic.subjectId === root.subjectId && topic.parentId === root.parentId && topic.id !== root.id && topic.order >= root.order).forEach(topic => topic.order += 1);
        }
        const notes = payload.notes || [];
        hasDuplicateIds(projectNoteRecords, notes, "note");
        const nextNotes = [...projectNoteRecords, ...notes.map(note => ({ ...note }))];
        const nextExpanded = { ...projectExpandedBySubject };
        if(payload.hadExpandedState) nextExpanded[payload.subjectId] = [...new Set([...(nextExpanded[payload.subjectId] || []), ...(payload.expandedState || [])])];
        if(!persistRecycleBinAndStorage(remaining, [["ironMindProjectTopics", nextTopics], [PROJECT_NOTES_KEY, nextNotes], ["ironMindProjectExpandedTopics", nextExpanded]])) throw new Error("The topic and its notes could not be restored because local storage could not be updated.");
        projectTopicRecords = nextTopics; projectNoteRecords = nextNotes; projectExpandedBySubject = nextExpanded;
    }else if(entry.type === "note"){
        const note = payload.note;
        if(!note) throw new Error("This note’s saved data is incomplete, so it cannot be restored safely.");
        hasDuplicateIds(projectNoteRecords, [note], "note");
        const nextNotes = [...projectNoteRecords, { ...note }];
        if(!persistRecycleBinAndStorage(remaining, [[PROJECT_NOTES_KEY, nextNotes]])) throw new Error("The note could not be restored because local storage could not be updated.");
        projectNoteRecords = nextNotes;
    }else if(entry.type === "resource"){
        const resource = payload.resource;
        if(!resource?.id) throw new Error("This resource’s saved metadata is incomplete.");
        const owner = { subjectId: resource.subjectId, ownerType: resource.ownerType, ownerId: resource.ownerId };
        const activeResources = await loadProjectResources(owner.subjectId, owner.ownerType, owner.ownerId);
        if(activeResources.some(item => item.displayName?.toLocaleLowerCase() === resource.displayName?.toLocaleLowerCase())) throw new Error("A resource with this name already exists in its original location. Rename or move that item before restoring.");
        if(!persistRecycleBinAndStorage(remaining)) throw new Error("The resource could not be restored because local storage could not be updated.");
        try{ await updateRecycleResourceMarker(resource.id, entry.id, true); }
        catch(error){
            if(!persistRecycleBinAndStorage([...recycleBinEntries, entry])) throw new Error(`${error.message} Its Recycle Bin record could not be reinstated; keep this tab open.`);
            throw error;
        }
    }else throw new Error("This item type is not supported for restoration.");

    if(!options.deferUI){
        refreshDashboard();
        buildSubjects();
        renderSearchResults();
        if(activeTab === "project"){
            if(projectState.subjectId) renderProjectWorkspace();
            else renderProjectHome();
        }
        if(recycleBinDialog && !recycleBinDialog.classList.contains("hidden")) await renderRecycleBin();
    }
    if(!options.silent) showToast(`${recycleTypeLabel(entry.type)} restored successfully.`, "success");
    return true;
}

function resourceOwnerIsActive(resource){
    const hasSubject = projectSubjectRecords.some(subject => getProjectSubjectId(subject, false) === resource.subjectId);
    if(!hasSubject) return false;
    return resource.ownerType === "subject"
        ? resource.ownerId === resource.subjectId
        : projectTopicRecords.some(topic => topic.id === resource.ownerId && topic.subjectId === resource.subjectId);
}

async function removeRecycleEntryResources(entry){
    if(!["resource", "projectSubject", "topic"].includes(entry.type)) return 0;
    const databaseInfo = await getExistingResourceDatabase();
    if(!databaseInfo){
        if(entry.type === "resource") throw new Error("The original resource database is unavailable. The Recycle Bin item was kept.");
        return 0;
    }
    try{
        return await new Promise((resolve, reject) => {
            let transaction;
            let removedCount = 0;
            try{
                transaction = databaseInfo.database.transaction(PROJECT_RESOURCE_STORE, "readwrite");
                const store = transaction.objectStore(PROJECT_RESOURCE_STORE);
                const request = store.getAll();
                request.onsuccess = () => {
                    for(const resource of request.result || []){
                        const associated = resourceMatchesRecycleEntry(resource, entry);
                        const isOwnedTrashedResource = entry.type === "resource" && resource.id === entry.payload?.resource?.id;
                        if(!associated && !isOwnedTrashedResource) continue;
                        if(isOwnedTrashedResource){
                            if(resource.recycleBinEntryId !== entry.id){
                                transaction.abort();
                                return;
                            }
                        }else if(resource.recycleBinEntryId || resourceOwnerIsActive(resource)){
                            continue;
                        }
                        try{ store.delete(resource.id); removedCount += 1; }
                        catch(error){ transaction.abort(); return; }
                    }
                };
                request.onerror = () => reject(request.error || new Error("Resource references could not be checked."));
                transaction.oncomplete = () => resolve(removedCount);
                transaction.onerror = () => reject(transaction.error || new Error("Saved resource files could not be removed."));
                transaction.onabort = () => reject(transaction.error || new Error("Saved resource files could not be removed safely."));
            }catch(error){
                try{ transaction?.abort(); }catch(abortError){ /* Transaction is already inactive. */ }
                reject(error);
            }
        });
    }finally{
        if(databaseInfo.shouldClose) databaseInfo.database.close();
    }
}

async function permanentlyDeleteRecycleEntry(entryId){
    const entry = recycleBinEntries.find(item => item.id === entryId);
    if(!entry) return false;
    if(!isSupportedRecycleEntry(entry)) throw new Error("This Recycle Bin record is incomplete or unsupported and was kept unchanged.");
    const dependencies = recycleEntryDependencies(entry);
    if(dependencies.length){
        throw new Error(`This item has ${dependencies.length} separately deleted child item${dependencies.length === 1 ? "" : "s"}. Restore or permanently delete those first.`);
    }
    const remaining = removeRecycleEntry(entry.id);
    if(!persistRecycleBinAndStorage(remaining)) throw new Error("The Recycle Bin could not be updated. No data was removed.");
    try{
        const removedFiles = await removeRecycleEntryResources(entry);
        return { removedFiles };
    }catch(error){
        if(!persistRecycleBinAndStorage([...recycleBinEntries, entry])){
            throw new Error(`${error.message} The Recycle Bin entry could not be reinstated; keep this tab open and retry.`);
        }
        throw error;
    }
}

async function cleanupExpiredRecycleBin(options = {}){
    const now = Date.now();
    let removed = 0;
    const errors = [];
    const expiredEntries = [...recycleBinEntries].sort((left, right) => Date.parse(left.deletedAt) - Date.parse(right.deletedAt));
    for(const entry of expiredEntries){
        if(!isCleanupEligibleRecycleEntry(entry, now)) continue;
        try{
            if(await permanentlyDeleteRecycleEntry(entry.id)) removed += 1;
        }catch(error){ errors.push(`${entry.name}: ${error.message}`); }
    }
    if(removed) setRecycleBinStatus(`${removed} expired item${removed === 1 ? " was" : "s were"} permanently removed.`);
    if(errors.length){
        const message = `Automatic cleanup kept ${errors.length} expired item${errors.length === 1 ? "" : "s"} because deletion failed: ${errors.slice(0, 2).join("; ")}`;
        setRecycleBinStatus(message);
        if(options.report) showToast(message, "error");
    }
    if(removed && recycleBinDialog && !recycleBinDialog.classList.contains("hidden")) await renderRecycleBin();
    return { removed, errors };
}

function setRecycleBinStatus(message){
    if(recycleBinStatus) recycleBinStatus.textContent = message || "";
}

async function restoreAllRecycleBinItems(){
    const initialEntries = [...recycleBinEntries];
    const ordered = [...initialEntries].sort((left, right) => {
        const order = { subject: 0, projectSubject: 1, topic: 2, note: 3, resource: 4, task: 5 };
        return (order[left.type] ?? 9) - (order[right.type] ?? 9) || Date.parse(left.deletedAt) - Date.parse(right.deletedAt);
    });
    const errors = [];
    for(const entry of ordered){
        if(!recycleBinEntries.some(item => item.id === entry.id)) continue;
        try{ await restoreRecycleBinEntry(entry.id, { silent: true, deferUI: true }); }
        catch(error){ errors.push(`${entry.name}: ${error.message}`); }
    }
    const restored = initialEntries.filter(entry => !recycleBinEntries.some(item => item.id === entry.id)).length;
    refreshDashboard(); buildSubjects(); renderSearchResults();
    if(activeTab === "project"){
        if(projectState.subjectId) renderProjectWorkspace();
        else renderProjectHome();
    }
    const message = `Restored ${restored} of ${ordered.length} item${ordered.length === 1 ? "" : "s"}.${errors.length ? ` ${errors.length} remain in Recycle Bin: ${errors.slice(0, 2).join("; ")}` : ""}`;
    setRecycleBinStatus(message);
    showToast(message, errors.length ? "error" : "success");
    await renderRecycleBin();
}

async function permanentlyDeleteAllRecycleBinItems(){
    const initialCount = recycleBinEntries.length;
    let deleted = 0;
    let files = 0;
    const errors = [];
    let madeProgress = true;
    while(recycleBinEntries.length && madeProgress){
        madeProgress = false;
        for(const entry of [...recycleBinEntries]){
            try{
                const result = await permanentlyDeleteRecycleEntry(entry.id);
                if(result){ deleted += 1; files += result.removedFiles; madeProgress = true; }
            }catch(error){
                if(!errors.some(item => item.startsWith(`${entry.id}:`))) errors.push(`${entry.id}: ${entry.name}: ${error.message}`);
            }
        }
    }
    const remaining = recycleBinEntries.length;
    const message = `Permanently deleted ${deleted} of ${initialCount} item${initialCount === 1 ? "" : "s"} and ${files} uploaded file${files === 1 ? "" : "s"}.${remaining ? ` ${remaining} item${remaining === 1 ? "" : "s"} were kept because deletion failed or requires child items to be resolved: ${errors.slice(0, 2).map(item => item.split(": ").slice(1).join(": ")).join("; ")}` : ""}`;
    setRecycleBinStatus(message);
    showToast(message, errors.length ? "error" : "success");
    await renderRecycleBin();
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
                renderMonthlyActivity();

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
                    `Move “${task.topic || "Task"}” to Recycle Bin? It can be restored for ${getRecycleRetentionDays()} days.`
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

    /* Close: selecting any subject filter item auto-closes the drawer */
    sidebar.addEventListener("click", (event) => {
        if (event.target.closest(".subject-filter-item")) {
            closeDrawer();
        }
    });
})();

// Initialize navigation (back button handling)
function initNavigation() {
    // Handle browser back button
    window.addEventListener('popstate', (event) => {
        if (isAnyModalOpen()) {
            event.preventDefault();
            closeTopMostModal();
        }
    });
}

// Initialize back button navigation
initNavigation();

/* ================= PROJECT SUBJECTS + TOPIC TREE ================= */

function readProjectStorage(key, fallback){
    try{
        const value = workspaceStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    }catch(error){
        return fallback;
    }
}

function createProjectId(){
    if(window.crypto && typeof window.crypto.randomUUID === "function"){
        return window.crypto.randomUUID();
    }
    return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function openProjectResourcesDatabase(){
    if(!window.indexedDB) return Promise.reject(new Error("This browser does not support local resource storage."));
    if(!projectResourcesDbPromise){
        let wasBlocked = false;
        projectResourcesDbPromise = new Promise((resolve, reject) => {
            const request = window.indexedDB.open(PROJECT_RESOURCES_DB_NAME, PROJECT_RESOURCES_DB_VERSION);
            request.onupgradeneeded = () => {
                const database = request.result;
                let store;
                if(!database.objectStoreNames.contains(PROJECT_RESOURCE_STORE)){
                    store = database.createObjectStore(PROJECT_RESOURCE_STORE, { keyPath: "id" });
                }else store = request.transaction.objectStore(PROJECT_RESOURCE_STORE);
                if(!store.indexNames.contains("byOwner")) store.createIndex("byOwner", ["subjectId", "ownerType", "ownerId"], { unique: false });
            };
            request.onsuccess = () => {
                const database = request.result;
                if(wasBlocked){ database.close(); return; }
                database.onversionchange = () => database.close();
                resolve(database);
            };
            request.onerror = () => reject(request.error || new Error("Local resource storage could not be opened."));
            request.onblocked = () => {
                wasBlocked = true;
                reject(new Error("Local resource storage is busy in another app window. Close other IRON MIND windows and try again."));
            };
        }).catch(error => {
            projectResourcesDbPromise = null;
            throw error;
        });
    }
    return projectResourcesDbPromise;
}

function sortProjectResourceRecords(resources){
    const hasCompleteOrder = resources.every(resource => Number.isFinite(resource.order));
    return [...resources].sort((left, right) => {
        if(hasCompleteOrder && left.order !== right.order) return left.order - right.order;
        return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
    });
}

function loadProjectResourceById(resourceId, owner){
    return openProjectResourcesDatabase().then(database => new Promise((resolve, reject) => {
        let transaction;
        let resource = null;
        try{
            transaction = database.transaction(PROJECT_RESOURCE_STORE, "readonly");
            const request = transaction.objectStore(PROJECT_RESOURCE_STORE).get(resourceId);
            request.onsuccess = () => {
                const result = request.result;
                if(result && !result.recycleBinEntryId && result.subjectId === owner.subjectId && result.ownerType === owner.ownerType && result.ownerId === owner.ownerId){
                    resource = result;
                }
            };
            request.onerror = () => reject(request.error || new Error("The saved resource could not be opened."));
            transaction.oncomplete = () => resource ? resolve(resource) : reject(new Error("This saved resource is no longer available in this topic."));
            transaction.onerror = () => reject(transaction.error || new Error("The saved resource could not be opened."));
            transaction.onabort = () => reject(transaction.error || new Error("The saved resource could not be opened."));
        }catch(error){ reject(error); }
    }));
}

function loadProjectResources(subjectId, ownerType, ownerId){
    return openProjectResourcesDatabase().then(database => new Promise((resolve, reject) => {
        let transaction;
        let resources = null;
        try{
            transaction = database.transaction(PROJECT_RESOURCE_STORE, "readonly");
            const request = transaction.objectStore(PROJECT_RESOURCE_STORE).index("byOwner").getAll([subjectId, ownerType, ownerId]);
            request.onsuccess = () => {
                resources = sortProjectResourceRecords(request.result.filter(resource => !resource.recycleBinEntryId));
            };
            transaction.oncomplete = () => resolve((resources || []).filter(resource => !resource.recycleBinEntryId));
            request.onerror = () => reject(request.error || new Error("Saved resources could not be read."));
            transaction.onerror = () => reject(transaction.error || new Error("Saved resources could not be read."));
            transaction.onabort = () => reject(transaction.error || new Error("Saved resources could not be read."));
        }catch(error){ reject(error); }
    }));
}

function loadAllProjectResources(){
    return openProjectResourcesDatabase().then(database => new Promise((resolve, reject) => {
        let transaction;
        let resources = null;
        try{
            transaction = database.transaction(PROJECT_RESOURCE_STORE, "readonly");
            const request = transaction.objectStore(PROJECT_RESOURCE_STORE).getAll();
            request.onsuccess = () => { resources = (request.result || []).filter(resource => !resource.recycleBinEntryId); };
            request.onerror = () => reject(request.error || new Error("Saved files could not be searched."));
            transaction.oncomplete = () => resolve(resources || []);
            transaction.onerror = () => reject(transaction.error || new Error("Saved files could not be searched."));
            transaction.onabort = () => reject(transaction.error || new Error("Saved files could not be searched."));
        }catch(error){ reject(error); }
    }));
}

function saveProjectResource(resource){
    return openProjectResourcesDatabase().then(database => new Promise((resolve, reject) => {
        let transaction;
        let saveError = null;
        try{
            transaction = database.transaction(PROJECT_RESOURCE_STORE, "readwrite");
            const store = transaction.objectStore(PROJECT_RESOURCE_STORE);
            const existingRequest = store.index("byOwner").getAll([resource.subjectId, resource.ownerType, resource.ownerId]);
            existingRequest.onsuccess = () => {
                const existingResources = sortProjectResourceRecords(existingRequest.result.filter(item => !item.recycleBinEntryId));
                const duplicate = existingResources.some(item =>
                    item.displayName.trim().toLocaleLowerCase() === resource.displayName.trim().toLocaleLowerCase()
                );
                if(duplicate){
                    saveError = new Error("A resource with this name already exists here. Choose a different name.");
                    return;
                }
                const hasCompleteOrder = existingResources.every(item => Number.isFinite(item.order));
                resource.order = hasCompleteOrder && existingResources.length
                    ? Math.max(...existingResources.map(item => item.order)) + 1
                    : existingResources.length;
                try{
                    store.add(resource);
                }catch(error){ saveError = error; transaction.abort(); }
            };
            existingRequest.onerror = () => { saveError = existingRequest.error || new Error("The resource could not be saved."); };
            transaction.oncomplete = () => saveError ? reject(saveError) : resolve(resource);
            transaction.onerror = () => reject(saveError || transaction.error || new Error("The resource could not be saved."));
            transaction.onabort = () => reject(saveError || transaction.error || new Error("The resource could not be saved."));
        }catch(error){ reject(error); }
    }));
}

function renameProjectResource(resourceId, owner, displayName){
    return openProjectResourcesDatabase().then(database => new Promise((resolve, reject) => {
        let transaction;
        let saveError = null;
        try{
            transaction = database.transaction(PROJECT_RESOURCE_STORE, "readwrite");
            const store = transaction.objectStore(PROJECT_RESOURCE_STORE);
            const request = store.index("byOwner").getAll([owner.subjectId, owner.ownerType, owner.ownerId]);
            request.onsuccess = () => {
                const resources = request.result.filter(item => !item.recycleBinEntryId);
                const resource = resources.find(item => item.id === resourceId);
                if(!resource){ saveError = new Error("This resource is no longer available in this topic."); return; }
                const duplicate = resources.some(item => item.id !== resourceId && item.displayName.trim().toLocaleLowerCase() === displayName.trim().toLocaleLowerCase());
                if(duplicate){ saveError = new Error("A resource with this name already exists here. Choose a different name."); return; }
                resource.displayName = displayName.trim();
                try{ store.put(resource); }catch(error){ saveError = error; transaction.abort(); }
            };
            request.onerror = () => { saveError = request.error || new Error("The resource name could not be saved."); };
            transaction.oncomplete = () => saveError ? reject(saveError) : resolve(true);
            transaction.onerror = () => reject(saveError || transaction.error || new Error("The resource name could not be saved."));
            transaction.onabort = () => reject(saveError || transaction.error || new Error("The resource name could not be saved."));
        }catch(error){ reject(error); }
    }));
}

function moveProjectResource(resourceId, owner, direction){
    return openProjectResourcesDatabase().then(database => new Promise((resolve, reject) => {
        let transaction;
        let saveError = null;
        let didMove = false;
        try{
            transaction = database.transaction(PROJECT_RESOURCE_STORE, "readwrite");
            const store = transaction.objectStore(PROJECT_RESOURCE_STORE);
            const request = store.index("byOwner").getAll([owner.subjectId, owner.ownerType, owner.ownerId]);
            request.onsuccess = () => {
                const resources = sortProjectResourceRecords(request.result.filter(item => !item.recycleBinEntryId));
                const currentIndex = resources.findIndex(resource => resource.id === resourceId);
                const nextIndex = currentIndex + direction;
                if(currentIndex < 0){ saveError = new Error("This resource is no longer available in this topic."); return; }
                if(nextIndex < 0 || nextIndex >= resources.length) return;
                [resources[currentIndex], resources[nextIndex]] = [resources[nextIndex], resources[currentIndex]];
                for(let index = 0; index < resources.length; index++){
                    const resource = resources[index];
                    resource.order = index;
                    try{ store.put(resource); }catch(error){ saveError = error; transaction.abort(); return; }
                }
                didMove = true;
            };
            request.onerror = () => { saveError = request.error || new Error("Resource order could not be saved."); };
            transaction.oncomplete = () => saveError ? reject(saveError) : resolve(didMove);
            transaction.onerror = () => reject(saveError || transaction.error || new Error("Resource order could not be saved."));
            transaction.onabort = () => reject(saveError || transaction.error || new Error("Resource order could not be saved."));
        }catch(error){ reject(error); }
    }));
}

function deleteProjectResource(resourceId, owner){
    return openProjectResourcesDatabase().then(database => new Promise((resolve, reject) => {
        let transaction;
        let saveError = null;
        let didDelete = false;
        try{
            transaction = database.transaction(PROJECT_RESOURCE_STORE, "readwrite");
            const store = transaction.objectStore(PROJECT_RESOURCE_STORE);
            const request = store.index("byOwner").getAll([owner.subjectId, owner.ownerType, owner.ownerId]);
            request.onsuccess = () => {
                const resources = sortProjectResourceRecords(request.result.filter(item => !item.recycleBinEntryId));
                const targetIndex = resources.findIndex(resource => resource.id === resourceId);
                if(targetIndex < 0){ saveError = new Error("This resource is no longer available in this topic."); return; }
                try{ store.delete(resourceId); }catch(error){ saveError = error; transaction.abort(); return; }
                resources.splice(targetIndex, 1);
                for(let index = 0; index < resources.length; index++){
                    const resource = resources[index];
                    resource.order = index;
                    try{ store.put(resource); }catch(error){ saveError = error; transaction.abort(); return; }
                }
                didDelete = true;
            };
            request.onerror = () => { saveError = request.error || new Error("The resource could not be deleted."); };
            transaction.oncomplete = () => saveError ? reject(saveError) : resolve(didDelete);
            transaction.onerror = () => reject(saveError || transaction.error || new Error("The resource could not be deleted."));
            transaction.onabort = () => reject(saveError || transaction.error || new Error("The resource could not be deleted."));
        }catch(error){ reject(error); }
    }));
}

function updateRecycleResourceMarker(resourceId, expectedEntryId, restore = false){
    return openProjectResourcesDatabase().then(database => new Promise((resolve, reject) => {
        let transaction;
        let saveError = null;
        try{
            transaction = database.transaction(PROJECT_RESOURCE_STORE, "readwrite");
            const store = transaction.objectStore(PROJECT_RESOURCE_STORE);
            const request = store.get(resourceId);
            request.onsuccess = () => {
                const resource = request.result;
                if(!resource || (!restore && resource.recycleBinEntryId) || (restore && resource.recycleBinEntryId !== expectedEntryId)){
                    saveError = new Error("The saved resource changed before the operation completed.");
                    return;
                }
                if(restore){
                    const activeRequest = store.index("byOwner").getAll([resource.subjectId, resource.ownerType, resource.ownerId]);
                    activeRequest.onsuccess = () => {
                        try{
                            const activeResources = sortProjectResourceRecords((activeRequest.result || []).filter(item => item.id !== resource.id && !item.recycleBinEntryId));
                            const requestedOrder = Number.isFinite(resource.order) ? Math.max(0, Math.min(resource.order, activeResources.length)) : activeResources.length;
                            activeResources.forEach((item, index) => {
                                const nextOrder = index >= requestedOrder ? index + 1 : index;
                                if(item.order !== nextOrder) store.put({ ...item, order: nextOrder });
                            });
                            const { recycleBinEntryId, ...activeResource } = resource;
                            activeResource.order = requestedOrder;
                            store.put(activeResource);
                        }catch(error){ saveError = error; transaction.abort(); }
                    };
                    activeRequest.onerror = () => { saveError = activeRequest.error || new Error("The resource order could not be restored."); transaction.abort(); };
                }else{
                    const activeRequest = store.index("byOwner").getAll([resource.subjectId, resource.ownerType, resource.ownerId]);
                    activeRequest.onsuccess = () => {
                        try{
                            const activeResources = sortProjectResourceRecords((activeRequest.result || []).filter(item => item.id !== resource.id && !item.recycleBinEntryId));
                            activeResources.forEach((item, index) => {
                                if(item.order !== index) store.put({ ...item, order: index });
                            });
                            store.put({ ...resource, recycleBinEntryId: expectedEntryId });
                        }catch(error){ saveError = error; transaction.abort(); }
                    };
                    activeRequest.onerror = () => { saveError = activeRequest.error || new Error("The resource order could not be saved."); transaction.abort(); };
                }
            };
            request.onerror = () => { saveError = request.error || new Error("The saved resource could not be updated."); };
            transaction.oncomplete = () => saveError ? reject(saveError) : resolve(true);
            transaction.onerror = () => reject(saveError || transaction.error || new Error("The saved resource could not be updated."));
            transaction.onabort = () => reject(saveError || transaction.error || new Error("The saved resource could not be updated."));
        }catch(error){ reject(error); }
    }));
}

async function moveProjectResourceToRecycleBin(resourceId, owner){
    const resource = await loadProjectResourceById(resourceId, owner);
    const { file, ...metadata } = resource;
    const entry = makeRecycleBinEntry("resource", resource.displayName || resource.originalFilename, {
        subjectId: resource.subjectId,
        subjectName: projectSubjectRecords.find(item => getProjectSubjectId(item, false) === resource.subjectId)?.name || "Project",
        ownerType: resource.ownerType,
        ownerId: resource.ownerId,
        topicName: resource.ownerType === "topic" ? projectTopicRecords.find(item => item.id === resource.ownerId)?.name || "Topic" : ""
    }, { resource: metadata });
    if(!persistRecycleBinAndStorage([...recycleBinEntries, entry])) throw new Error("The resource could not be saved to Recycle Bin.");
    try{
        await updateRecycleResourceMarker(resourceId, entry.id, false);
        return entry;
    }catch(error){
        const rollback = recycleBinEntries.filter(item => item.id !== entry.id);
        if(!persistRecycleBinAndStorage(rollback)) showToast("The resource remains available, but its Recycle Bin entry needs attention.", "error");
        throw error;
    }
}

let projectTopicRecords = readProjectStorage("ironMindProjectTopics", []);
if(!Array.isArray(projectTopicRecords)) projectTopicRecords = [];
    projectTopicRecords = projectTopicRecords.filter(topic =>
        topic && typeof topic.id === "string" && typeof topic.subjectId === "string" && typeof topic.name === "string"
).map(topic => ({
    id: topic.id,
    subjectId: topic.subjectId,
    parentId: typeof topic.parentId === "string" ? topic.parentId : null,
    name: topic.name,
    order: Number.isFinite(Number(topic.order)) ? Number(topic.order) : 0
}));

let projectSubjectIds = readProjectStorage("ironMindProjectSubjectIds", {});
if(!projectSubjectIds || typeof projectSubjectIds !== "object" || Array.isArray(projectSubjectIds)) projectSubjectIds = {};

const PROJECT_SUBJECTS_KEY = "ironMindProjectSubjects";
const PROJECT_NOTES_KEY = "ironMindProjectNotes";
const PROJECT_RESOURCES_DB_NAME = window.IRON_MIND_WORKSPACE.resourceDatabaseName;
const PROJECT_RESOURCES_DB_VERSION = 1;
const PROJECT_RESOURCE_STORE = "resources";
const PROJECT_RESOURCE_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "png", "jpg", "jpeg"]);
const PROJECT_NOTE_IMAGE_MAX_BYTES = 512 * 1024;
const PROJECT_NOTE_STORAGE_SAFE_BYTES = 4 * 1024 * 1024;
let projectSubjectStorageReady = true;
let projectSubjectRecords = [];
let projectNoteStorageReady = true;
let projectNoteRecords = [];
let projectEquationDialogState = null;
let projectNoteImageEditorCleanup = null;
let projectResourcesDbPromise = null;

function cleanupProjectNoteImageEditor(){
    if(!projectNoteImageEditorCleanup) return;
    projectNoteImageEditorCleanup();
    projectNoteImageEditorCleanup = null;
}

let projectExpandedBySubject = readProjectStorage("ironMindProjectExpandedTopics", {});
if(!projectExpandedBySubject || typeof projectExpandedBySubject !== "object" || Array.isArray(projectExpandedBySubject)) projectExpandedBySubject = {};
let projectSearchSession = null;

const projectState = {
    subjectId: null,
    selectedTopicId: null,
    activeNoteId: null,
    isEditingNote: false,
    expandedIds: new Set(),
    dialogTrigger: null,
    dialogFallbackSelector: null
};

const projectHomeView = document.getElementById("projectHomeView");
const projectPage = document.getElementById("projectPage");
const projectAppShell = projectPage.closest(".app-shell");
const projectPageHeader = document.getElementById("projectPageHeader");
const projectSubjectGrid = document.getElementById("projectSubjectGrid");
const projectEmptyState = document.getElementById("projectEmptyState");
const projectSubjectWorkspace = document.getElementById("projectSubjectWorkspace");
const projectWorkspaceSubjectTitle = document.getElementById("projectWorkspaceSubjectTitle");
const projectTopicTree = document.getElementById("projectTopicTree");
const projectTopicMain = document.getElementById("projectTopicMain");
const projectTopicWelcome = document.getElementById("projectTopicWelcome");
const projectTopicDetail = document.getElementById("projectTopicDetail");
const projectNoteView = document.getElementById("projectNoteView");
const projectTopicSidebar = document.getElementById("projectTopicSidebar");
const projectTreeScrim = document.getElementById("projectTreeScrim");
const projectOpenTreeButton = document.getElementById("projectOpenTreeButton");
const projectDialog = document.getElementById("projectDialog");
const projectDialogPanel = projectDialog.querySelector(".project-dialog-panel");
const projectDialogContent = document.getElementById("projectDialogContent");

function saveProjectTopics(){
    workspaceStorage.setItem("ironMindProjectTopics", JSON.stringify(projectTopicRecords));
}

function saveProjectStorageBatch(entries){
    let snapshots;
    try{
        snapshots = entries.map(([key]) => [key, workspaceStorage.getItem(key)]);
        entries.forEach(([key, value]) => workspaceStorage.setItem(key, JSON.stringify(value)));
        return true;
    }catch(error){
        if(snapshots){
            snapshots.forEach(([key, value]) => {
                try{
                    if(value === null) workspaceStorage.removeItem(key);
                    else workspaceStorage.setItem(key, value);
                }catch(restoreError){ /* Keep the original in-memory records if storage is unavailable. */ }
            });
        }
        return false;
    }
}

function saveProjectSubjectIds(){
    workspaceStorage.setItem("ironMindProjectSubjectIds", JSON.stringify(projectSubjectIds));
}

function saveProjectSubjects(records = projectSubjectRecords){
    if(!projectSubjectStorageReady) return false;
    try{
        workspaceStorage.setItem(PROJECT_SUBJECTS_KEY, JSON.stringify(records));
        return true;
    }catch(error){
        projectSubjectStorageReady = false;
        return false;
    }
}

function saveProjectExpandedState(){
    if(!projectState.subjectId) return;
    projectExpandedBySubject[projectState.subjectId] = [...projectState.expandedIds];
    workspaceStorage.setItem("ironMindProjectExpandedTopics", JSON.stringify(projectExpandedBySubject));
}

function projectSubjects(){
    return projectSubjectRecords;
}

function getLegacyProjectSubjectId(subjectName){
    const matchingKey = Object.keys(projectSubjectIds).find(key => key.toLowerCase() === String(subjectName).toLowerCase());
    return matchingKey && typeof projectSubjectIds[matchingKey] === "string" ? projectSubjectIds[matchingKey] : null;
}

function getProjectSubjectId(subject, createIfMissing = true){
    if(!subject || typeof subject.name !== "string") return null;
    if(typeof subject.id === "string" && subject.id) return subject.id;

    const legacyId = getLegacyProjectSubjectId(subject.name);
    if(legacyId){
        if(createIfMissing){
            subject.id = legacyId;
            saveProjectSubjects();
        }
        return legacyId;
    }
    if(!createIfMissing) return null;
    const id = createProjectId();
    subject.id = id;
    saveProjectSubjects();
    return id;
}

function loadProjectSubjects(){
    let storedValue;
    try{
        storedValue = workspaceStorage.getItem(PROJECT_SUBJECTS_KEY);
    }catch(error){
        projectSubjectStorageReady = false;
        return [];
    }

    if(storedValue !== null){
        let storedRecords;
        try{
            storedRecords = JSON.parse(storedValue);
        }catch(error){
            projectSubjectStorageReady = false;
            return [];
        }
        if(!Array.isArray(storedRecords) || storedRecords.some(subject => !subject || typeof subject.name !== "string")){
            projectSubjectStorageReady = false;
            return [];
        }
        const normalizedRecords = storedRecords.map(subject => {
            if(typeof subject.id === "string" && subject.id) return subject;
            const legacyId = getLegacyProjectSubjectId(subject.name);
            return { ...subject, id: legacyId || createProjectId() };
        });
        if(normalizedRecords.some((subject, index) => subject !== storedRecords[index])){
            try{
                workspaceStorage.setItem(PROJECT_SUBJECTS_KEY, JSON.stringify(normalizedRecords));
            }catch(error){
                projectSubjectStorageReady = false;
            }
        }
        return normalizedRecords;
    }

    // Before separation, Project topics were linked to the shared Home subject
    // list through this ID map. Only migrate subjects that existing topics
    // identify unambiguously; leave all other legacy records untouched in Home.
    const topicSubjectIds = new Set(projectTopicRecords.map(topic => topic.subjectId));
    const migratedRecords = [];
    const migratedIds = new Set();
    if(Array.isArray(subjects)){
        subjects.forEach(subject => {
            if(!subject || typeof subject.name !== "string") return;
            const id = getLegacyProjectSubjectId(subject.name);
            if(id && topicSubjectIds.has(id) && !migratedIds.has(id)){
                migratedRecords.push({ ...subject, id });
                migratedIds.add(id);
            }
        });
    }
    Object.entries(projectSubjectIds).forEach(([name, id]) => {
        if(typeof id === "string" && topicSubjectIds.has(id) && !migratedIds.has(id)){
            migratedRecords.push({ id, name, priority: "high" });
            migratedIds.add(id);
        }
    });
    if(!saveProjectSubjects(migratedRecords)) projectSubjectStorageReady = false;
    return migratedRecords;
}

function deleteProjectSubject(subjectId){
    const subject = projectSubjectRecords.find(item => getProjectSubjectId(item, false) === subjectId);
    if(!subject || !projectSubjectStorageReady || !projectNoteStorageReady) return false;

    const nextSubjects = projectSubjectRecords.filter(item => item !== subject);
    const removedTopics = projectTopicRecords.filter(topic => topic.subjectId === subjectId);
    const removedNotes = projectNoteRecords.filter(note => note.subjectId === subjectId);
    const nextTopics = projectTopicRecords.filter(topic => topic.subjectId !== subjectId);
    const nextNotes = projectNoteRecords.filter(note => note.subjectId !== subjectId);
    const nextExpanded = { ...projectExpandedBySubject };
    delete nextExpanded[subjectId];
    const nextSubjectIds = { ...projectSubjectIds };
    Object.keys(nextSubjectIds).forEach(key => {
        if(nextSubjectIds[key] === subjectId) delete nextSubjectIds[key];
    });
    const entry = makeRecycleBinEntry("projectSubject", subject.name, { type: "Project subject" }, {
        subject: { ...subject },
        topics: removedTopics.map(topic => ({ ...topic })),
        notes: removedNotes.map(note => ({ ...note })),
        hadExpandedState: Object.prototype.hasOwnProperty.call(projectExpandedBySubject, subjectId),
        expandedState: projectExpandedBySubject[subjectId] || [],
        subjectIdMappings: Object.entries(projectSubjectIds).filter(([, id]) => id === subjectId)
    });
    const keysToUpdate = [
        ["ironMindProjectSubjects", nextSubjects],
        ["ironMindProjectTopics", nextTopics],
        [PROJECT_NOTES_KEY, nextNotes],
        ["ironMindProjectExpandedTopics", nextExpanded],
        ["ironMindProjectSubjectIds", nextSubjectIds]
    ];
    if(!persistRecycleBinAndStorage([...recycleBinEntries, entry], keysToUpdate)) return false;

    projectSubjectRecords = nextSubjects;
    projectTopicRecords = nextTopics;
    projectNoteRecords = nextNotes;
    projectExpandedBySubject = nextExpanded;
    projectSubjectIds = nextSubjectIds;
    if(projectState.subjectId === subjectId){
        projectState.subjectId = null;
        projectState.selectedTopicId = null;
        projectState.activeNoteId = null;
        projectState.isEditingNote = false;
        projectState.expandedIds.clear();
        projectSubjectWorkspace.classList.remove("is-reading");
        projectSubjectWorkspace.classList.add("hidden");
        projectHomeView.classList.remove("hidden");
        closeProjectTreeDrawer();
    }
    return true;
}

projectSubjectRecords = loadProjectSubjects();

function escapeProjectHtml(value){
    return String(value).replace(/[&<>"']/g, character => ({
        "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;"
    }[character]));
}

function saveProjectNotes(records = projectNoteRecords){
    if(!projectNoteStorageReady) return false;
    try{
        workspaceStorage.setItem(PROJECT_NOTES_KEY, JSON.stringify(records));
        return true;
    }catch(error){
        projectNoteStorageReady = false;
        return false;
    }
}

function loadProjectNotes(){
    let storedValue;
    try{
        storedValue = workspaceStorage.getItem(PROJECT_NOTES_KEY);
    }catch(error){
        projectNoteStorageReady = false;
        return [];
    }
    if(storedValue === null) return [];

    let storedRecords;
    try{
        storedRecords = JSON.parse(storedValue);
    }catch(error){
        projectNoteStorageReady = false;
        return [];
    }
    if(!Array.isArray(storedRecords)){
        projectNoteStorageReady = false;
        return [];
    }

    const seenIds = new Set();
    let recordsNeedNormalization = false;
    const normalizedRecords = [];
    storedRecords.forEach(note => {
        const hasValidOwnership = note &&
            typeof note.id === "string" && note.id &&
            typeof note.ownerId === "string" && note.ownerId &&
            typeof note.subjectId === "string" && note.subjectId &&
            (note.ownerType === "subject" || note.ownerType === "topic") &&
            (note.ownerType !== "subject" || note.ownerId === note.subjectId);
        if(!hasValidOwnership || seenIds.has(note.id)){
            projectNoteStorageReady = false;
            return;
        }
        seenIds.add(note.id);

        const subjectExists = projectSubjects().some(subject => getProjectSubjectId(subject, false) === note.subjectId);
        const topicExists = note.ownerType !== "topic" || projectTopicRecords.some(topic => topic.id === note.ownerId && topic.subjectId === note.subjectId);
        if(!subjectExists || !topicExists) projectNoteStorageReady = false;

        const normalizedNote = {
            ...note,
            title: typeof note.title === "string" && note.title.trim() ? note.title : "Untitled Note",
            content: typeof note.content === "string" ? note.content : "",
            createdAt: typeof note.createdAt === "string" ? note.createdAt : new Date().toISOString(),
            updatedAt: typeof note.updatedAt === "string" ? note.updatedAt : (typeof note.createdAt === "string" ? note.createdAt : new Date().toISOString())
        };
        if(JSON.stringify(normalizedNote) !== JSON.stringify(note)) recordsNeedNormalization = true;
        normalizedRecords.push(normalizedNote);
    });

    if(recordsNeedNormalization && projectNoteStorageReady){
        try{
            workspaceStorage.setItem(PROJECT_NOTES_KEY, JSON.stringify(normalizedRecords));
        }catch(error){
            projectNoteStorageReady = false;
        }
    }
    return normalizedRecords;
}

function projectNotesForSubject(subjectId){
    return projectNoteRecords
        .filter(note => note.ownerType === "subject" && note.ownerId === subjectId && note.subjectId === subjectId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function projectNotesForTopic(topicId, subjectId = projectState.subjectId){
    return projectNoteRecords
        .filter(note => note.ownerType === "topic" && note.ownerId === topicId && note.subjectId === subjectId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function projectTopicHasNestedItems(topicId){
    return projectTopicChildren(topicId).length > 0;
}

projectNoteRecords = loadProjectNotes();

function projectTopicsForSubject(subjectId){
    return projectTopicRecords.filter(topic => topic.subjectId === subjectId);
}

function projectTopicChildren(parentId, subjectId = projectState.subjectId){
    return projectTopicRecords
        .filter(topic => topic.subjectId === subjectId && topic.parentId === parentId)
        .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
}

function projectTopicById(topicId){
    return projectTopicRecords.find(topic => topic.id === topicId && topic.subjectId === projectState.subjectId) || null;
}

function projectTopicPath(topicId){
    const path = [];
    let topic = projectTopicById(topicId);
    const seen = new Set();
    while(topic && !seen.has(topic.id)){
        seen.add(topic.id);
        path.unshift(topic);
        topic = topic.parentId ? projectTopicById(topic.parentId) : null;
    }
    return path;
}

function projectDescendantIds(topicId){
    const descendants = new Set();
    const visit = parentId => projectTopicChildren(parentId).forEach(child => {
        if(descendants.has(child.id)) return;
        descendants.add(child.id);
        visit(child.id);
    });
    visit(topicId);
    return descendants;
}

function projectTopicMoveError(topicId, parentId){
    const topic = projectTopicById(topicId);
    if(!topic) return "That topic is no longer available.";
    if(!parentId) return null;
    if(!projectTopicById(parentId)) return "That parent topic is no longer available. Choose another parent.";
    if(parentId === topicId || projectDescendantIds(topicId).has(parentId)){
        return "A topic cannot be moved inside itself or one of its descendants.";
    }
    return null;
}

function normalizeProjectSiblingOrder(parentId, subjectId = projectState.subjectId){
    projectTopicChildren(parentId, subjectId).forEach((topic, index) => { topic.order = index; });
}

function projectSearchSubjectMap(){
    return new Map(projectSubjects().map(subject => [getProjectSubjectId(subject, false), subject]).filter(([id]) => id));
}

function projectSearchTopicPath(topicId, subjectId){
    const path = [];
    const seen = new Set();
    let topic = projectTopicRecords.find(item => item.id === topicId && item.subjectId === subjectId) || null;
    while(topic && !seen.has(topic.id)){
        seen.add(topic.id);
        path.unshift(topic);
        topic = topic.parentId
            ? projectTopicRecords.find(item => item.id === topic.parentId && item.subjectId === subjectId) || null
            : null;
    }
    return path;
}

function projectSearchLocation(subjectName, topicPath, suffix = ""){
    return ["Projects", subjectName, ...topicPath.map(topic => topic.name), suffix].filter(Boolean).join(" > ");
}

function buildProjectSearchEntries(resources = []){
    const subjects = projectSearchSubjectMap();
    const entries = [];
    projectTopicRecords.forEach(topic => {
        const subject = subjects.get(topic.subjectId);
        if(!subject) return;
        const path = projectSearchTopicPath(topic.id, topic.subjectId);
        if(!path.length) return;
        entries.push({
            type: "topic",
            title: topic.name,
            location: projectSearchLocation(subject.name, path.slice(0, -1)),
            level: path.length - 1,
            subjectId: topic.subjectId,
            topicId: topic.id
        });
    });
    projectNoteRecords.forEach(note => {
        const subject = subjects.get(note.subjectId);
        if(!subject) return;
        let topicPath = [];
        if(note.ownerType === "topic"){
            topicPath = projectSearchTopicPath(note.ownerId, note.subjectId);
            if(!topicPath.length) return;
        }else if(note.ownerType !== "subject" || note.ownerId !== note.subjectId){
            return;
        }
        entries.push({
            type: "note",
            title: note.title,
            location: projectSearchLocation(subject.name, topicPath, "Notes"),
            subjectId: note.subjectId,
            noteId: note.id
        });
    });
    resources.forEach(resource => {
        const subject = subjects.get(resource.subjectId);
        if(!subject) return;
        let topicPath = [];
        if(resource.ownerType === "topic"){
            topicPath = projectSearchTopicPath(resource.ownerId, resource.subjectId);
            if(!topicPath.length) return;
        }else if(resource.ownerType !== "subject" || resource.ownerId !== resource.subjectId){
            return;
        }
        entries.push({
            type: "file",
            title: resource.displayName || resource.originalFilename || "Untitled resource",
            secondary: resource.originalFilename && resource.originalFilename !== resource.displayName ? resource.originalFilename : "",
            originalFilename: resource.originalFilename || "",
            location: projectSearchLocation(subject.name, topicPath, "Resources"),
            subjectId: resource.subjectId,
            ownerType: resource.ownerType,
            ownerId: resource.ownerId,
            resourceId: resource.id
        });
    });
    return entries;
}

function projectResourceIconType(filename){
    const safeFilename = typeof filename === "string" ? filename : "";
    const extension = safeFilename.match(/\.([^.]+)$/)?.[1]?.toLowerCase() || "";
    if(extension === "pdf") return "pdf";
    if(extension === "xls" || extension === "xlsx") return "excel";
    if(extension === "doc" || extension === "docx") return "word";
    if(extension === "ppt" || extension === "pptx") return "powerpoint";
    if(extension === "png" || extension === "jpg" || extension === "jpeg") return "image";
    return "unknown";
}

function projectItemIcon(kind, options = {}){
    if(kind === "topic"){
        if(options.level > 0){
            return `<svg class="project-item-icon project-item-icon--subtopic" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M4 10V7.8c0-1 .8-1.8 1.8-1.8h7l2.2 2.4h11.2c1 0 1.8.8 1.8 1.8v13H4z" fill="#14282F" stroke="#56B8B2" stroke-width="1.35" stroke-linejoin="round"/><path d="M3.7 13h24.6l-2.4 11.4c-.2 1-1 1.7-2.1 1.7H5.7c-1.2 0-2-.9-1.8-2z" fill="#193139" stroke="#63D1C8" stroke-width="1.35" stroke-linejoin="round"/><path d="M6 14.3h20.7M7.2 17.2h16" fill="none" stroke="#8ADCD5" stroke-width="1.05" stroke-linecap="round" opacity=".62"/><path d="M6 25.1h17.8" fill="none" stroke="#0E2229" stroke-width="1.1" stroke-linecap="round" opacity=".75"/></svg>`;
        }
        return `<svg class="project-item-icon project-item-icon--topic" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M3.2 9c0-1.1.9-2 2-2h7.1l2.5 2.6h12c1.1 0 2 .9 2 2v12.8c0 1.1-.9 2-2 2H5.2c-1.1 0-2-.9-2-2z" fill="#152A32" stroke="#63D1C8" stroke-width="1.5" stroke-linejoin="round"/><path d="M3.6 13h24.8l-2.5 11c-.2 1-1 1.6-2 1.6H5.8c-1.2 0-2-.9-1.8-2.1z" fill="#1B343C" stroke="#59C2BC" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 14.3h20.8M7 17h18" fill="none" stroke="#9AE2DB" stroke-width="1.1" stroke-linecap="round" opacity=".66"/><path d="M6 25h18.2" fill="none" stroke="#10252C" stroke-width="1.2" stroke-linecap="round" opacity=".8"/></svg>`;
    }
    if(kind === "note"){
        return `<svg class="project-item-icon project-item-icon--note" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M8 3.5h16.1c1.1 0 1.9.9 1.9 2v21c0 1.1-.8 2-1.9 2H8c-1.1 0-2-.9-2-2v-21c0-1.1.9-2 2-2z" fill="#171A2B" stroke="#9F91D9" stroke-width="1.4" stroke-linejoin="round"/><path d="M10.1 4.2h12.8v23.6H10.1z" fill="#1B1D31" stroke="#B6A4FF" stroke-width="1.1" stroke-linejoin="round"/><path d="M9.8 4.4v23.2" stroke="#74699D" stroke-width="2" stroke-linecap="round"/><path d="M13.4 11h6.8M13.4 14.7h7.6M13.4 18.4h6.2M13.4 22.1h7" fill="none" stroke="#B6A4FF" stroke-width="1.15" stroke-linecap="round" opacity=".79"/><path d="M12.2 7.3h8.2" stroke="#DDD4FF" stroke-width=".9" stroke-linecap="round" opacity=".48"/></svg>`;
    }
    if(kind === "file"){
        const iconType = projectResourceIconType(options.filename);
        if(iconType === "pdf") return `<svg class="project-item-icon project-item-icon--pdf" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M7 2.8h12l6 6v20.4H7z" fill="#F8ECEE" stroke="#F06A79" stroke-width="1.5" stroke-linejoin="round"/><path d="M19 3v6h5.7" fill="#F3C5CA" stroke="#F06A79" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 13h11M10 16h8" stroke="#C9A5A9" stroke-width="1.2" stroke-linecap="round"/><rect x="9" y="19" width="14" height="6" rx="1.5" fill="#C83F50"/><text x="16" y="23.4" fill="#FFF7F7" font-size="4.7" font-weight="800" text-anchor="middle" font-family="Arial,sans-serif">PDF</text></svg>`;
        if(iconType === "excel") return `<svg class="project-item-icon project-item-icon--excel" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect x="8.5" y="4" width="20" height="24" rx="2.5" fill="#102F28" stroke="#4CC58B" stroke-width="1.5"/><path d="M11 9h15M11 14h15M11 19h15M11 24h15M16 9v15M21 9v15" stroke="#65D49D" stroke-width="1" opacity=".8"/><path d="M3 9.5 14 7v18l-11-2.5z" fill="#138A5A" stroke="#55D49A" stroke-width="1.4" stroke-linejoin="round"/><path d="m6.7 12.2 3.6 7.6m-.1-7.6-3.5 7.6" stroke="#F0FFF7" stroke-width="1.7" stroke-linecap="round"/></svg>`;
        if(iconType === "word") return `<svg class="project-item-icon project-item-icon--word" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M9 3h12l5 5v20.8H9z" fill="#EAF1FF" stroke="#6F9EFF" stroke-width="1.5" stroke-linejoin="round"/><path d="M21 3.2v5h4.8" fill="#C8D8FF" stroke="#6F9EFF" stroke-width="1.3" stroke-linejoin="round"/><path d="M13 12h9M13 15h9M13 18h8M13 21h6" stroke="#91A9D8" stroke-width="1.2" stroke-linecap="round"/><rect x="3" y="12" width="12" height="12" rx="2" fill="#2466D5" stroke="#78A8FF" stroke-width="1.2"/><text x="9" y="20.5" fill="#FFFFFF" font-size="7.5" font-weight="800" text-anchor="middle" font-family="Arial,sans-serif">W</text></svg>`;
        if(iconType === "powerpoint") return `<svg class="project-item-icon project-item-icon--powerpoint" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect x="3" y="4" width="26" height="19" rx="2.5" fill="#3A2118" stroke="#F29A57" stroke-width="1.6"/><rect x="6" y="7" width="20" height="13" rx="1" fill="#241A19"/><path d="M9 17v-3.5h3V17m-3-3.5V11h3v2.5m3 3.5v-5h3v5m3 0v-3h2v3" fill="none" stroke="#FFC17E" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 23v3m-5 2h10" stroke="#F29A57" stroke-width="1.8" stroke-linecap="round"/><circle cx="11.5" cy="12.3" r=".8" fill="#FFDAA6"/></svg>`;
        if(iconType === "image") return `<svg class="project-item-icon project-item-icon--image" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect x="3.5" y="5" width="25" height="22" rx="3" fill="#102F35" stroke="#4ED2D1" stroke-width="1.6"/><circle cx="21.7" cy="11" r="2.4" fill="#8CF0D2"/><path d="m5.8 23 6.7-7 4.5 4.1 3.6-3.4 5.7 6.3v1.1H5.8z" fill="#1B9D9C" stroke="#6AE3DA" stroke-width="1.2" stroke-linejoin="round"/><path d="M6 24.6h20" stroke="#A4F4E7" stroke-width="1" opacity=".8"/></svg>`;
        return `<svg class="project-item-icon project-item-icon--unknown" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M7 3h12l6 6v20H7z" fill="#252C3A" stroke="#A6B0C2" stroke-width="1.5" stroke-linejoin="round"/><path d="M19 3.2v5.6h5.6" fill="#394354" stroke="#A6B0C2" stroke-width="1.3" stroke-linejoin="round"/><path d="M11 14h10M11 18h10M11 22h7" stroke="#BBC4D2" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    }
    return "";
}

function projectSearchResultMarkup(entry, index){
    const fileTypeLabel = { pdf: "PDF", excel: "Excel", word: "Word", powerpoint: "PowerPoint", image: "Image", unknown: "File" };
    const resourceType = entry.type === "file" ? projectResourceIconType(entry.originalFilename) : "";
    const label = entry.type === "topic" ? "Topic" : entry.type === "note" ? "Note" : fileTypeLabel[resourceType] === "File" ? "File" : `${fileTypeLabel[resourceType]} file`;
    const badge = entry.type === "file" ? fileTypeLabel[resourceType] : label;
    const icon = entry.type === "topic"
        ? projectItemIcon("topic", { level: entry.level })
        : entry.type === "note"
            ? projectItemIcon("note")
            : projectItemIcon("file", { filename: entry.originalFilename });
    return `<button class="project-search-result" type="button" data-project-search-result="${index}" aria-label="${escapeProjectHtml(`${label}: ${entry.title}. ${entry.location}`)}">
        ${icon}
        <span class="project-search-result-copy"><strong>${escapeProjectHtml(entry.title)}</strong>${entry.secondary ? `<small class="project-search-result-filename">${escapeProjectHtml(entry.secondary)}</small>` : ""}<small>${escapeProjectHtml(entry.location)}</small></span>
        <span class="project-search-result-type">${badge}</span>
    </button>`;
}

function renderProjectSearchResults(session){
    if(projectSearchSession !== session) return;
    const input = projectDialogContent.querySelector("#projectSearchInput");
    const resultsNode = projectDialogContent.querySelector("[data-project-search-results]");
    const statusNode = projectDialogContent.querySelector("[data-project-search-status]");
    if(!input || !resultsNode || !statusNode) return;
    const query = input.value.trim().toLocaleLowerCase();
    const filtered = session.entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => {
        if(session.filter !== "all" && entry.type !== session.filter) return false;
        if(!query) return false;
        return `${entry.title} ${entry.secondary || ""}`.toLocaleLowerCase().includes(query);
    });
    projectDialogContent.querySelectorAll("[data-project-search-filter]").forEach(button => {
        const selected = button.dataset.projectSearchFilter === session.filter;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
    statusNode.textContent = session.error ? "Saved files could not be loaded. Topics and notes are still searchable." : session.loading && query ? "Searching saved files…" : "";
    if(!query){
        resultsNode.innerHTML = `<div class="project-search-empty"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span>Search topics, notes, and files</span></div>`;
        return;
    }
    if(!filtered.length){
        const message = session.loading && !session.error
            ? "Searching saved files…"
            : session.error && (session.filter === "all" || session.filter === "file")
                ? "Saved files could not be searched. Try again later."
                : "No results found";
        resultsNode.innerHTML = `<div class="project-search-empty"><i class="fa-solid ${message === "No results found" ? "fa-magnifying-glass" : "fa-circle-exclamation"}" aria-hidden="true"></i><span>${escapeProjectHtml(message)}</span></div>`;
        return;
    }
    resultsNode.innerHTML = filtered.map(({ entry, index }) => projectSearchResultMarkup(entry, index)).join("");
}

function openProjectSearchPopup(){
    const session = { filter: "all", entries: buildProjectSearchEntries(), loading: true, error: false };
    projectSearchSession = session;
    setProjectDialog("Search Projects", `
        <div class="project-search-panel-content">
            <label class="project-search-label" for="projectSearchInput">Search your workspace</label>
            <div class="project-search-input-wrap"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input id="projectSearchInput" class="project-search-input" type="search" autocomplete="off" placeholder="Topics, notes, and files" aria-label="Search topics, notes, and files"><button class="project-search-close" type="button" aria-label="Close Search">×</button></div>
            <div class="project-search-filters" role="group" aria-label="Filter search results">
                <button type="button" data-project-search-filter="all" aria-pressed="true">All</button>
                <button type="button" data-project-search-filter="topic" aria-pressed="false">Topics</button>
                <button type="button" data-project-search-filter="note" aria-pressed="false">Notes</button>
                <button type="button" data-project-search-filter="file" aria-pressed="false">Files</button>
            </div>
            <p class="project-search-status" data-project-search-status role="status" aria-live="polite"></p>
            <div class="project-search-results" data-project-search-results aria-live="polite"><div class="project-search-empty"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span>Search topics, notes, and files</span></div></div>
        </div>
    `, "#projectSearchInput", "search");
    const input = projectDialogContent.querySelector("#projectSearchInput");
    input.addEventListener("input", () => renderProjectSearchResults(session));
    projectDialogContent.querySelectorAll("[data-project-search-filter]").forEach(button => {
        button.addEventListener("click", () => {
            session.filter = button.dataset.projectSearchFilter;
            renderProjectSearchResults(session);
        });
    });
    projectDialogContent.querySelector(".project-search-close").addEventListener("click", closeProjectDialog);
    projectDialogContent.addEventListener("click", event => {
        const resultButton = event.target.closest("[data-project-search-result]");
        if(!resultButton) return;
        const result = session.entries[Number(resultButton.dataset.projectSearchResult)];
        if(result) navigateToProjectSearchResult(result);
    });
    loadAllProjectResources().then(resources => {
        if(projectSearchSession !== session) return;
        session.entries = buildProjectSearchEntries(resources);
        session.loading = false;
        renderProjectSearchResults(session);
    }).catch(() => {
        if(projectSearchSession !== session) return;
        session.loading = false;
        session.error = true;
        renderProjectSearchResults(session);
    });
}

function navigateToProjectSearchResult(result){
    closeProjectDialog();
    if(projectState.subjectId !== result.subjectId) openProjectSubject(result.subjectId);
    if(result.type === "topic"){
        projectState.activeNoteId = null;
        projectState.isEditingNote = false;
        selectProjectTopic(result.topicId);
        return;
    }
    if(result.type === "note"){
        openProjectNote(result.noteId);
        return;
    }
    if(result.type === "file"){
        const owner = { subjectId: result.subjectId, ownerType: result.ownerType, ownerId: result.ownerId };
        if(result.ownerType === "topic") selectProjectTopic(result.ownerId);
        openProjectResource(result.resourceId, owner);
    }
}

function setProjectDialog(title, contentHtml, focusSelector = "input", variant = null){
    projectState.dialogTrigger = document.activeElement;
    projectState.dialogFallbackSelector = null;
    projectDialog.classList.toggle("is-resource-popup", variant === "resource");
    projectDialog.classList.toggle("is-search-popup", variant === "search");
    projectDialog.classList.toggle("is-note-title-popup", variant === "note-title");
    document.getElementById("projectDialogClose").disabled = variant === "search";
    projectDialogPanel.setAttribute("aria-modal", "true");
    if(projectState.dialogTrigger?.dataset?.topicMenuToggle){
        projectState.dialogFallbackSelector = `[data-topic-select="${projectState.dialogTrigger.dataset.topicMenuToggle}"]`;
    }else if(projectState.dialogTrigger?.dataset?.noteMenuToggle){
        projectState.dialogFallbackSelector = `[data-project-note-open="${projectState.dialogTrigger.dataset.noteMenuToggle}"]`;
    }else if(projectState.dialogTrigger?.dataset?.subjectMenuToggle){
        projectState.dialogFallbackSelector = `[data-project-open-subject="${projectState.dialogTrigger.dataset.subjectMenuToggle}"]`;
    }else if(projectState.dialogTrigger?.dataset?.resourceAction){
        projectState.dialogFallbackSelector = `[data-resource-menu-toggle="${projectState.dialogTrigger.dataset.resourceId}"]`;
    }else if(projectState.dialogTrigger?.dataset?.projectAddSubject !== undefined){
        projectState.dialogFallbackSelector = "[data-project-add-subject]";
    }
    projectDialogContent.innerHTML = `<h2 id="projectDialogTitle">${escapeProjectHtml(title)}</h2>${contentHtml}`;
    projectDialog.classList.remove("hidden");
    projectDialog.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
        const focusTarget = projectDialogContent.querySelector(focusSelector) || projectDialogPanel;
        focusTarget.focus();
    });
}

function closeProjectDialog(){
    if(projectDialog.classList.contains("hidden")) return;
    if(projectDialog.classList.contains("is-search-popup")) projectSearchSession = null;
    projectDialog.classList.add("hidden");
    projectDialog.classList.remove("is-resource-popup");
    projectDialog.classList.remove("is-search-popup");
    projectDialog.classList.remove("is-note-title-popup");
    document.getElementById("projectDialogClose").disabled = false;
    projectDialogPanel.setAttribute("aria-modal", "true");
    projectDialog.setAttribute("aria-hidden", "true");
    projectDialogContent.innerHTML = "";
    const trigger = projectState.dialogTrigger;
    const fallbackSelector = projectState.dialogFallbackSelector;
    projectState.dialogTrigger = null;
    projectState.dialogFallbackSelector = null;
    if(trigger && typeof trigger.focus === "function" && document.contains(trigger) && !trigger.closest(".hidden")) trigger.focus();
    else if(fallbackSelector){
        const fallback = document.querySelector(fallbackSelector) || document.getElementById(projectState.subjectId ? "projectAddTopicButton" : "projectAddSubjectButton");
        fallback?.focus();
    }
}

function setProjectDialogError(message){
    const error = projectDialogContent.querySelector("[data-project-dialog-error]");
    if(error){
        error.textContent = message;
        error.classList.toggle("is-visible", Boolean(message));
        error.setAttribute("aria-live", "polite");
    }
    const input = projectDialogContent.querySelector("input, select");
    if(input && message) input.setAttribute("aria-invalid", "true");
    else if(input) input.removeAttribute("aria-invalid");
}

function openProjectForm(title, description, fieldMarkup, primaryLabel, onSubmit, focusSelector = "input"){
    setProjectDialog(title, `
        <form class="project-dialog-form" novalidate>
            ${description ? `<p class="project-dialog-description">${escapeProjectHtml(description)}</p>` : ""}
            ${fieldMarkup}
            <p id="projectDialogError" class="project-dialog-error" data-project-dialog-error role="status"></p>
            <div class="project-dialog-actions">
                <button class="project-secondary-button" type="button" data-project-dialog-cancel>Cancel</button>
                <button class="project-primary-button" type="submit">${escapeProjectHtml(primaryLabel)}</button>
            </div>
        </form>
    `, focusSelector);
    const form = projectDialogContent.querySelector("form");
    form.addEventListener("submit", event => {
        event.preventDefault();
        setProjectDialogError("");
        if(onSubmit(form) !== false) closeProjectDialog();
    });
    projectDialogContent.querySelector("[data-project-dialog-cancel]").addEventListener("click", closeProjectDialog);
}

function openProjectConfirm(title, message, confirmLabel, onConfirm, danger = true){
    setProjectDialog(title, `
        <div class="project-dialog-form">
            <p class="project-dialog-description">${escapeProjectHtml(message)}</p>
            <div class="project-dialog-actions">
                <button class="project-secondary-button" type="button" data-project-dialog-cancel>Cancel</button>
                <button class="project-primary-button ${danger ? "project-danger-button" : ""}" type="button" data-project-confirm>${escapeProjectHtml(confirmLabel)}</button>
            </div>
        </div>
    `, "[data-project-dialog-cancel]");
    projectDialogContent.querySelector("[data-project-dialog-cancel]").addEventListener("click", closeProjectDialog);
    projectDialogContent.querySelector("[data-project-confirm]").addEventListener("click", () => {
        onConfirm();
        closeProjectDialog();
    });
}

function openProjectSubjectForm(subjectId = null){
    const subject = subjectId ? projectSubjects().find(item => getProjectSubjectId(item, false) === subjectId) : null;
    if(subjectId && !subject) return;
    const initialName = subject ? subject.name : "";
    openProjectForm(
        subject ? "Rename subject" : "Create a subject",
        "Choose a clear name for this subject.",
        `<label class="project-dialog-label" for="projectDialogName">Subject name</label>
         <input id="projectDialogName" class="project-dialog-input" name="name" type="text" maxlength="80" required autocomplete="off" aria-describedby="projectDialogError" value="${escapeProjectHtml(initialName)}" placeholder="e.g. Engineering Mechanics">`,
        subject ? "Save changes" : "Create Subject",
        form => {
            const name = form.elements.name.value.trim();
            if(!name){ setProjectDialogError("Enter a subject name to continue."); return false; }
            const duplicate = projectSubjects().some(item =>
                item.name.toLowerCase() === name.toLowerCase() && getProjectSubjectId(item, false) !== subjectId
            );
            if(duplicate){ setProjectDialogError("A subject with that name already exists. Choose another name."); return false; }

            if(subject){
                const oldName = subject.name;
                subject.name = name;
                if(!saveProjectSubjects()){
                    subject.name = oldName;
                    setProjectDialogError("The Project subject could not be saved. No changes were made.");
                    return false;
                }
                showToast("Subject renamed successfully.", "success");
            }else{
                const newSubject = { id: createProjectId(), name, priority: "high" };
                projectSubjectRecords.push(newSubject);
                if(!saveProjectSubjects()){
                    projectSubjectRecords.pop();
                    setProjectDialogError("The Project subject could not be saved. No changes were made.");
                    return false;
                }
                showToast("Subject created successfully.", "success");
            }
            renderProjectHome();
            return true;
        }
    );
}

function openProjectDeleteSubject(subjectId){
    const subject = projectSubjects().find(item => getProjectSubjectId(item, false) === subjectId);
    if(!subject) return;
    if(!projectNoteStorageReady){
        showToast("This subject cannot be deleted until its saved notes can be read safely.", "error");
        return;
    }
    const topicCount = projectTopicsForSubject(subjectId).length;
    const noteCount = projectNoteRecords.filter(note => note.subjectId === subjectId).length;
    const details = [];
    if(topicCount) details.push(`${topicCount} topic${topicCount === 1 ? "" : "s"}, including any nested topics`);
    if(noteCount) details.push(`${noteCount} note${noteCount === 1 ? "" : "s"}`);
    const impact = details.length ? ` This will include ${details.join(" and ")}.` : "";
    openProjectConfirm("Move subject to Recycle Bin?", `Move “${subject.name}” to Recycle Bin?${impact} Its topics, notes, and uploaded files will be kept together.`, "Move to Recycle Bin", () => {
        if(!deleteProjectSubject(subjectId)){
            showToast("The Project subject could not be deleted. No changes were made.", "error");
            return;
        }
        showToast("Project subject moved to Recycle Bin.", "success");
        renderProjectHome();
    });
}

function openProjectTopicForm(parentId = null, topicId = null){
    const subject = projectSubjects().find(item => getProjectSubjectId(item, false) === projectState.subjectId);
    if(!subject) return;
    const editingTopic = topicId ? projectTopicById(topicId) : null;
    if(topicId && !editingTopic) return;
    const parent = parentId ? projectTopicById(parentId) : null;
    const location = editingTopic
        ? "Update this topic's name. Its child topics will stay connected."
        : parent ? `This topic will be created inside “${parent.name}”.` : `This topic will be created at the root of ${subject.name}.`;
    openProjectForm(
        editingTopic ? "Rename topic" : "Add topic",
        location,
        `<label class="project-dialog-label" for="projectDialogName">Topic name</label>
         <input id="projectDialogName" class="project-dialog-input" name="name" type="text" maxlength="100" required autocomplete="off" aria-describedby="projectDialogError" value="${escapeProjectHtml(editingTopic ? editingTopic.name : "")}" placeholder="e.g. Core concepts">`,
        editingTopic ? "Save changes" : "Create topic",
        form => {
            const name = form.elements.name.value.trim();
            if(!name){ setProjectDialogError("Enter a topic name to continue."); return false; }
            const targetParent = editingTopic ? editingTopic.parentId : parentId;
            const duplicate = projectTopicChildren(targetParent).some(item =>
                item.name.toLowerCase() === name.toLowerCase() && item.id !== topicId
            );
            if(duplicate){ setProjectDialogError("A topic with that name already exists here. Choose another name."); return false; }

            if(editingTopic){
                editingTopic.name = name;
                showToast("Topic renamed successfully.", "success");
            }else{
                const newTopic = {
                    id: createProjectId(),
                    subjectId: projectState.subjectId,
                    parentId: parentId || null,
                    name,
                    order: projectTopicChildren(parentId).length
                };
                projectTopicRecords.push(newTopic);
                projectState.selectedTopicId = newTopic.id;
                if(parentId) projectState.expandedIds.add(parentId);
                showToast("Topic created successfully.", "success");
            }
            saveProjectTopics();
            saveProjectExpandedState();
            renderProjectWorkspace();
            return true;
        }
    );
}

function projectParentOptions(topic){
    const invalidIds = projectDescendantIds(topic.id);
    invalidIds.add(topic.id);
    const options = [`<option value="">Subject root</option>`];
    const addBranch = (parentId, level) => projectTopicChildren(parentId).forEach(item => {
        if(!invalidIds.has(item.id)){
            const prefix = level ? `${"— ".repeat(Math.min(level, 5))}` : "";
            options.push(`<option value="${escapeProjectHtml(item.id)}" ${topic.parentId === item.id ? "selected" : ""}>${escapeProjectHtml(prefix + item.name)}</option>`);
            addBranch(item.id, level + 1);
        }
    });
    addBranch(null, 0);
    if(!topic.parentId) options[0] = `<option value="" selected>Subject root</option>`;
    return options.join("");
}

function openProjectMoveTopic(topicId){
    const topic = projectTopicById(topicId);
    if(!topic) return;
    openProjectForm(
        "Move topic",
        `Move “${topic.name}” and all of its child topics. Choose the new parent.`,
        `<label class="project-dialog-label" for="projectMoveParent">New parent</label>
         <select id="projectMoveParent" class="project-dialog-input" name="parentId" aria-describedby="projectDialogError">${projectParentOptions(topic)}</select>`,
        "Move topic",
        form => {
            const parentId = form.elements.parentId.value || null;
            const moveError = projectTopicMoveError(topic.id, parentId);
            if(moveError){
                setProjectDialogError(moveError);
                return false;
            }
            const oldParentId = topic.parentId;
            topic.parentId = parentId;
            topic.order = projectTopicChildren(parentId).filter(item => item.id !== topic.id).length;
            normalizeProjectSiblingOrder(oldParentId);
            normalizeProjectSiblingOrder(parentId);
            if(parentId) projectState.expandedIds.add(parentId);
            saveProjectTopics();
            saveProjectExpandedState();
            renderProjectWorkspace();
            showToast("Topic moved successfully.", "success");
            return true;
        },
        "select"
    );
}

function reorderProjectTopic(topicId, direction){
    const topic = projectTopicById(topicId);
    if(!topic) return;
    const siblings = projectTopicChildren(topic.parentId);
    const index = siblings.findIndex(item => item.id === topicId);
    const swapIndex = index + direction;
    if(index < 0 || swapIndex < 0 || swapIndex >= siblings.length) return;
    const other = siblings[swapIndex];
    const order = topic.order;
    topic.order = other.order;
    other.order = order;
    normalizeProjectSiblingOrder(topic.parentId);
    saveProjectTopics();
    renderProjectWorkspace();
    projectTopicTree.querySelector(`[data-topic-select="${topicId}"]`)?.focus();
    showToast("Topic order updated.", "success");
}

function deleteProjectTopic(topicId){
    const topic = projectTopicById(topicId);
    if(!topic) return;
    if(!projectNoteStorageReady){
        showToast("This topic cannot be deleted until its saved notes can be read safely.", "error");
        return;
    }
    const removedIds = projectDescendantIds(topicId);
    removedIds.add(topicId);
    const removedCount = removedIds.size;
    const removedNoteCount = projectNoteRecords.filter(note => note.ownerType === "topic" && removedIds.has(note.ownerId)).length;
    const oldParentId = topic.parentId;
    const nestedCount = removedCount - 1;
    const nestedText = nestedCount ? ` and ${nestedCount} nested topic${nestedCount === 1 ? "" : "s"}` : "";
    const noteText = removedNoteCount ? ` ${removedNoteCount} note${removedNoteCount === 1 ? "" : "s"} owned by this topic or its nested topics will be included.` : "";
    openProjectConfirm("Move topic to Recycle Bin?", `Move “${topic.name}”${nestedText} to Recycle Bin?${noteText} Its descendants and notes will be kept together.`, "Move to Recycle Bin", () => {
        const subjectId = projectState.subjectId;
        const removedTopics = projectTopicRecords.filter(item => removedIds.has(item.id)).map(item => ({ ...item }));
        const removedNotes = projectNoteRecords.filter(note => note.ownerType === "topic" && removedIds.has(note.ownerId)).map(note => ({ ...note }));
        const nextTopics = projectTopicRecords.filter(item => !removedIds.has(item.id)).map(item => ({ ...item }));
        const nextNotes = projectNoteRecords.filter(note => !(note.ownerType === "topic" && removedIds.has(note.ownerId)));
        const nextExpandedIds = new Set([...projectState.expandedIds].filter(id => !removedIds.has(id)));
        const nextExpandedBySubject = { ...projectExpandedBySubject, [subjectId]: [...nextExpandedIds] };
        const remainingSiblings = nextTopics
            .filter(item => item.subjectId === subjectId && item.parentId === oldParentId)
            .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
        remainingSiblings.forEach((item, index) => { item.order = index; });
        const entry = makeRecycleBinEntry("topic", topic.name, {
            subjectId,
            subjectName: projectSubjects().find(item => getProjectSubjectId(item, false) === subjectId)?.name || "Project",
            parentId: oldParentId,
            parentName: oldParentId ? projectTopicRecords.find(item => item.id === oldParentId)?.name || "Topic" : "Subject root"
        }, {
            subjectId,
            topics: removedTopics,
            notes: removedNotes,
            hadExpandedState: Object.prototype.hasOwnProperty.call(projectExpandedBySubject, subjectId),
            expandedState: [...projectState.expandedIds]
        });
        if(!persistRecycleBinAndStorage([...recycleBinEntries, entry], [
            ["ironMindProjectTopics", nextTopics],
            [PROJECT_NOTES_KEY, nextNotes],
            ["ironMindProjectExpandedTopics", nextExpandedBySubject]
        ])){
            showToast("The topic could not be deleted safely. No changes were made.", "error");
            return;
        }

        projectTopicRecords = nextTopics;
        projectNoteRecords = nextNotes;
        projectExpandedBySubject = nextExpandedBySubject;
        projectState.expandedIds = nextExpandedIds;
        if(removedIds.has(projectState.selectedTopicId)) projectState.selectedTopicId = oldParentId || null;
        if(projectState.activeNoteId && !nextNotes.some(note => note.id === projectState.activeNoteId)){
            projectState.activeNoteId = null;
            projectState.isEditingNote = false;
        }
        renderProjectWorkspace();
        showToast("Topic moved to Recycle Bin.", "success");
    });
}

function projectNoteTreeItem(note, level = 0){
    const selected = projectState.activeNoteId === note.id;
    const indent = Math.min(level, 7) * 14;
    const actionsDisabled = projectNoteStorageReady ? "" : "disabled";
    return `<li class="project-note-node" role="treeitem" aria-level="${level + 1}" aria-current="${selected ? "page" : "false"}">
        <div class="project-note-row" style="--project-note-indent:${indent}px">
            <button class="project-note-tree-item ${selected ? "is-selected" : ""}" type="button" data-project-note-open="${escapeProjectHtml(note.id)}" aria-label="Open note: ${escapeProjectHtml(note.title)}" title="${escapeProjectHtml(note.title)}">
                ${projectItemIcon("note")}<span>${escapeProjectHtml(note.title)}</span>
            </button>
            <button class="project-topic-more project-note-more" type="button" data-note-menu-toggle="${escapeProjectHtml(note.id)}" aria-label="Actions for note: ${escapeProjectHtml(note.title)}" aria-haspopup="menu" aria-expanded="false"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button>
            <div class="project-note-menu hidden" role="menu">
                <button type="button" role="menuitem" data-note-action="rename" data-note-id="${escapeProjectHtml(note.id)}" ${actionsDisabled}>Rename</button>
                <button type="button" role="menuitem" data-note-action="move" data-note-id="${escapeProjectHtml(note.id)}" ${actionsDisabled}>Move…</button>
                <button type="button" role="menuitem" class="is-danger" data-note-action="delete" data-note-id="${escapeProjectHtml(note.id)}" ${actionsDisabled}>Delete</button>
            </div>
        </div>
    </li>`;
}

function projectTopicTreeNode(topic, level = 0){
    const children = projectTopicChildren(topic.id);
    const hasNestedItems = children.length > 0;
    const expanded = projectState.expandedIds.has(topic.id);
    const selected = projectState.selectedTopicId === topic.id;
    const indent = Math.min(level, 7) * 14;
    const childMarkup = hasNestedItems && expanded
        ? `<ul class="project-topic-children" role="group">${children.map(child => projectTopicTreeNode(child, level + 1)).join("")}</ul>`
        : "";
    const menu = `
        <div class="project-topic-menu hidden" role="menu">
            <button type="button" role="menuitem" data-topic-action="rename" data-topic-id="${escapeProjectHtml(topic.id)}">Rename</button>
            <button type="button" role="menuitem" data-topic-action="move" data-topic-id="${escapeProjectHtml(topic.id)}">Move…</button>
            <button type="button" role="menuitem" data-topic-action="up" data-topic-id="${escapeProjectHtml(topic.id)}" ${topic.order <= 0 ? "disabled" : ""}>Move up</button>
            <button type="button" role="menuitem" data-topic-action="down" data-topic-id="${escapeProjectHtml(topic.id)}" ${projectTopicChildren(topic.parentId).at(-1)?.id === topic.id ? "disabled" : ""}>Move down</button>
            <button type="button" role="menuitem" class="is-danger" data-topic-action="delete" data-topic-id="${escapeProjectHtml(topic.id)}">Delete</button>
        </div>`;
    return `<li class="project-topic-node" role="treeitem" aria-level="${level + 1}" ${hasNestedItems ? `aria-expanded="${expanded}"` : ""}>
        <div class="project-topic-row ${selected ? "is-selected" : ""}" style="--project-topic-indent:${indent}px">
            ${hasNestedItems
                ? `<button class="project-topic-expand" type="button" data-topic-expand="${escapeProjectHtml(topic.id)}" aria-label="${expanded ? "Collapse" : "Expand"} ${escapeProjectHtml(topic.name)}" aria-expanded="${expanded}"><i class="fa-solid fa-chevron-${expanded ? "down" : "right"}" aria-hidden="true"></i></button>`
                : `<span class="project-topic-expand-placeholder" aria-hidden="true"></span>`}
            <button class="project-topic-select" type="button" data-topic-select="${escapeProjectHtml(topic.id)}" aria-current="${selected ? "page" : "false"}">
                ${projectItemIcon("topic", { level })}<span title="${escapeProjectHtml(topic.name)}">${escapeProjectHtml(topic.name)}</span>
            </button>
            <button class="project-topic-more" type="button" data-topic-menu-toggle="${escapeProjectHtml(topic.id)}" aria-label="Actions for ${escapeProjectHtml(topic.name)}" aria-haspopup="menu" aria-expanded="false"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button>
            ${menu}
        </div>${childMarkup}
    </li>`;
}

function renderProjectTree(){
    if(!projectState.subjectId) return;
    const roots = projectTopicChildren(null);
    const topicMarkup = roots.length
        ? `<ul class="project-topic-root" role="tree" aria-label="Topics">${roots.map(topic => projectTopicTreeNode(topic)).join("")}</ul>`
        : `<div class="project-tree-empty">No topics yet. Use Add Subtopic to create one.</div>`;
    projectTopicTree.innerHTML = topicMarkup;
}

function selectProjectTopic(topicId){
    const topic = projectTopicById(topicId);
    if(!topic) return;
    projectState.selectedTopicId = topic.id;
    projectTopicPath(topic.id).slice(0, -1).forEach(ancestor => projectState.expandedIds.add(ancestor.id));
    saveProjectExpandedState();
    renderProjectWorkspace();
    closeProjectTreeDrawer();
    projectTopicMain.focus({ preventScroll: true });
}

function toggleProjectTopic(topicId){
    if(!projectTopicHasNestedItems(topicId)) return;
    if(projectState.expandedIds.has(topicId)) projectState.expandedIds.delete(topicId);
    else projectState.expandedIds.add(topicId);
    saveProjectExpandedState();
    renderProjectTree();
    projectTopicTree.querySelector(`[data-topic-expand="${topicId}"]`)?.focus();
}

function renderProjectTopicDetail(topic){
    const subject = projectSubjects().find(item => getProjectSubjectId(item, false) === projectState.subjectId);
    const path = topic ? projectTopicPath(topic.id) : [];
    const breadcrumbs = [
        `<button type="button" class="project-breadcrumb-link" data-project-breadcrumb="projects">Projects</button>`,
        `<button type="button" class="project-breadcrumb-link" data-project-breadcrumb="subject">${escapeProjectHtml(subject ? subject.name : "Subject")}</button>`
    ]
        .concat(path.map((item, index) => index === path.length - 1
            ? `<span class="project-breadcrumb-current" aria-current="page">${escapeProjectHtml(item.name)}</span>`
            : `<button type="button" class="project-breadcrumb-link" data-project-breadcrumb="${escapeProjectHtml(item.id)}">${escapeProjectHtml(item.name)}</button>`
        )).join(`<i class="fa-solid fa-chevron-right project-breadcrumb-separator" aria-hidden="true"></i>`);
    const children = projectTopicChildren(topic?.id ?? null);
    const notes = topic ? projectNotesForTopic(topic.id) : projectNotesForSubject(projectState.subjectId);
    const resourceOwnerType = topic ? "topic" : "subject";
    const resourceOwnerId = topic ? topic.id : projectState.subjectId;
    const noteMarkup = notes.length
        ? `<div class="project-content-note-list">${notes.map(note => projectContentNoteItem(note)).join("")}</div>`
        : `<p class="project-no-children">No notes yet.</p>`;
    projectTopicDetail.innerHTML = `
        <nav class="project-breadcrumbs" aria-label="Breadcrumb">${breadcrumbs}</nav>
        <section class="project-child-topics" aria-labelledby="projectChildTopicsTitle">
            <h3 id="projectChildTopicsTitle">${topic ? "Subtopics" : "Topics"}</h3>
            ${children.length
                ? `<div class="project-child-topic-list">${children.map(child => `<button class="project-child-topic" type="button" data-topic-select="${escapeProjectHtml(child.id)}">${projectItemIcon("topic", { level: path.length })}<span>${escapeProjectHtml(child.name)}</span><i class="fa-solid fa-arrow-up-right-from-square project-child-open-icon" aria-hidden="true"></i></button>`).join("")}</div>`
                : `<p class="project-no-children">${topic ? "No subtopics yet." : "No topics yet."}</p>`}
        </section>
        <section class="project-content-notes" aria-labelledby="projectContentNotesTitle">
            <h3 id="projectContentNotesTitle">Notes</h3>
            ${noteMarkup}
        </section>
        <section class="project-content-resources" aria-labelledby="projectContentResourcesTitle">
            <h3 id="projectContentResourcesTitle">Resources</h3>
            <div class="project-content-resource-list" data-project-resource-list aria-live="polite"><p class="project-no-children">Loading saved resources…</p></div>
        </section>`;
    projectTopicDetail.classList.remove("hidden");
    projectTopicWelcome.classList.add("hidden");
    populateProjectResourceList(projectTopicDetail.querySelector("[data-project-resource-list]"), {
        subjectId: projectState.subjectId,
        ownerType: resourceOwnerType,
        ownerId: resourceOwnerId
    });
}

function projectNoteOwnerDescription(note){
    const subject = projectSubjects().find(item => getProjectSubjectId(item, false) === note.subjectId);
    if(!subject) return "Project note";
    if(note.ownerType === "subject") return `${subject.name} · Subject note`;
    const path = projectTopicPath(note.ownerId).map(topic => topic.name);
    return `${subject.name}${path.length ? ` · ${path.join(" · ")}` : ""}`;
}

function sanitizeProjectNoteHtml(html){
    const container = document.createElement("div");
    container.innerHTML = String(html || "");
    const allowedTags = new Set(["P", "DIV", "BR", "H1", "H2", "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "TABLE", "COLGROUP", "COL", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD", "IMG", "MATH-SPAN", "MATH-DIV"]);
    const discardedTags = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "MATH", "VIDEO", "AUDIO", "FORM", "INPUT", "LINK", "META"]);

    const cleanNode = node => {
        if(node.nodeType === Node.TEXT_NODE) return escapeProjectHtml(node.nodeValue || "");
        if(node.nodeType !== Node.ELEMENT_NODE) return "";
        if(discardedTags.has(node.tagName)) return "";
        const children = [...node.childNodes].map(cleanNode).join("");
        if(!allowedTags.has(node.tagName)) return children;
        if(node.tagName === "BR") return "<br>";
        const tag = node.tagName.toLowerCase();
        if(node.tagName === "MATH-SPAN" || node.tagName === "MATH-DIV"){
            const mode = node.getAttribute("mode");
            const safeMode = mode === "displaystyle" || mode === "textstyle" ? ` mode="${mode}"` : "";
            return `<${tag}${safeMode}>${children}</${tag}>`;
        }
        if(node.tagName === "IMG"){
            const src = node.getAttribute("src") || "";
            if(!/^data:image\/(?:png|jpeg|webp|gif|bmp);base64,[a-z0-9+/]+={0,2}$/i.test(src)) return "";
            const alt = escapeProjectHtml(node.getAttribute("alt") || "");
            const imageStyles = ["width", "max-width", "margin-top", "margin-right", "margin-bottom", "margin-left"];
            const safeImageDimensions = imageStyles.map(property => {
                const value = node.style.getPropertyValue(property).trim();
                const match = value.match(/^(\d+(?:\.\d+)?)(px|%)$/);
                if(!match) return "";
                if(property.startsWith("margin-") && match[2] !== "px") return "";
                const numericValue = Number(match[1]);
                if(numericValue > 1200 || (match[2] === "%" && numericValue > 100)) return "";
                return `${property}:${value}`;
            }).filter(Boolean);
            const safeImageFloat = ["left", "right"].includes(node.style.float) ? `float:${node.style.float}` : "";
            const safeImageStyles = [...safeImageDimensions, safeImageFloat, "height:auto"].filter(Boolean).join(";");
            return `<img src="${escapeProjectHtml(src)}" alt="${alt}" style="${safeImageStyles}">`;
        }
        const dimensionProperties = {
            TABLE:["width", "margin-left", "margin-right"],
            COL:["width"],
            TR:["height"]
        }[node.tagName] || [];
        const safeDimensions = dimensionProperties.map(property => {
            const value = node.style.getPropertyValue(property).trim();
            const match = value.match(/^(\d+(?:\.\d+)?)(px|%)$/);
            if(property.startsWith("margin-") && match?.[2] !== "px") return "";
            const numericValue = match ? Number(match[1]) : NaN;
            if(!match || numericValue > 5000 || (numericValue === 0 && !property.startsWith("margin-")) || (match[2] === "%" && numericValue > 100)) return "";
            return `${property}:${value}`;
        }).filter(Boolean).join(";");
        const safeFloat = node.tagName === "TABLE" && ["left", "right"].includes(node.style.float)
            ? `float:${node.style.float}`
            : "";
        const safeStyles = [safeDimensions, safeFloat].filter(Boolean).join(";");
        const safeStyle = safeStyles ? ` style="${safeStyles}"` : "";
        if(node.tagName === "COL") return `<col${safeStyle}>`;
        if(node.tagName === "DIV"){
            const tableSide = node.getAttribute("data-project-table-side");
            const legacyTable = [...node.children].find(child => child.tagName === "TABLE");
            if(legacyTable && ["left", "right"].includes(tableSide)){
                const tableCopy = legacyTable.cloneNode(true);
                const savedWidth = tableCopy.style.width.trim().match(/^(\d+(?:\.\d+)?)%$/);
                tableCopy.style.width = `${savedWidth ? Math.max(1, Math.min(100, Number(savedWidth[1]) / 2)) : 50}%`;
                tableCopy.style.float = tableSide;
                tableCopy.style.removeProperty("margin-left");
                tableCopy.style.removeProperty("margin-right");
                return [...node.childNodes].map(child => child === legacyTable ? cleanNode(tableCopy) : cleanNode(child)).join("");
            }
            return `<div>${children}</div>`;
        }
        return `<${tag}${safeStyle}>${children}</${tag}>`;
    };

    return [...container.childNodes].map(cleanNode).join("");
}

function projectNoteEditorHtml(note){
    if(note.contentFormat === "html") return sanitizeProjectNoteHtml(note.content);
    return escapeProjectHtml(note.content || "").replace(/\r\n?|\n/g, "<br>");
}

const PROJECT_EQUATION_PALETTES = [
    {
        id:"algebra", label:"Algebra", templates:[
            {label:"Fraction", latex:"\\frac{#?}{#?}"},
            {label:"Nested fraction", latex:"\\frac{\\frac{#?}{#?}+#?}{#?}"},
            {label:"Power", latex:"#@^{#?}"},
            {label:"Subscript", latex:"#@_{#?}"},
            {label:"Subscript + power", latex:"#@_{#?}^{#?}"},
            {label:"Square root", latex:"\\sqrt{#?}"},
            {label:"Nth root", latex:"\\sqrt[#?]{#?}"},
            {label:"Parentheses", latex:"\\left(#?\\right)"},
            {label:"Square brackets", latex:"\\left[#?\\right]"},
            {label:"Curly braces", latex:"\\left\\{#?\\right\\}"},
            {label:"Absolute value", latex:"\\left|#?\\right|"},
            {label:"Norm", latex:"\\left\\lVert#?\\right\\rVert"},
            {label:"Floor", latex:"\\left\\lfloor#?\\right\\rfloor"},
            {label:"Ceiling", latex:"\\left\\lceil#?\\right\\rceil"},
            {label:"Binomial", latex:"\\binom{#?}{#?}"},
            {label:"2 × 2 matrix", latex:"\\begin{bmatrix}#?&#?\\\\#?&#?\\end{bmatrix}"},
            {label:"Determinant", latex:"\\begin{vmatrix}#?&#?\\\\#?&#?\\end{vmatrix}"},
            {label:"Piecewise", latex:"\\begin{cases}#?&#?\\\\#?&#?\\end{cases}"},
            {label:"Equation", latex:"#?=#?"},
            {label:"Inequality", latex:"#?\\le #?"}
        ], symbols:[
            {label:"+", latex:"+", title:"Addition"}, {label:"−", latex:"-", title:"Subtraction"},
            {label:"×", latex:"\\times", title:"Multiplication"}, {label:"·", latex:"\\cdot", title:"Dot multiplication"},
            {label:"÷", latex:"\\div", title:"Division"}, {label:"=", latex:"=", title:"Equals"},
            {label:"≠", latex:"\\ne", title:"Not equal"}, {label:"≈", latex:"\\approx", title:"Approximately equal"},
            {label:">", latex:"\\gt", title:"Greater than"}, {label:"<", latex:"\\lt", title:"Less than"},
            {label:"≥", latex:"\\ge", title:"Greater than or equal to"}, {label:"≤", latex:"\\le", title:"Less than or equal to"},
            {label:"±", latex:"\\pm", title:"Plus or minus"}, {label:"∓", latex:"\\mp", title:"Minus or plus"},
            {label:"∝", latex:"\\propto", title:"Proportional to"}, {label:"∞", latex:"\\infty", title:"Infinity"},
            {label:"°", latex:"{}^{\\circ}", title:"Degree"}, {label:"%", latex:"\\%", title:"Percent"}
        ]
    },
    {
        id:"calculus", label:"Calculus", templates:[
            {label:"Limit", latex:"\\lim_{#?\\to #?}#?"},
            {label:"Summation", latex:"\\sum_{#?}^{#?}#?"},
            {label:"Product", latex:"\\prod_{#?}^{#?}#?"},
            {label:"Definite integral", latex:"\\int_{#?}^{#?}#?\\,d#?"},
            {label:"Double integral", latex:"\\iint_{#?}^{#?}#?\\,d#?"},
            {label:"Indefinite integral", latex:"\\int #?\\,d#?"},
            {label:"Derivative", latex:"\\frac{d#?}{d#?}"},
            {label:"Second derivative", latex:"\\frac{d^2#?}{d#?^2}"},
            {label:"Partial derivative", latex:"\\frac{\\partial #?}{\\partial #?}"},
            {label:"Higher partial", latex:"\\frac{\\partial^2 #?}{\\partial #?^2}"},
            {label:"Differential equation", latex:"\\frac{d#?}{d#?}+#?=0"},
            {label:"Time derivative", latex:"\\dot{#?}"},
            {label:"Second time derivative", latex:"\\ddot{#?}"},
            {label:"Contour integral", latex:"\\oint_{#?}#?\\,d#?"}
        ], symbols:[
            {label:"∂", latex:"\\partial", title:"Partial derivative"}, {label:"∇", latex:"\\nabla", title:"Nabla"},
            {label:"∫", latex:"\\int", title:"Integral"}, {label:"∬", latex:"\\iint", title:"Double integral"},
            {label:"∭", latex:"\\iiint", title:"Triple integral"}, {label:"∮", latex:"\\oint", title:"Contour integral"},
            {label:"∑", latex:"\\sum", title:"Summation"}, {label:"∏", latex:"\\prod", title:"Product"},
            {label:"→", latex:"\\to", title:"Tends to / maps to"}, {label:"↦", latex:"\\mapsto", title:"Maps to"},
            {label:"′", latex:"\\prime", title:"Prime"}, {label:"∞", latex:"\\infty", title:"Infinity"}
        ]
    },
    {
        id:"functions", label:"Functions", templates:[
            {label:"Sine", latex:"\\sin\\left(#?\\right)"}, {label:"Cosine", latex:"\\cos\\left(#?\\right)"},
            {label:"Tangent", latex:"\\tan\\left(#?\\right)"}, {label:"Inverse sine", latex:"\\arcsin\\left(#?\\right)"},
            {label:"Inverse cosine", latex:"\\arccos\\left(#?\\right)"}, {label:"Inverse tangent", latex:"\\arctan\\left(#?\\right)"},
            {label:"Logarithm", latex:"\\log_{#?}\\left(#?\\right)"}, {label:"Natural log", latex:"\\ln\\left(#?\\right)"},
            {label:"Exponential", latex:"e^{#?}"}, {label:"Real part", latex:"\\operatorname{Re}\\left(#?\\right)"},
            {label:"Imaginary part", latex:"\\operatorname{Im}\\left(#?\\right)"}, {label:"Complex number", latex:"#?+#?i"}
        ], symbols:[
            {label:"sin", latex:"\\sin", title:"Sine"}, {label:"cos", latex:"\\cos", title:"Cosine"},
            {label:"tan", latex:"\\tan", title:"Tangent"}, {label:"sin⁻¹", latex:"\\arcsin", title:"Inverse sine"},
            {label:"cos⁻¹", latex:"\\arccos", title:"Inverse cosine"}, {label:"tan⁻¹", latex:"\\arctan", title:"Inverse tangent"},
            {label:"log", latex:"\\log", title:"Logarithm"}, {label:"ln", latex:"\\ln", title:"Natural logarithm"},
            {label:"e", latex:"e", title:"Euler's number"}, {label:"i", latex:"i", title:"Imaginary unit"},
            {label:"π", latex:"\\pi", title:"Pi"}, {label:"|x|", latex:"\\left|#?\\right|", title:"Absolute value"}
        ]
    },
    {
        id:"greek", label:"Greek", templates:[], symbols:[
            {label:"α", latex:"\\alpha", title:"Alpha"}, {label:"β", latex:"\\beta", title:"Beta"},
            {label:"γ", latex:"\\gamma", title:"Gamma"}, {label:"δ", latex:"\\delta", title:"Delta"},
            {label:"ε", latex:"\\epsilon", title:"Epsilon"}, {label:"ϵ", latex:"\\varepsilon", title:"Variant epsilon"},
            {label:"ζ", latex:"\\zeta", title:"Zeta"}, {label:"η", latex:"\\eta", title:"Eta"},
            {label:"θ", latex:"\\theta", title:"Theta"}, {label:"ϑ", latex:"\\vartheta", title:"Variant theta"},
            {label:"ι", latex:"\\iota", title:"Iota"}, {label:"κ", latex:"\\kappa", title:"Kappa"},
            {label:"λ", latex:"\\lambda", title:"Lambda"}, {label:"μ", latex:"\\mu", title:"Mu"},
            {label:"ν", latex:"\\nu", title:"Nu"}, {label:"ξ", latex:"\\xi", title:"Xi"},
            {label:"π", latex:"\\pi", title:"Pi"}, {label:"ϖ", latex:"\\varpi", title:"Variant pi"},
            {label:"ρ", latex:"\\rho", title:"Rho"}, {label:"ϱ", latex:"\\varrho", title:"Variant rho"},
            {label:"σ", latex:"\\sigma", title:"Sigma"}, {label:"τ", latex:"\\tau", title:"Tau"},
            {label:"υ", latex:"\\upsilon", title:"Upsilon"}, {label:"φ", latex:"\\phi", title:"Phi"},
            {label:"ϕ", latex:"\\varphi", title:"Variant phi"}, {label:"χ", latex:"\\chi", title:"Chi"},
            {label:"ψ", latex:"\\psi", title:"Psi"}, {label:"ω", latex:"\\omega", title:"Omega"},
            {label:"Γ", latex:"\\Gamma", title:"Capital gamma"}, {label:"Δ", latex:"\\Delta", title:"Capital delta"},
            {label:"Θ", latex:"\\Theta", title:"Capital theta"}, {label:"Λ", latex:"\\Lambda", title:"Capital lambda"},
            {label:"Ξ", latex:"\\Xi", title:"Capital xi"}, {label:"Π", latex:"\\Pi", title:"Capital pi"},
            {label:"Σ", latex:"\\Sigma", title:"Capital sigma"}, {label:"Υ", latex:"\\Upsilon", title:"Capital upsilon"},
            {label:"Φ", latex:"\\Phi", title:"Capital phi"}, {label:"Ψ", latex:"\\Psi", title:"Capital psi"},
            {label:"Ω", latex:"\\Omega", title:"Capital omega"}
        ]
    },
    {
        id:"sets-logic", label:"Sets & logic", templates:[
            {label:"Function mapping", latex:"#?\\colon #?\\to #?"},
            {label:"Set builder", latex:"\\left\\{#?\\mid #?\\right\\}"},
            {label:"Implication", latex:"#?\\implies #?"},
            {label:"Equivalence", latex:"#?\\iff #?"}
        ], symbols:[
            {label:"∈", latex:"\\in", title:"Belongs to"}, {label:"∉", latex:"\\notin", title:"Does not belong to"},
            {label:"⊂", latex:"\\subset", title:"Subset"}, {label:"⊆", latex:"\\subseteq", title:"Subset or equal"},
            {label:"⊃", latex:"\\supset", title:"Superset"}, {label:"⊇", latex:"\\supseteq", title:"Superset or equal"},
            {label:"∪", latex:"\\cup", title:"Union"}, {label:"∩", latex:"\\cap", title:"Intersection"},
            {label:"∖", latex:"\\setminus", title:"Set difference"}, {label:"∅", latex:"\\emptyset", title:"Empty set"},
            {label:"ℕ", latex:"\\mathbb{N}", title:"Natural numbers"}, {label:"ℤ", latex:"\\mathbb{Z}", title:"Integers"},
            {label:"ℚ", latex:"\\mathbb{Q}", title:"Rational numbers"}, {label:"ℝ", latex:"\\mathbb{R}", title:"Real numbers"},
            {label:"ℂ", latex:"\\mathbb{C}", title:"Complex numbers"}, {label:"∧", latex:"\\land", title:"Logical and"},
            {label:"∨", latex:"\\lor", title:"Logical or"}, {label:"¬", latex:"\\neg", title:"Not"},
            {label:"⇒", latex:"\\implies", title:"Implies"}, {label:"⇔", latex:"\\iff", title:"If and only if"},
            {label:"∀", latex:"\\forall", title:"For all"}, {label:"∃", latex:"\\exists", title:"There exists"},
            {label:"∄", latex:"\\nexists", title:"There does not exist"}, {label:"∴", latex:"\\therefore", title:"Therefore"},
            {label:"∵", latex:"\\because", title:"Because"}, {label:"↔", latex:"\\leftrightarrow", title:"If and only if"},
            {label:"↦", latex:"\\mapsto", title:"Maps to"}
        ]
    },
    {
        id:"engineering", label:"Engineering & stats", templates:[
            {label:"Vector", latex:"\\begin{bmatrix}#?\\\\#?\\\\#?\\end{bmatrix}"},
            {label:"Vector components", latex:"\\vec{#?}=#?\\mathbf{i}+#?\\mathbf{j}+#?\\mathbf{k}"},
            {label:"Dot notation", latex:"\\dot{#?}"}, {label:"Double dot", latex:"\\ddot{#?}"},
            {label:"Units", latex:"\\mathrm{#?}"}, {label:"Mean", latex:"\\bar{#?}"},
            {label:"Expected value", latex:"\\mathbb{E}\\left[#?\\right]"},
            {label:"Variance", latex:"\\operatorname{Var}\\left(#?\\right)"},
            {label:"Probability", latex:"\\Pr\\left(#?\\right)"},
            {label:"Standard deviation", latex:"\\sigma_{#?}"},
            {label:"Efficiency ratio", latex:"\\eta=\\frac{#?}{#?}"}
        ], symbols:[
            {label:"→", latex:"\\vec{v}", title:"Vector arrow"}, {label:"τ", latex:"\\tau", title:"Torque / shear stress"},
            {label:"σ", latex:"\\sigma", title:"Stress"}, {label:"ε", latex:"\\epsilon", title:"Strain"},
            {label:"ω", latex:"\\omega", title:"Angular velocity"}, {label:"μ", latex:"\\mu", title:"Coefficient of friction"},
            {label:"ρ", latex:"\\rho", title:"Density"}, {label:"η", latex:"\\eta", title:"Efficiency"},
            {label:"Ω", latex:"\\Omega", title:"Ohm / angular speed"}, {label:"Δ", latex:"\\Delta", title:"Change / delta"},
            {label:"°", latex:"{}^{\\circ}", title:"Degree"}, {label:"N", latex:"\\mathrm{N}", title:"Newton"},
            {label:"m", latex:"\\mathrm{m}", title:"Metre"}, {label:"s", latex:"\\mathrm{s}", title:"Second"},
            {label:"kg", latex:"\\mathrm{kg}", title:"Kilogram"}, {label:"Pa", latex:"\\mathrm{Pa}", title:"Pascal"},
            {label:"J", latex:"\\mathrm{J}", title:"Joule"}, {label:"W", latex:"\\mathrm{W}", title:"Watt"},
            {label:"K", latex:"\\mathrm{K}", title:"Kelvin"}, {label:"x̄", latex:"\\bar{x}", title:"Sample mean"},
            {label:"x̂", latex:"\\hat{x}", title:"Estimate"}, {label:"E[ ]", latex:"\\mathbb{E}[#?]", title:"Expected value"}
        ]
    }
];

function projectEquationPaletteMarkup(categoryId){
    const category = PROJECT_EQUATION_PALETTES.find(item => item.id === categoryId) || PROJECT_EQUATION_PALETTES[0];
    const templates = category.templates.length ? category.templates.map(template =>
        `<button class="project-equation-template" type="button" data-equation-template="${escapeProjectHtml(template.latex)}" title="Insert ${escapeProjectHtml(template.label)}"><span aria-hidden="true">${escapeProjectHtml(template.label)}</span></button>`
    ).join("") : `<span class="project-equation-palette-empty">No templates in this group. Use the symbols below or the math keyboard.</span>`;
    const symbols = category.symbols.map(symbol =>
        `<button class="project-equation-symbol" type="button" data-equation-symbol="${escapeProjectHtml(symbol.latex)}" title="${escapeProjectHtml(symbol.title)}" aria-label="Insert ${escapeProjectHtml(symbol.title)}">${escapeProjectHtml(symbol.label)}</button>`
    ).join("");
    return `<section class="project-equation-palette-group" aria-labelledby="projectEquationTemplatesHeading"><h3 id="projectEquationTemplatesHeading">Templates</h3><div class="project-equation-template-list">${templates}</div></section><section class="project-equation-palette-group" aria-labelledby="projectEquationSymbolsHeading"><h3 id="projectEquationSymbolsHeading">Symbols</h3><div class="project-equation-symbol-list">${symbols}</div></section>`;
}

function projectEquationSelectionRange(editor){
    const selection = window.getSelection();
    if(selection && selection.rangeCount){
        const range = selection.getRangeAt(0);
        if(editor.contains(range.commonAncestorContainer)) return range.cloneRange();
    }
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    return range;
}

function createProjectEquationElement(latex, mode){
    const element = document.createElement(mode === "display" ? "math-div" : "math-span");
    element.setAttribute("mode", mode === "display" ? "displaystyle" : "textstyle");
    element.textContent = latex;
    return element;
}

function setupProjectEquationEditorNodes(editor){
    editor.querySelectorAll("math-span, math-div").forEach(equation => {
        equation.contentEditable = "false";
        equation.tabIndex = 0;
        equation.title = "Click to edit this equation";
    });
    let displayEquation = [...editor.querySelectorAll("math-div")].find(equation =>
        equation.parentElement !== editor && !(equation.parentElement.tagName === "LI" && equation.parentElement.childNodes.length === 1)
    );
    while(displayEquation){
        const range = document.createRange();
        range.setStartBefore(displayEquation);
        range.setEndAfter(displayEquation);
        projectEquationInsertDisplay(editor, range, displayEquation, false);
        displayEquation = [...editor.querySelectorAll("math-div")].find(equation =>
            equation.parentElement !== editor && !(equation.parentElement.tagName === "LI" && equation.parentElement.childNodes.length === 1)
        );
    }
}

function projectEquationEditableBlock(node, editor){
    let element = node && node.nodeType === Node.ELEMENT_NODE ? node : node && node.parentElement;
    while(element && element !== editor){
        if(element.matches("p, div, h1, h2, li")) return element;
        element = element.parentElement;
    }
    return null;
}

function projectEquationMakeEditableBlock(template, fragment){
    const block = template.cloneNode(false);
    block.appendChild(fragment);
    if(!block.hasChildNodes()) block.appendChild(document.createElement("br"));
    return block;
}

function projectEquationIsRootBlock(node){
    return node && node.nodeType === Node.ELEMENT_NODE && ["P", "DIV", "H1", "H2", "UL", "OL", "TABLE", "MATH-DIV"].includes(node.tagName);
}

function projectEquationHasEditableBlock(node){
    return node && node.nodeType === Node.ELEMENT_NODE && ["P", "DIV", "H1", "H2", "UL", "OL"].includes(node.tagName);
}

function projectEquationIsTextBlock(node){
    return node && node.nodeType === Node.ELEMENT_NODE && ["P", "DIV", "H1", "H2"].includes(node.tagName);
}

function projectEquationSetCaretAtStart(editor, block){
    editor.focus({ preventScroll:true });
    const range = document.createRange();
    range.selectNodeContents(block);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

function projectEquationInsertAtRootBoundary(editor, range, equation, moveCaret = true){
    const children = [...editor.childNodes];
    const offset = Math.max(0, Math.min(range.startOffset, children.length));
    let runStart = offset;
    let runEnd = offset;
    while(runStart > 0 && !projectEquationIsRootBlock(children[runStart - 1])) runStart--;
    while(runEnd < children.length && !projectEquationIsRootBlock(children[runEnd])) runEnd++;

    const beforeNodes = children.slice(runStart, offset);
    const afterNodes = children.slice(offset, runEnd);
    const previousBlock = children[runStart - 1] || null;
    const nextBlock = children[runEnd] || null;
    const beforeContent = document.createDocumentFragment();
    const afterContent = document.createDocumentFragment();
    beforeNodes.forEach(node => beforeContent.appendChild(node));
    afterNodes.forEach(node => afterContent.appendChild(node));

    const beforeBlock = beforeNodes.length || !projectEquationHasEditableBlock(previousBlock)
        ? projectEquationMakeEditableBlock(document.createElement("p"), beforeContent)
        : null;
    const afterBlock = afterNodes.length || !projectEquationIsTextBlock(nextBlock)
        ? projectEquationMakeEditableBlock(document.createElement("p"), afterContent)
        : null;

    if(beforeBlock) editor.insertBefore(beforeBlock, nextBlock);
    editor.insertBefore(equation, nextBlock);
    if(afterBlock) editor.insertBefore(afterBlock, nextBlock);
    if(moveCaret) projectEquationSetCaretAtStart(editor, afterBlock || nextBlock);
}

function projectEquationInsertDisplay(editor, range, equation, moveCaret = true){
    const insertionRange = range.cloneRange();
    insertionRange.deleteContents();
    const block = projectEquationEditableBlock(insertionRange.startContainer, editor);

    if(block){
        const beforeRange = document.createRange();
        beforeRange.selectNodeContents(block);
        beforeRange.setEnd(insertionRange.startContainer, insertionRange.startOffset);
        const afterRange = document.createRange();
        afterRange.selectNodeContents(block);
        afterRange.setStart(insertionRange.startContainer, insertionRange.startOffset);
        const beforeBlock = projectEquationMakeEditableBlock(block, beforeRange.cloneContents());
        const afterBlock = projectEquationMakeEditableBlock(block, afterRange.cloneContents());

        if(block.tagName === "LI"){
            const equationItem = block.cloneNode(false);
            equationItem.appendChild(equation);
            block.replaceWith(beforeBlock, equationItem, afterBlock);
        }else{
            block.replaceWith(beforeBlock, equation, afterBlock);
        }
        if(moveCaret) projectEquationSetCaretAtStart(editor, afterBlock);
        return;
    }

    const startElement = insertionRange.startContainer.nodeType === Node.ELEMENT_NODE
        ? insertionRange.startContainer
        : insertionRange.startContainer.parentElement;
    const containingCell = startElement && startElement.closest("td, th");
    if(containingCell && editor.contains(containingCell)){
        const beforeRange = document.createRange();
        beforeRange.selectNodeContents(containingCell);
        beforeRange.setEnd(insertionRange.startContainer, insertionRange.startOffset);
        const afterRange = document.createRange();
        afterRange.selectNodeContents(containingCell);
        afterRange.setStart(insertionRange.startContainer, insertionRange.startOffset);
        const beforeBlock = projectEquationMakeEditableBlock(document.createElement("p"), beforeRange.cloneContents());
        const afterBlock = projectEquationMakeEditableBlock(document.createElement("p"), afterRange.cloneContents());
        containingCell.replaceChildren(beforeBlock, equation, afterBlock);
        if(moveCaret) projectEquationSetCaretAtStart(editor, afterBlock);
        return;
    }

    if(insertionRange.startContainer === editor){
        projectEquationInsertAtRootBoundary(editor, insertionRange, equation, moveCaret);
        return;
    }

    let topLevel = insertionRange.startContainer.nodeType === Node.ELEMENT_NODE
        ? insertionRange.startContainer
        : insertionRange.startContainer.parentNode;
    while(topLevel && topLevel.parentNode !== editor) topLevel = topLevel.parentNode;
    if(topLevel && topLevel.parentNode === editor){
        const children = [...editor.childNodes];
        const childIndex = children.indexOf(topLevel);
        let runStart = childIndex;
        let runEnd = childIndex + 1;
        while(runStart > 0 && !projectEquationIsRootBlock(children[runStart - 1])) runStart--;
        while(runEnd < children.length && !projectEquationIsRootBlock(children[runEnd])) runEnd++;
        const first = children[runStart];
        const last = children[runEnd - 1];
        const beforeRange = document.createRange();
        beforeRange.setStartBefore(first);
        beforeRange.setEnd(insertionRange.startContainer, insertionRange.startOffset);
        const afterRange = document.createRange();
        afterRange.setStart(insertionRange.startContainer, insertionRange.startOffset);
        afterRange.setEndAfter(last);
        const beforeBlock = projectEquationMakeEditableBlock(document.createElement("p"), beforeRange.cloneContents());
        const afterBlock = projectEquationMakeEditableBlock(document.createElement("p"), afterRange.cloneContents());
        const nextBlock = children[runEnd] || null;
        children.slice(runStart, runEnd).forEach(node => node.remove());
        editor.insertBefore(beforeBlock, nextBlock);
        editor.insertBefore(equation, nextBlock);
        editor.insertBefore(afterBlock, nextBlock);
        if(moveCaret) projectEquationSetCaretAtStart(editor, afterBlock);
        return;
    }

    editor.append(equation);
    const afterBlock = projectEquationMakeEditableBlock(document.createElement("p"), document.createDocumentFragment());
    editor.append(afterBlock);
    if(moveCaret) projectEquationSetCaretAtStart(editor, afterBlock);
}

function projectEquationInsertInline(editor, range, equation){
    const insertionRange = range.cloneRange();
    insertionRange.deleteContents();
    insertionRange.insertNode(equation);
    insertionRange.setStartAfter(equation);
    insertionRange.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(insertionRange);
}

function projectEquationReplaceDisplayWithInline(editor, existingEquation, equation){
    if(existingEquation.parentElement !== editor){
        const range = document.createRange();
        range.setStartBefore(existingEquation);
        range.setEndAfter(existingEquation);
        projectEquationInsertInline(editor, range, equation);
        return;
    }

    let beforeBlock = existingEquation.previousElementSibling;
    let afterBlock = existingEquation.nextElementSibling;
    if(!projectEquationHasEditableBlock(beforeBlock)){
        beforeBlock = document.createElement("p");
        existingEquation.before(beforeBlock);
    }
    if(!projectEquationHasEditableBlock(afterBlock)){
        afterBlock = document.createElement("p");
        existingEquation.after(afterBlock);
    }
    existingEquation.remove();
    const range = document.createRange();
    range.selectNodeContents(afterBlock);
    range.collapse(true);
    projectEquationInsertInline(editor, range, equation);
}

function closeProjectEquationDialog(restorePosition = true){
    const state = projectEquationDialogState;
    if(!state) return;
    state.backdrop.remove();
    projectEquationDialogState = null;
    if(window.mathVirtualKeyboard){
        window.mathVirtualKeyboard.visible = false;
        if(state.previousKeyboardLayouts !== undefined) window.mathVirtualKeyboard.layouts = state.previousKeyboardLayouts;
    }
    document.body.classList.remove("project-equation-dialog-open");
    if(state.backgroundContainer && !state.backgroundWasInert) state.backgroundContainer.inert = false;
    if(!restorePosition || !state.editor.isConnected) return;
    if(state.existingEquation && state.existingEquation.isConnected){
        state.existingEquation.focus({ preventScroll: true });
        return;
    }
    state.editor.focus({ preventScroll: true });
    if(state.range && state.range.startContainer.isConnected){
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(state.range);
    }
}

function commitProjectEquationDialog(){
    const state = projectEquationDialogState;
    if(!state) return;
    const latex = state.mathField.value.trim();
    if(!latex){
        state.status.textContent = "Add an expression before inserting it.";
        state.mathField.focus();
        return;
    }
    const equation = createProjectEquationElement(latex, state.mode);
    equation.contentEditable = "false";
    equation.tabIndex = 0;
    equation.title = "Click to edit this equation";

    if(state.existingEquation && state.existingEquation.isConnected){
        if(state.mode === "display"){
            const range = document.createRange();
            range.setStartBefore(state.existingEquation);
            range.setEndAfter(state.existingEquation);
            projectEquationInsertDisplay(state.editor, range, equation);
        }else if(state.existingEquation.localName === "math-div"){
            projectEquationReplaceDisplayWithInline(state.editor, state.existingEquation, equation);
        }else{
            state.existingEquation.replaceWith(equation);
            const range = document.createRange();
            range.setStartAfter(equation);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }else{
        const range = state.range && state.range.startContainer.isConnected ? state.range : projectEquationSelectionRange(state.editor);
        if(state.mode === "display") projectEquationInsertDisplay(state.editor, range, equation);
        else projectEquationInsertInline(state.editor, range, equation);
    }

    setupProjectEquationEditorNodes(state.editor);
    state.editor.dispatchEvent(new Event("input", { bubbles: true }));
    closeProjectEquationDialog(false);
    state.editor.focus({ preventScroll: true });
}

function openProjectEquationDialog(editor, existingEquation = null){
    if(!window.MathfieldElement || !window.customElements.get("math-span") || !window.customElements.get("math-div")){
        showToast("The equation editor is not available. Reload the app and try again.", "error");
        return;
    }
    if(projectEquationDialogState) closeProjectEquationDialog(false);
    const initialLatex = existingEquation ? existingEquation.textContent : "";
    const mode = existingEquation && existingEquation.localName === "math-div" ? "display" : "inline";
    const backdrop = document.createElement("div");
    backdrop.className = "project-equation-dialog-backdrop";
    backdrop.innerHTML = `
        <section class="project-equation-dialog" role="dialog" aria-modal="true" aria-labelledby="projectEquationDialogTitle" tabindex="-1">
            <header class="project-equation-dialog-header">
                <div><p class="project-equation-eyebrow">VISUAL MATHEMATICS</p><h2 id="projectEquationDialogTitle">${existingEquation ? "Edit equation" : "Insert equation"}</h2></div>
                <button class="project-equation-close" type="button" data-equation-close aria-label="Close equation editor">×</button>
            </header>
            <div class="project-equation-mode" role="group" aria-label="Equation placement">
                <button type="button" data-equation-mode="inline" aria-pressed="${mode === "inline"}">Inline</button>
                <button type="button" data-equation-mode="display" aria-pressed="${mode === "display"}">Display line</button>
            </div>
            <label class="project-equation-label" for="projectEquationMathField">Build your expression</label>
            <math-field id="projectEquationMathField" class="project-equation-mathfield" smart-fence math-virtual-keyboard-policy="auto" placeholder="Choose a template or type an expression"></math-field>
            <section class="project-equation-preview-panel" aria-live="polite">
                <h3>Preview</h3><div id="projectEquationPreview" class="project-equation-preview"></div>
            </section>
            <section class="project-equation-palette-panel" aria-label="Templates and symbols">
                <div class="project-equation-category-tabs" role="tablist" aria-label="Mathematics categories">${PROJECT_EQUATION_PALETTES.map((category,index) => `<button type="button" role="tab" id="projectEquationTab-${category.id}" data-equation-category="${category.id}" aria-selected="${index === 0}" aria-controls="projectEquationPalette">${escapeProjectHtml(category.label)}</button>`).join("")}</div>
                <div id="projectEquationPalette" class="project-equation-palette" role="tabpanel" aria-labelledby="projectEquationTab-algebra"></div>
            </section>
            <p id="projectEquationStatus" class="project-equation-status" role="status" aria-live="polite"></p>
            <footer class="project-equation-dialog-actions">
                <button class="project-equation-cancel" type="button" data-equation-cancel>Cancel</button>
                <button class="project-equation-insert" type="button" data-equation-confirm>${existingEquation ? "Update equation" : "Insert equation"}</button>
            </footer>
        </section>`;
    document.body.appendChild(backdrop);
    document.body.classList.add("project-equation-dialog-open");

    const dialog = backdrop.querySelector(".project-equation-dialog");
    const mathField = backdrop.querySelector("#projectEquationMathField");
    const preview = backdrop.querySelector("#projectEquationPreview");
    const palette = backdrop.querySelector("#projectEquationPalette");
    const status = backdrop.querySelector("#projectEquationStatus");
    const selectionRange = existingEquation ? null : projectEquationSelectionRange(editor);
    const backgroundContainer = document.querySelector(".app-shell");
    const backgroundWasInert = Boolean(backgroundContainer && backgroundContainer.inert);
    const previousKeyboardLayouts = window.mathVirtualKeyboard ? window.mathVirtualKeyboard.layouts : undefined;
    if(backgroundContainer) backgroundContainer.inert = true;
    projectEquationDialogState = { backdrop, dialog, editor, existingEquation, range:selectionRange, mode, mathField, preview, palette, status, backgroundContainer, backgroundWasInert, previousKeyboardLayouts };
    mathField.value = initialLatex;
    if(window.mathVirtualKeyboard) window.mathVirtualKeyboard.layouts = ["numeric", "symbols", "alphabetic", "greek"];

    const refreshPreview = () => {
        preview.replaceChildren();
        const value = mathField.value.trim();
        if(!value){
            preview.textContent = "Your formatted equation will appear here.";
            return;
        }
        const previewEquation = createProjectEquationElement(value, projectEquationDialogState.mode);
        preview.appendChild(previewEquation);
    };
    const setCategory = categoryId => {
        const category = PROJECT_EQUATION_PALETTES.find(item => item.id === categoryId) || PROJECT_EQUATION_PALETTES[0];
        backdrop.querySelectorAll("[data-equation-category]").forEach(tab => {
            const selected = tab.dataset.equationCategory === category.id;
            tab.setAttribute("aria-selected", String(selected));
            tab.tabIndex = selected ? 0 : -1;
        });
        palette.setAttribute("aria-labelledby", `projectEquationTab-${category.id}`);
        palette.innerHTML = projectEquationPaletteMarkup(category.id);
    };
    mathField.addEventListener("input", refreshPreview);
    backdrop.querySelectorAll("[data-equation-mode]").forEach(button => button.addEventListener("click", () => {
        projectEquationDialogState.mode = button.dataset.equationMode;
        backdrop.querySelectorAll("[data-equation-mode]").forEach(option => option.setAttribute("aria-pressed", String(option === button)));
        refreshPreview();
        mathField.focus();
    }));
    backdrop.querySelector(".project-equation-category-tabs").addEventListener("click", event => {
        const tab = event.target.closest("[data-equation-category]");
        if(tab) setCategory(tab.dataset.equationCategory);
    });
    backdrop.querySelector(".project-equation-category-tabs").addEventListener("keydown", event => {
        const currentTab = event.target.closest("[data-equation-category]");
        if(!currentTab || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
        event.preventDefault();
        const tabs = [...backdrop.querySelectorAll("[data-equation-category]")];
        const index = tabs.indexOf(currentTab);
        const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
        setCategory(next.dataset.equationCategory);
        next.focus();
    });
    palette.addEventListener("mousedown", event => {
        if(event.target.closest("[data-equation-template], [data-equation-symbol]")) event.preventDefault();
    });
    palette.addEventListener("click", event => {
        const button = event.target.closest("[data-equation-template], [data-equation-symbol]");
        if(!button) return;
        mathField.focus();
        if(button.hasAttribute("data-equation-template")){
            mathField.executeCommand(["insert", button.dataset.equationTemplate, { selectionMode:"placeholder" }]);
        }else{
            const symbol = button.dataset.equationSymbol;
            mathField.insert(symbol, { selectionMode:symbol.includes("#?") ? "placeholder" : "after" });
        }
        refreshPreview();
    });
    backdrop.addEventListener("click", event => {
        if(event.target === backdrop || event.target.closest("[data-equation-close], [data-equation-cancel]")) closeProjectEquationDialog();
        else if(event.target.closest("[data-equation-confirm]")) commitProjectEquationDialog();
    });
    backdrop.addEventListener("keydown", event => {
        if(event.key === "Tab"){
            const focusable = [...dialog.querySelectorAll("button:not([disabled]), math-field, [tabindex]:not([tabindex='-1'])")];
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if(event.shiftKey && document.activeElement === first){
                event.preventDefault();
                last?.focus();
            }else if(!event.shiftKey && document.activeElement === last){
                event.preventDefault();
                first?.focus();
            }
        }
    });
    setCategory("algebra");
    refreshPreview();
    requestAnimationFrame(() => mathField.focus({ preventScroll:true }));
}

function renderProjectNoteContent(content, contentFormat){
    if(contentFormat === "html"){
        const safeHtml = sanitizeProjectNoteHtml(content);
        const contentProbe = document.createElement("div");
        contentProbe.innerHTML = safeHtml;
        if(!contentProbe.textContent.trim() && !contentProbe.querySelector("table, img")){
            return `<p class="project-note-empty-content">This note is empty. Choose Edit to start writing.</p>`;
        }
        return safeHtml;
    }
    const paragraphs = String(content || "").split(/\r?\n\s*\r?\n/).filter(paragraph => paragraph.trim());
    if(!paragraphs.length) return `<p class="project-note-empty-content">This note is empty. Choose Edit to start writing.</p>`;
    return paragraphs.map(paragraph => `<p>${escapeProjectHtml(paragraph).replace(/\r?\n/g, "<br>")}</p>`).join("");
}

function openProjectResourceForm(ownerType, ownerId, subjectId){
    const subject = projectSubjects().find(item => getProjectSubjectId(item, false) === subjectId);
    const topic = ownerType === "topic" ? projectTopicRecords.find(item => item.id === ownerId && item.subjectId === subjectId) : null;
    if(!subject || (ownerType === "topic" && !topic) || (ownerType !== "topic" && ownerType !== "subject") || (ownerType === "subject" && ownerId !== subjectId)) return;

    setProjectDialog("Add Resource", `
        <form class="project-dialog-form project-resource-form" novalidate>
            <label class="project-dialog-label" for="projectResourceName">Resource Name</label>
            <input id="projectResourceName" class="project-dialog-input" name="displayName" type="text" maxlength="120" autocomplete="off" placeholder="e.g. Thermodynamics reference" aria-describedby="projectResourceError">
            <input id="projectResourceFileInput" class="project-resource-file-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg">
            <div class="project-resource-file-controls">
                <button class="project-secondary-button project-resource-pick-button" type="button" data-resource-pick aria-label="Add File"><i class="fa-solid fa-paperclip" aria-hidden="true"></i> Add File</button>
                <span class="project-resource-file-name" data-resource-file-name>No file selected</span>
            </div>
            <p id="projectResourceError" class="project-dialog-error" data-project-resource-error role="status" aria-live="polite"></p>
            <div class="project-dialog-actions">
                <button class="project-secondary-button" type="button" data-project-dialog-cancel>Cancel</button>
                <button class="project-primary-button" type="submit" data-resource-save disabled>OK</button>
            </div>
        </form>
    `, "#projectResourceName", "resource");

    const form = projectDialogContent.querySelector("form");
    const nameInput = form.elements.displayName;
    const fileInput = form.querySelector("#projectResourceFileInput");
    const pickButton = form.querySelector("[data-resource-pick]");
    const fileNameLabel = form.querySelector("[data-resource-file-name]");
    const saveButton = form.querySelector("[data-resource-save]");
    const errorMessage = form.querySelector("[data-project-resource-error]");
    let selectedFile = null;
    let fileIsValid = false;

    const setResourceError = message => {
        errorMessage.textContent = message;
        errorMessage.classList.toggle("is-visible", Boolean(message));
        nameInput.removeAttribute("aria-invalid");
    };
    const updateSaveState = () => { saveButton.disabled = !(nameInput.value.trim() && fileIsValid); };
    nameInput.addEventListener("input", updateSaveState);
    pickButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
        selectedFile = fileInput.files?.[0] || null;
        fileInput.value = "";
        const extension = selectedFile?.name.split(".").pop()?.toLowerCase() || "";
        fileIsValid = Boolean(selectedFile && PROJECT_RESOURCE_EXTENSIONS.has(extension));
        fileNameLabel.textContent = fileIsValid ? selectedFile.name : "No file selected";
        fileNameLabel.title = fileIsValid ? selectedFile.name : "";
        setResourceError(selectedFile && !fileIsValid ? "Unsupported file type. Choose a PDF, Office document, or PNG/JPG image." : "");
        updateSaveState();
    });
    form.querySelector("[data-project-dialog-cancel]").addEventListener("click", closeProjectDialog);
    form.addEventListener("submit", event => {
        event.preventDefault();
        setResourceError("");
        if(saveButton.disabled || !selectedFile || !fileIsValid) return;
        const resource = {
            id: createProjectId(),
            displayName: nameInput.value.trim(),
            originalFilename: selectedFile.name,
            mimeType: selectedFile.type || "application/octet-stream",
            fileSize: selectedFile.size,
            subjectId,
            ownerType,
            ownerId,
            createdAt: new Date().toISOString(),
            file: selectedFile
        };
        saveButton.disabled = true;
        saveButton.textContent = "Saving…";
        saveProjectResource(resource).then(() => {
            closeProjectDialog();
            renderProjectWorkspace();
            showToast("Resource added successfully.", "success");
        }).catch(error => {
            setResourceError(error?.message || "The resource could not be saved. Check available storage and try again.");
            saveButton.textContent = "OK";
            updateSaveState();
        });
    });
}

function projectContentNoteItem(note){
    const actionsDisabled = projectNoteStorageReady ? "" : "disabled";
    return `<div class="project-content-note-row">
        <button class="project-content-note" type="button" data-project-note-open="${escapeProjectHtml(note.id)}">${projectItemIcon("note")}<span>${escapeProjectHtml(note.title)}</span><small>Note</small></button>
        <button class="project-topic-more project-note-more" type="button" data-note-menu-toggle="${escapeProjectHtml(note.id)}" aria-label="Actions for note: ${escapeProjectHtml(note.title)}" aria-haspopup="menu" aria-expanded="false"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button>
        <div class="project-note-menu hidden" role="menu">
            <button type="button" role="menuitem" data-note-action="rename" data-note-id="${escapeProjectHtml(note.id)}" ${actionsDisabled}>Rename</button>
            <button type="button" role="menuitem" data-note-action="move" data-note-id="${escapeProjectHtml(note.id)}" ${actionsDisabled}>Move…</button>
            <button type="button" role="menuitem" class="is-danger" data-note-action="delete" data-note-id="${escapeProjectHtml(note.id)}" ${actionsDisabled}>Delete</button>
        </div>
    </div>`;
}

function formatProjectResourceSize(size){
    if(size < 1024) return `${size} B`;
    if(size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function projectResourceContentItem(resource, index, resourceCount){
    const iconTypeLabels = { pdf: "PDF", excel: "Excel", word: "Word", powerpoint: "PowerPoint", image: "Image", unknown: "file" };
    const iconTypeLabel = iconTypeLabels[projectResourceIconType(resource.originalFilename)];
    return `<article class="project-content-resource" data-resource-name="${escapeProjectHtml(resource.displayName)}">
        <button class="project-content-resource-open" type="button" data-project-resource-open="${escapeProjectHtml(resource.id)}" aria-label="Open ${iconTypeLabel} resource: ${escapeProjectHtml(resource.displayName)}">
            ${projectItemIcon("file", { filename: resource.originalFilename })}
            <span><strong>${escapeProjectHtml(resource.displayName)}</strong><small>${escapeProjectHtml(resource.originalFilename)} · ${formatProjectResourceSize(resource.fileSize)}</small></span>
        </button>
        <button class="project-resource-menu-toggle" type="button" data-resource-menu-toggle="${escapeProjectHtml(resource.id)}" aria-label="Actions for resource: ${escapeProjectHtml(resource.displayName)}" aria-haspopup="menu" aria-expanded="false"><i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i></button>
        <div class="project-resource-menu hidden" role="menu">
            <button type="button" role="menuitem" data-resource-action="rename" data-resource-id="${escapeProjectHtml(resource.id)}">Rename</button>
            <button type="button" role="menuitem" data-resource-action="up" data-resource-id="${escapeProjectHtml(resource.id)}" ${index === 0 ? "disabled" : ""}>Move up</button>
            <button type="button" role="menuitem" data-resource-action="down" data-resource-id="${escapeProjectHtml(resource.id)}" ${index === resourceCount - 1 ? "disabled" : ""}>Move down</button>
            <button type="button" role="menuitem" class="is-danger" data-resource-action="delete" data-resource-id="${escapeProjectHtml(resource.id)}">Delete</button>
        </div>
    </article>`;
}

function revokeProjectResourceUrlWhenSafe(tab, objectUrl){
    let revoked = false;
    let poll = null;
    const revoke = () => {
        if(revoked) return;
        revoked = true;
        if(poll) clearInterval(poll);
        URL.revokeObjectURL(objectUrl);
    };
    const onLoaded = () => {
        let currentUrl = "";
        try{ currentUrl = tab.location.href; }catch(error){ currentUrl = "resource-document-loaded"; }
        if(!currentUrl || currentUrl === "about:blank") return;
        tab.removeEventListener("load", onLoaded);
        try{
            tab.addEventListener("pagehide", revoke, { once: true });
            tab.addEventListener("beforeunload", revoke, { once: true });
        }catch(error){ /* The tab may have moved to a browser-managed viewer. */ }
    };
    tab.addEventListener("load", onLoaded);
    poll = setInterval(() => {
        try{ if(tab.closed) revoke(); }catch(error){ revoke(); }
    }, 3000);
    return revoke;
}

function showProjectOfficeDownload(tab, resource, objectUrl){
    const doc = tab.document;
    doc.open();
    doc.write("<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Download resource</title></head><body></body></html>");
    doc.close();
    doc.body.style.cssText = "margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#0B1022;color:#F4F5FF;font:15px/1.6 Segoe UI,Arial,sans-serif";
    const panel = doc.createElement("main");
    panel.style.cssText = "width:min(100%,520px);padding:28px;border:1px solid rgba(173,190,255,.24);border-radius:14px;background:linear-gradient(145deg,#111A30,#17213B);box-shadow:0 20px 56px rgba(1,5,19,.45)";
    const heading = doc.createElement("h1");
    heading.textContent = `Open with ${projectOfficeAppName(resource.originalFilename)}`;
    heading.style.cssText = "margin:0 0 8px;font-size:21px";
    const description = doc.createElement("p");
    description.textContent = `Download the original file “${resource.originalFilename}”, then open it with ${projectOfficeAppName(resource.originalFilename)}.`;
    description.style.cssText = "margin:0 0 18px;color:#B8C4E8";
    const link = doc.createElement("a");
    link.href = objectUrl;
    link.download = resource.originalFilename;
    link.textContent = "Download original file";
    link.style.cssText = "display:inline-flex;align-items:center;min-height:42px;padding:0 16px;border:1px solid rgba(220,224,255,.24);border-radius:9px;color:#fff;background:linear-gradient(125deg,#365FE5,#7650D5);font-weight:600;text-decoration:none";
    panel.append(heading, description, link);
    doc.body.append(panel);
    return link;
}

function projectOfficeAppName(filename){
    const extension = filename.split(".").pop()?.toLowerCase();
    if(extension === "doc" || extension === "docx") return "Microsoft Word";
    if(extension === "xls" || extension === "xlsx") return "Microsoft Excel";
    return "Microsoft PowerPoint";
}

function openProjectResource(resourceId, owner){
    const tab = window.open("about:blank", "_blank");
    if(!tab){
        showToast("IRON MIND could not open a new tab. Allow pop-ups for this app and try again.", "error");
        return;
    }
    try{
        tab.document.title = "Opening resource";
        tab.document.body.textContent = "Loading saved resource…";
    }catch(error){ /* The browser may have restricted access to a new tab. */ }
    loadProjectResourceById(resourceId, owner).then(resource => {
        if(tab.closed) return;
        if(!(resource.file instanceof Blob)) throw new Error("The original file data is not available for this resource.");
        const objectUrl = URL.createObjectURL(resource.file);
        const revoke = revokeProjectResourceUrlWhenSafe(tab, objectUrl);
        const extension = resource.originalFilename.split(".").pop()?.toLowerCase();
        if(extension === "pdf" || ["png", "jpg", "jpeg"].includes(extension)){
            try{ tab.location.replace(objectUrl); }
            catch(error){ revoke(); throw new Error("The saved file could not be opened in a new tab."); }
            return;
        }
        const link = showProjectOfficeDownload(tab, resource, objectUrl);
        link.addEventListener("click", () => setTimeout(revoke, 60_000), { once: true });
    }).catch(error => {
        try{ if(!tab.closed) tab.close(); }catch(closeError){ /* The stored resource remains unchanged. */ }
        showToast(error?.message || "The saved resource could not be opened. The stored file is unchanged.", "error");
    });
}

function populateProjectResourceList(container, owner){
    if(!container) return;
    container.dataset.resourceSubjectId = owner.subjectId;
    container.dataset.resourceOwnerType = owner.ownerType;
    container.dataset.resourceOwnerId = owner.ownerId;
    loadProjectResources(owner.subjectId, owner.ownerType, owner.ownerId).then(resources => {
        if(!container.isConnected) return;
        container.innerHTML = resources.length
            ? resources.map((resource, index) => projectResourceContentItem(resource, index, resources.length)).join("")
            : `<p class="project-no-children">No resources yet.</p>`;
    }).catch(() => {
        if(container.isConnected) container.innerHTML = `<p class="project-resource-load-error">Saved resources could not be loaded from this device.</p>`;
    });
}

function projectResourceOwnerFromList(container){
    return {
        subjectId: container.dataset.resourceSubjectId,
        ownerType: container.dataset.resourceOwnerType,
        ownerId: container.dataset.resourceOwnerId
    };
}

function positionProjectResourceMenu(menu, toggle){
    menu.classList.remove("hidden");
    menu.style.visibility = "hidden";
    const bounds = toggle.getBoundingClientRect();
    const menuBounds = menu.getBoundingClientRect();
    const viewportPadding = 8;
    const top = window.innerHeight - bounds.bottom >= menuBounds.height + 8
        ? bounds.bottom + 4
        : bounds.top - menuBounds.height - 4;
    const left = Math.max(viewportPadding, Math.min(bounds.right - menuBounds.width, window.innerWidth - menuBounds.width - viewportPadding));
    menu.style.top = `${Math.max(viewportPadding, Math.min(top, window.innerHeight - menuBounds.height - viewportPadding))}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = "visible";
}

function openProjectResourceRenameForm(resourceId, owner, originalName){
    setProjectDialog("Rename Resource", `
        <form class="project-dialog-form project-resource-form" novalidate>
            <label class="project-dialog-label" for="projectResourceRename">Resource Name</label>
            <input id="projectResourceRename" class="project-dialog-input" name="displayName" type="text" maxlength="120" autocomplete="off" value="${escapeProjectHtml(originalName)}" aria-describedby="projectResourceRenameError">
            <p id="projectResourceRenameError" class="project-dialog-error" data-project-resource-rename-error role="status" aria-live="polite"></p>
            <div class="project-dialog-actions">
                <button class="project-secondary-button" type="button" data-project-dialog-cancel>Cancel</button>
                <button class="project-primary-button" type="submit" data-resource-rename-save>Save</button>
            </div>
        </form>
    `, "#projectResourceRename", "resource");
    const form = projectDialogContent.querySelector("form");
    const nameInput = form.elements.displayName;
    const errorMessage = form.querySelector("[data-project-resource-rename-error]");
    const saveButton = form.querySelector("[data-resource-rename-save]");
    form.querySelector("[data-project-dialog-cancel]").addEventListener("click", closeProjectDialog);
    form.addEventListener("submit", event => {
        event.preventDefault();
        const displayName = nameInput.value.trim();
        if(!displayName){
            errorMessage.textContent = "Enter a resource name to continue.";
            return;
        }
        errorMessage.textContent = "";
        saveButton.disabled = true;
        saveButton.textContent = "Saving…";
        renameProjectResource(resourceId, owner, displayName).then(() => {
            closeProjectDialog();
            renderProjectWorkspace();
            showToast("Resource renamed successfully.", "success");
        }).catch(error => {
            errorMessage.textContent = error?.message || "The resource name could not be saved. Try again.";
            saveButton.disabled = false;
            saveButton.textContent = "Save";
        });
    });
}

function handleProjectResourceAction(actionButton, owner){
    const resourceId = actionButton.dataset.resourceId;
    const action = actionButton.dataset.resourceAction;
    const row = actionButton.closest(".project-content-resource");
    const resourceName = row?.dataset.resourceName || "this resource";
    if(action === "rename"){
        actionButton.focus();
        openProjectResourceRenameForm(resourceId, owner, resourceName);
        actionButton.closest(".project-resource-menu")?.classList.add("hidden");
        actionButton.closest(".project-resource-menu")?.parentElement.querySelector("[data-resource-menu-toggle]")?.setAttribute("aria-expanded", "false");
        return;
    }
    if(action === "up" || action === "down"){
        actionButton.closest(".project-resource-menu")?.classList.add("hidden");
        actionButton.closest(".project-resource-menu")?.parentElement.querySelector("[data-resource-menu-toggle]")?.setAttribute("aria-expanded", "false");
        moveProjectResource(resourceId, owner, action === "up" ? -1 : 1).then(didMove => {
            if(!didMove) return;
            renderProjectWorkspace();
            showToast("Resource order updated.", "success");
        }).catch(error => showToast(error?.message || "Resource order could not be saved.", "error"));
        return;
    }
    if(action === "delete"){
        actionButton.focus();
        openProjectConfirm("Move resource to Recycle Bin?", `Move “${resourceName}” to Recycle Bin? Its original file stays stored until you permanently delete it or it expires.`, "Move to Recycle Bin", () => {
            moveProjectResourceToRecycleBin(resourceId, owner).then(() => {
                renderProjectWorkspace();
                showToast("Resource moved to Recycle Bin.", "success");
            }).catch(error => showToast(error?.message || "The resource could not be moved. It remains saved.", "error"));
        });
        actionButton.closest(".project-resource-menu")?.classList.add("hidden");
        actionButton.closest(".project-resource-menu")?.parentElement.querySelector("[data-resource-menu-toggle]")?.setAttribute("aria-expanded", "false");
    }
}

function projectNoteImageStorageAvailable(dataUrlLength){
    try{
        let storedCharacters = 0;
        for(let index = 0; index < workspaceStorage.length; index++){
            const key = workspaceStorage.key(index);
            if(key === null) continue;
            storedCharacters += key.length + (workspaceStorage.getItem(key) || "").length;
        }
        const estimatedBytes = (storedCharacters + dataUrlLength + 512) * 2;
        return estimatedBytes <= PROJECT_NOTE_STORAGE_SAFE_BYTES;
    }catch(error){
        return false;
    }
}

function setupProjectNoteImageTools(editor, insertButton, fileInput){
    let insertionRange = null;
    let selectedImage = null;
    let resizeState = null;
    let imageMoveState = null;
    const resizeDirections = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
    const resizeOverlay = document.createElement("div");
    const hostPage = editor.closest(".page");
    resizeOverlay.className = "project-note-image-resize-overlay";
    resizeOverlay.setAttribute("aria-label", "Image resize handles");
    resizeOverlay.hidden = true;
    resizeOverlay.innerHTML = resizeDirections.map(direction =>
        `<button class="project-note-image-resize-handle is-${direction}" type="button" data-image-resize="${direction}" aria-label="Resize image ${direction}"></button>`
    ).join("");
    document.body.appendChild(resizeOverlay);

    const updateOverlayPosition = () => {
        if(!selectedImage?.isConnected || (hostPage && hostPage.classList.contains("hidden"))){
            resizeOverlay.hidden = true;
            return;
        }
        const bounds = selectedImage.getBoundingClientRect();
        resizeOverlay.style.left = `${bounds.left}px`;
        resizeOverlay.style.top = `${bounds.top}px`;
        resizeOverlay.style.width = `${bounds.width}px`;
        resizeOverlay.style.height = `${bounds.height}px`;
        resizeOverlay.hidden = false;
    };

    const selectImage = image => {
        if(selectedImage && selectedImage !== image) selectedImage.removeAttribute("data-project-image-selected");
        selectedImage = image;
        selectedImage.setAttribute("data-project-image-selected", "true");
        editor.focus({ preventScroll:true });
        const range = document.createRange();
        range.selectNode(selectedImage);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        updateOverlayPosition();
    };

    const clearImageSelection = () => {
        selectedImage?.removeAttribute("data-project-image-selected");
        selectedImage = null;
        resizeOverlay.hidden = true;
    };

    const getImageContainerWidth = image => {
        const element = image?.nodeType === Node.ELEMENT_NODE ? image : image?.parentElement;
        const container = element?.closest("td, th") || editor;
        const style = getComputedStyle(container);
        return Math.max(1, container.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
    };

    const safeImageHtml = image => {
        const copy = image.cloneNode(true);
        copy.removeAttribute("data-project-image-selected");
        return copy.outerHTML;
    };

    const findReplacementImage = (parent, previousSibling, nextSibling) => {
        if(!parent?.isConnected) return null;
        let node = previousSibling?.parentNode === parent ? previousSibling.nextSibling : parent.firstChild;
        while(node && node !== nextSibling){
            if(node.nodeType === Node.ELEMENT_NODE){
                if(node.tagName === "IMG") return node;
                const nestedImage = node.querySelector("img");
                if(nestedImage) return nestedImage;
            }
            node = node.nextSibling;
        }
        return null;
    };

    const commitImageResize = (image, beforeHtml, afterHtml, finalWidth) => {
        const parent = image.parentNode;
        const previousSibling = image.previousSibling;
        const nextSibling = image.nextSibling;
        const originalHost = document.createElement("div");
        originalHost.innerHTML = beforeHtml;
        const originalImage = originalHost.firstElementChild;
        if(!originalImage || originalImage.tagName !== "IMG") return image;
        image.replaceWith(originalImage);

        const range = document.createRange();
        range.selectNode(originalImage);
        const selection = window.getSelection();
        editor.focus({ preventScroll:true });
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand("insertHTML", false, afterHtml);
        let resizedImage = findReplacementImage(parent, previousSibling, nextSibling);

        if(!resizedImage && originalImage.isConnected){
            const fallbackHost = document.createElement("div");
            fallbackHost.innerHTML = afterHtml;
            const fallbackImage = fallbackHost.firstElementChild;
            if(fallbackImage){
                originalImage.replaceWith(fallbackImage);
                resizedImage = fallbackImage;
                resizedImage.style.width = `${Math.round(finalWidth)}px`;
            }
        }
        if(resizedImage){
            selectImage(resizedImage);
            editor.dispatchEvent(new Event("input", { bubbles:true }));
        }
        return resizedImage;
    };

    const serializeImageMoveNodes = (nodes, image) => nodes.map(node => {
        if(node.nodeType === Node.TEXT_NODE) return escapeProjectHtml(node.nodeValue || "");
        if(node.nodeType !== Node.ELEMENT_NODE) return "";
        const container = document.createElement("div");
        container.appendChild(node.cloneNode(true));
        let safeHtml = sanitizeProjectNoteHtml(container.innerHTML);
        if(node === image) safeHtml = safeHtml.replace(/^<img(?=[\s>])/, '<img data-project-image-move-result="true"');
        return safeHtml;
    }).join("");

    const finishImageMove = confirmMove => {
        const state = imageMoveState;
        if(!state) return false;
        imageMoveState = null;
        const { image, parent, originalNodes, originalStyle } = state;
        if(!image.isConnected || !editor.contains(image) || !parent.isConnected){
            image.removeAttribute("data-project-image-moving");
            return false;
        }

        const currentNodes = [...parent.childNodes];
        let start = 0;
        while(start < originalNodes.length && start < currentNodes.length && originalNodes[start] === currentNodes[start]) start++;
        let end = originalNodes.length - 1;
        while(end >= start && end < currentNodes.length && originalNodes[end] === currentNodes[end]) end--;
        if(start > end){
            start = originalNodes.indexOf(image);
            end = start;
        }

        const shouldCommit = confirmMove && state.changed;
        const finalHtml = shouldCommit ? serializeImageMoveNodes(currentNodes.slice(start, end + 1), image) : "";
        parent.replaceChildren(...originalNodes);
        if(originalStyle === null) image.removeAttribute("style");
        else image.setAttribute("style", originalStyle);
        image.removeAttribute("data-project-image-moving");

        if(shouldCommit && start >= 0 && end >= start){
            const affectedNodes = originalNodes.slice(start, end + 1);
            if(affectedNodes.length){
                const range = document.createRange();
                range.setStartBefore(affectedNodes[0]);
                range.setEndAfter(affectedNodes[affectedNodes.length - 1]);
                const selection = window.getSelection();
                editor.focus({ preventScroll:true });
                selection?.removeAllRanges();
                selection?.addRange(range);
                const nativeEdit = document.execCommand("insertHTML", false, finalHtml);
                let moveResult = editor.querySelector('[data-project-image-move-result="true"]');
                let movedImage = moveResult?.matches("img") ? moveResult : moveResult?.querySelector("img");

                if(!movedImage && !nativeEdit){
                    const fallbackRange = document.createRange();
                    fallbackRange.setStartBefore(affectedNodes[0]);
                    fallbackRange.setEndAfter(affectedNodes[affectedNodes.length - 1]);
                    fallbackRange.deleteContents();
                    const fragmentHost = document.createElement("div");
                    fragmentHost.innerHTML = finalHtml;
                    const fragment = document.createDocumentFragment();
                    while(fragmentHost.firstChild) fragment.appendChild(fragmentHost.firstChild);
                    fallbackRange.insertNode(fragment);
                    moveResult = editor.querySelector('[data-project-image-move-result="true"]');
                    movedImage = moveResult?.matches("img") ? moveResult : moveResult?.querySelector("img");
                }

                if(movedImage){
                    movedImage.removeAttribute("data-project-image-move-result");
                    selectImage(movedImage);
                }
                editor.dispatchEvent(new Event("input", { bubbles:true }));
            }
        }else{
            selectImage(image);
            editor.dispatchEvent(new Event("input", { bubbles:true }));
        }
        return true;
    };

    const moveImagePreview = (state, key) => {
        const { image, parent } = state;
        if(!image.isConnected || image.parentNode !== parent) return false;
        if(key === "ArrowUp" || key === "ArrowDown"){
            if(!projectNoteMoveNodeVertically(parent, image, key)) return false;
        }else if(key === "ArrowLeft" || key === "ArrowRight"){
            const style = getComputedStyle(image);
            const availableWidth = getImageContainerWidth(image);
            const imageWidth = image.getBoundingClientRect().width;
            const floatSide = image.style.float || style.float || "left";
            const marginLeft = Math.max(0, parseFloat(image.style.marginLeft || style.marginLeft) || 0);
            const marginRight = Math.max(0, parseFloat(image.style.marginRight || style.marginRight) || 0);
            if(floatSide === "right"){
                const maximumOffset = Math.max(0, availableWidth - imageWidth - marginLeft);
                const currentOffset = Math.min(maximumOffset, marginRight);
                const direction = key === "ArrowLeft" ? 1 : -1;
                const nextOffset = Math.min(maximumOffset, Math.max(0, currentOffset + direction * 12));
                if(nextOffset === currentOffset) return false;
                image.style.float = "right";
                image.style.marginRight = `${nextOffset}px`;
            }else{
                const maximumOffset = Math.max(0, availableWidth - imageWidth - marginRight);
                const currentOffset = Math.min(maximumOffset, marginLeft);
                const direction = key === "ArrowRight" ? 1 : -1;
                const nextOffset = Math.min(maximumOffset, Math.max(0, currentOffset + direction * 12));
                if(nextOffset === currentOffset) return false;
                image.style.float = "left";
                image.style.marginLeft = `${nextOffset}px`;
            }
        }else{
            return false;
        }
        state.changed = true;
        selectImage(image);
        return true;
    };

    const cancelImageMoveForExternalInteraction = event => {
        if(imageMoveState && !editor.contains(event.target) && !resizeOverlay.contains(event.target)) finishImageMove(false);
    };

    const insertImageData = (dataUrl, alt, range) => {
        if(!/^data:image\/(?:png|jpeg|webp|gif|bmp);base64,[a-z0-9+/]+={0,2}$/i.test(dataUrl)){
            showToast("This image format is not supported.", "error");
            return false;
        }
        if(!range?.startContainer?.isConnected || !editor.contains(range.commonAncestorContainer)){
            showToast("The insertion point is no longer available. Place the cursor and try again.", "error");
            return false;
        }
        if(!projectNoteImageStorageAvailable(dataUrl.length)){
            showToast("There is not enough local storage space for this image. Try a smaller image.", "error");
            return false;
        }
        clearImageSelection();
        const image = document.createElement("img");
        image.src = dataUrl;
        image.alt = alt || "Study note image";
        image.style.width = `${Math.min(230, Math.max(1, getImageContainerWidth(range.startContainer) - 14))}px`;
        image.style.maxWidth = "100%";
        image.style.height = "auto";
        image.style.float = "left";
        image.style.margin = "0px 14px 12px 0px";

        const beforeHtml = editor.innerHTML;
        const selection = window.getSelection();
        editor.focus({ preventScroll:true });
        selection?.removeAllRanges();
        selection?.addRange(range);
        const nativeInsert = document.execCommand("insertHTML", false, image.outerHTML);
        if(!nativeInsert && editor.innerHTML === beforeHtml){
            const fallbackRange = range.cloneRange();
            fallbackRange.deleteContents();
            fallbackRange.insertNode(image);
            const caret = document.createRange();
            caret.setStartAfter(image);
            caret.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(caret);
            showToast("The image was inserted, but this browser may not include it in Undo history.", "info");
        }
        editor.dispatchEvent(new Event("input", { bubbles:true }));
        return true;
    };

    const insertImageFile = (file, range) => {
        if(!file) return;
        const extension = String(file.name || "").split(".").pop().toLowerCase();
        let mimeType = String(file.type || "").toLowerCase();
        if(mimeType === "image/jpg" || mimeType === "image/pjpeg") mimeType = "image/jpeg";
        const supportedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];
        if(!supportedMimeTypes.includes(mimeType) && !mimeType){
            const extensionMimeTypes = {
                jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp", gif:"image/gif", bmp:"image/bmp"
            };
            mimeType = extensionMimeTypes[extension] || "";
        }
        if(!supportedMimeTypes.includes(mimeType)){
            showToast("Choose a JPG, JPEG, or PNG image.", "error");
            return;
        }
        if(!file.size || file.size > PROJECT_NOTE_IMAGE_MAX_BYTES){
            showToast("Images must be 512 KB or smaller to fit safely in local storage.", "error");
            return;
        }
        const estimatedDataUrlLength = 32 + (4 * Math.ceil(file.size / 3));
        if(!projectNoteImageStorageAvailable(estimatedDataUrlLength)){
            showToast("There is not enough local storage space for this image. Try a smaller image.", "error");
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => showToast("The selected image could not be read.", "error");
        reader.onload = () => {
            const dataUrl = String(reader.result || "");
            const imageProbe = new Image();
            imageProbe.onerror = () => showToast("The selected file is not a readable image.", "error");
            imageProbe.onload = () => {
                if(imageProbe.naturalWidth * imageProbe.naturalHeight > 25000000){
                    showToast("This image has too many pixels to store safely in a note.", "error");
                    return;
                }
                const label = file.name ? file.name.split(/[\\/]/).pop() : "Pasted image";
                insertImageData(dataUrl, label, range);
            };
            imageProbe.src = dataUrl;
        };
        reader.readAsDataURL(file.slice(0, file.size, mimeType));
    };

    const onInsertButtonClick = () => {
        insertionRange = projectEquationSelectionRange(editor);
        fileInput.value = "";
        fileInput.click();
    };
    const onFileChange = () => {
        const file = fileInput.files?.[0];
        const range = insertionRange;
        insertionRange = null;
        insertImageFile(file, range);
    };
    const onPaste = event => {
        const clipboard = event.clipboardData;
        const imageItem = [...(clipboard?.items || [])].find(item => item.type.toLowerCase().startsWith("image/"));
        const file = imageItem?.getAsFile() || [...(clipboard?.files || [])].find(item => item.type.toLowerCase().startsWith("image/"));
        if(!file) return;
        event.preventDefault();
        insertImageFile(file, projectEquationSelectionRange(editor));
    };

    const onEditorClick = event => {
        const target = event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement;
        const image = target?.closest("img");
        if(imageMoveState && image !== imageMoveState.image) finishImageMove(false);
        if(image && editor.contains(image)) selectImage(image);
        else if(!resizeOverlay.contains(event.target)) clearImageSelection();
    };

    const onEditorKeyDown = event => {
        const isArrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key);
        if(imageMoveState){
            if((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())){
                finishImageMove(false);
                return;
            }
            if(isArrow){
                event.preventDefault();
                event.stopImmediatePropagation();
                moveImagePreview(imageMoveState, event.key);
                return;
            }
            if(event.key === "Enter"){
                event.preventDefault();
                event.stopImmediatePropagation();
                finishImageMove(true);
                return;
            }
            if(event.key === "Escape"){
                event.preventDefault();
                event.stopImmediatePropagation();
                finishImageMove(false);
                return;
            }
            if(!["Shift", "Control", "Alt", "Meta"].includes(event.key)){
                event.preventDefault();
                event.stopImmediatePropagation();
            }
            return;
        }

        if(!isArrow || !selectedImage || !editor.contains(selectedImage)) return;
        if(typeof projectNoteTableMoveModes !== "undefined" && projectNoteTableMoveModes.has(editor)) return;
        const selection = window.getSelection();
        const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        if(!projectNoteRangeSelectsNode(range, selectedImage)) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        imageMoveState = {
            image:selectedImage,
            parent:selectedImage.parentNode,
            originalNodes:[...selectedImage.parentNode.childNodes],
            originalStyle:selectedImage.getAttribute("style"),
            changed:false
        };
        selectedImage.setAttribute("data-project-image-moving", "true");
        showToast("Use the arrow keys to move the image. Enter confirms; Escape cancels.");
        moveImagePreview(imageMoveState, event.key);
    };

    const onEditorInput = () => {
        if(selectedImage && !selectedImage.isConnected) clearImageSelection();
        else if(selectedImage) updateOverlayPosition();
    };

    const onHandlePointerDown = event => {
        const handle = event.target.closest("[data-image-resize]");
        if(!handle || !selectedImage) return;
        if(imageMoveState) finishImageMove(false);
        event.preventDefault();
        event.stopPropagation();
        const bounds = selectedImage.getBoundingClientRect();
        const ratio = selectedImage.naturalWidth && selectedImage.naturalHeight
            ? selectedImage.naturalHeight / selectedImage.naturalWidth
            : bounds.height / Math.max(1, bounds.width);
        const imageStyle = getComputedStyle(selectedImage);
        const marginLeft = parseFloat(imageStyle.marginLeft) || 0;
        const marginRight = parseFloat(imageStyle.marginRight) || 0;
        const maxWidth = Math.max(1, getImageContainerWidth(selectedImage) - marginLeft - marginRight);
        resizeState = {
            image:selectedImage,
            beforeHtml:safeImageHtml(selectedImage),
            direction:handle.dataset.imageResize,
            startX:event.clientX,
            startY:event.clientY,
            startWidth:bounds.width,
            ratio,
            maxWidth,
            minWidth:Math.min(72, maxWidth)
        };
        handle.setPointerCapture?.(event.pointerId);
    };

    const onResizePointerMove = event => {
        if(!resizeState) return;
        event.preventDefault();
        const { direction, startX, startY, startWidth, ratio, maxWidth, minWidth, image } = resizeState;
        const horizontalDelta = direction.includes("e") ? event.clientX - startX : direction.includes("w") ? startX - event.clientX : 0;
        const verticalDelta = direction.includes("s") ? event.clientY - startY : direction.includes("n") ? startY - event.clientY : 0;
        let widthDelta;
        if(direction.includes("e") || direction.includes("w")){
            widthDelta = direction.includes("n") || direction.includes("s")
                ? (Math.abs(horizontalDelta) >= Math.abs(verticalDelta * ratio) ? horizontalDelta : verticalDelta * ratio)
                : horizontalDelta;
        }else{
            widthDelta = verticalDelta * ratio;
        }
        const width = Math.max(minWidth, Math.min(maxWidth, startWidth + widthDelta));
        image.style.width = `${Math.round(width)}px`;
        image.style.height = "auto";
        updateOverlayPosition();
    };

    const onResizePointerUp = () => {
        if(!resizeState) return;
        const state = resizeState;
        resizeState = null;
        const afterHtml = safeImageHtml(state.image);
        if(afterHtml !== state.beforeHtml){
            const finalWidth = state.image.getBoundingClientRect().width;
            const updated = commitImageResize(state.image, state.beforeHtml, afterHtml, finalWidth);
            if(updated) selectImage(updated);
        }
    };

    insertButton.addEventListener("click", onInsertButtonClick);
    fileInput.addEventListener("change", onFileChange);
    editor.addEventListener("paste", onPaste);
    editor.addEventListener("click", onEditorClick);
    editor.addEventListener("keydown", onEditorKeyDown);
    editor.addEventListener("input", onEditorInput);
    editor.addEventListener("scroll", updateOverlayPosition);
    window.addEventListener("resize", updateOverlayPosition);
    const pageObserver = hostPage ? new MutationObserver(updateOverlayPosition) : null;
    pageObserver?.observe(hostPage, { attributes:true, attributeFilter:["class"] });
    resizeOverlay.addEventListener("pointerdown", onHandlePointerDown);
    window.addEventListener("pointermove", onResizePointerMove);
    window.addEventListener("pointerup", onResizePointerUp);
    window.addEventListener("pointercancel", onResizePointerUp);
    document.addEventListener("pointerdown", cancelImageMoveForExternalInteraction, true);

    return () => {
        if(imageMoveState) finishImageMove(false);
        if(resizeState) onResizePointerUp();
        clearImageSelection();
        insertButton.removeEventListener("click", onInsertButtonClick);
        fileInput.removeEventListener("change", onFileChange);
        editor.removeEventListener("paste", onPaste);
        editor.removeEventListener("click", onEditorClick);
        editor.removeEventListener("keydown", onEditorKeyDown);
        editor.removeEventListener("input", onEditorInput);
        editor.removeEventListener("scroll", updateOverlayPosition);
        window.removeEventListener("resize", updateOverlayPosition);
        pageObserver?.disconnect();
        resizeOverlay.removeEventListener("pointerdown", onHandlePointerDown);
        window.removeEventListener("pointermove", onResizePointerMove);
        window.removeEventListener("pointerup", onResizePointerUp);
        window.removeEventListener("pointercancel", onResizePointerUp);
        document.removeEventListener("pointerdown", cancelImageMoveForExternalInteraction, true);
        resizeOverlay.remove();
    };
}

function projectNoteCreateTableCell(){
    const cell = document.createElement("td");
    cell.appendChild(document.createElement("br"));
    return cell;
}

function projectNoteCreateTableRow(columnCount){
    const row = document.createElement("tr");
    for(let index = 0; index < columnCount; index++) row.appendChild(projectNoteCreateTableCell());
    return row;
}

function projectNoteCreateTable(rowCount, columnCount){
    const table = document.createElement("table");
    table.style.width = "50%";
    table.style.float = "left";
    table.style.marginLeft = "0px";
    table.style.marginRight = "12px";
    const body = document.createElement("tbody");
    for(let index = 0; index < rowCount; index++) body.appendChild(projectNoteCreateTableRow(columnCount));
    table.appendChild(body);
    return table;
}

function projectNoteGetColumnWidths(table){
    const columnCount = Math.max(1, ...[...table.rows].map(row => row.cells.length));
    const group = [...table.children].find(child => child.tagName === "COLGROUP");
    const savedWidths = group && group.children.length === columnCount ? [...group.children].map(column => {
        const match = column.style.width.match(/^(\d+(?:\.\d+)?)%$/);
        return match ? Number(match[1]) : 0;
    }) : [];
    const savedTotal = savedWidths.reduce((total, value) => total + value, 0);
    if(savedTotal > 0){
        return savedWidths.map(value => value > 0 ? value * 100 / savedTotal : 0);
    }

    const firstRow = table.rows[0];
    const measuredWidths = Array.from({length:columnCount}, (_, index) => firstRow?.cells[index]?.getBoundingClientRect().width || 0);
    const measuredTotal = measuredWidths.reduce((total, value) => total + value, 0);
    if(measuredTotal > 0) return measuredWidths.map(value => value * 100 / measuredTotal);
    return Array.from({length:columnCount}, () => 100 / columnCount);
}

function projectNoteSetColumnWidths(table, widths){
    const normalized = widths.map(width => Math.max(1, Number(width) || 0));
    const total = normalized.reduce((sum, width) => sum + width, 0);
    let group = [...table.children].find(child => child.tagName === "COLGROUP");
    if(!group){
        group = document.createElement("colgroup");
        table.insertBefore(group, table.firstElementChild);
    }
    while(group.children.length < normalized.length) group.appendChild(document.createElement("col"));
    while(group.children.length > normalized.length) group.lastElementChild.remove();
    normalized.forEach((width, index) => {
        group.children[index].style.width = `${(width * 100 / total).toFixed(3)}%`;
    });
}

function projectNoteFindCell(editor, node){
    const element = node && node.nodeType === Node.ELEMENT_NODE ? node : node && node.parentElement;
    const cell = element && element.closest("td, th");
    return cell && editor.contains(cell) ? cell : null;
}

function projectNoteFocusCell(editor, cell){
    if(!cell || !cell.isConnected) return;
    editor.focus({ preventScroll:true });
    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

function projectNoteSelectedCells(editor, range, table, fallbackCell){
    if(range.collapsed) return fallbackCell ? [fallbackCell] : [];
    const selected = [...table.querySelectorAll("td, th")].filter(cell => {
        if(cell.closest("table") !== table) return false;
        try{
            return range.intersectsNode(cell);
        }catch(error){
            return false;
        }
    });
    return selected.length ? selected : (fallbackCell ? [fallbackCell] : []);
}

function projectNoteSetHeadingCells(editor, cells, isHeading){
    const updatedCells = [];
    cells.forEach(cell => {
        if(!cell.isConnected || !editor.contains(cell)) return;
        const targetTag = isHeading ? "TH" : "TD";
        if(cell.tagName === targetTag){
            updatedCells.push(cell);
            return;
        }
        const replacement = document.createElement(targetTag.toLowerCase());
        while(cell.firstChild) replacement.appendChild(cell.firstChild);
        cell.replaceWith(replacement);
        updatedCells.push(replacement);
    });
    if(updatedCells[0]) projectNoteFocusCell(editor, updatedCells[0]);
    return updatedCells.length > 0;
}

function setupProjectNoteTableResizing(editor){
    let resizeState = null;
    let hoverTarget = null;

    const clearHover = () => {
        if(hoverTarget){
            hoverTarget.removeAttribute("data-project-resize-hover");
            hoverTarget = null;
        }
    };

    editor.addEventListener("pointermove", event => {
        if(resizeState){
            event.preventDefault();
            const deltaX = event.clientX - resizeState.startX;
            const deltaY = event.clientY - resizeState.startY;
            if(resizeState.type === "table"){
                const width = Math.max(Math.min(180, resizeState.availableWidth), Math.min(resizeState.availableWidth, resizeState.startWidth + deltaX));
                resizeState.table.style.width = `${(width / resizeState.availableWidth * 100).toFixed(2)}%`;
            }else if(resizeState.type === "column"){
                const widths = [...resizeState.startWidths];
                const leftIndex = resizeState.columnIndex;
                const rightIndex = leftIndex + 1;
                const maxDelta = widths[rightIndex] - 40;
                const minDelta = 40 - widths[leftIndex];
                const adjustedDelta = Math.max(minDelta, Math.min(maxDelta, deltaX));
                widths[leftIndex] += adjustedDelta;
                widths[rightIndex] -= adjustedDelta;
                projectNoteSetColumnWidths(resizeState.table, widths);
            }else if(resizeState.type === "row"){
                const height = Math.max(30, resizeState.startHeight + deltaY);
                resizeState.row.style.height = `${Math.round(height)}px`;
            }
            return;
        }
        if(event.pointerType !== "mouse") return;

        clearHover();
        const cell = event.target.closest("td, th");
        if(!cell || !editor.contains(cell)) return;
        const table = cell.closest("table");
        const row = cell.closest("tr");
        if(!table || !row) return;
        const rect = cell.getBoundingClientRect();
        const nearRight = Math.abs(event.clientX - rect.right) <= 6;
        const nearLeft = Math.abs(event.clientX - rect.left) <= 6;
        const nearBottom = Math.abs(event.clientY - rect.bottom) <= 6;
        const lastColumn = cell.cellIndex === row.cells.length - 1;
        let handle = "";
        if(nearRight && lastColumn) handle = "table";
        else if(nearRight && cell.cellIndex < row.cells.length - 1) handle = "column-right";
        else if(nearLeft && cell.cellIndex > 0) handle = "column-left";
        else if(nearBottom) handle = "row";
        if(!handle) return;
        cell.dataset.projectResizeHover = handle;
        hoverTarget = cell;
    });

    editor.addEventListener("pointerdown", event => {
        if(event.button !== 0) return;
        const cell = event.target.closest("td, th");
        if(!cell || !editor.contains(cell)) return;
        const table = cell.closest("table");
        const row = cell.closest("tr");
        if(!table || !row) return;
        const rect = cell.getBoundingClientRect();
        const edgeTolerance = event.pointerType === "touch" ? 12 : 6;
        const nearRight = Math.abs(event.clientX - rect.right) <= edgeTolerance;
        const nearLeft = Math.abs(event.clientX - rect.left) <= edgeTolerance;
        const nearBottom = Math.abs(event.clientY - rect.bottom) <= edgeTolerance;
        const lastColumn = cell.cellIndex === row.cells.length - 1;
        let type = "";
        let columnIndex = cell.cellIndex;
        if(nearRight && lastColumn) type = "table";
        else if(nearRight && cell.cellIndex < row.cells.length - 1) type = "column";
        else if(nearLeft && cell.cellIndex > 0){
            type = "column";
            columnIndex = cell.cellIndex - 1;
        }else if(nearBottom) type = "row";
        if(!type) return;

        event.preventDefault();
        clearHover();
        const tableRect = table.getBoundingClientRect();
        const parent = table.parentElement;
        const computed = getComputedStyle(parent);
        const parentContentWidth = Math.max(1, parent.clientWidth - parseFloat(computed.paddingLeft || 0) - parseFloat(computed.paddingRight || 0));
        const availableWidth = parentContentWidth;
        resizeState = { type, table, startX:event.clientX, startY:event.clientY, availableWidth, startWidth:tableRect.width };
        if(type === "column"){
            resizeState.columnIndex = columnIndex;
            resizeState.startWidths = projectNoteGetColumnWidths(table).map(width => width * tableRect.width / 100);
        }else if(type === "row"){
            resizeState.row = row;
            resizeState.startHeight = row.getBoundingClientRect().height;
        }
        editor.classList.add("project-note-table-resizing");
        editor.setPointerCapture(event.pointerId);
    });

    const finishResize = event => {
        if(!resizeState) return;
        const changedTable = resizeState.table;
        resizeState = null;
        editor.classList.remove("project-note-table-resizing");
        try{
            if(editor.hasPointerCapture(event.pointerId)) editor.releasePointerCapture(event.pointerId);
        }catch(error){
            // The browser may already have released capture after pointer cancellation.
        }
        editor.dispatchEvent(new Event("input", { bubbles:true }));
        if(changedTable.isConnected) editor.dispatchEvent(new CustomEvent("project-note-table-resized", { detail:{ table:changedTable } }));
    };
    editor.addEventListener("pointerup", finishResize);
    editor.addEventListener("pointercancel", finishResize);
    editor.addEventListener("pointerleave", clearHover);
}

function projectNoteInsertTable(editor){
    const range = projectEquationSelectionRange(editor);
    openProjectForm("Insert table", "Choose the number of rows and columns to add at your cursor.", `
        <div class="project-note-table-size-fields">
            <label class="project-dialog-label" for="projectNoteTableRows">Rows</label>
            <input id="projectNoteTableRows" class="project-dialog-input" name="rows" type="number" min="1" max="20" value="3" required>
            <label class="project-dialog-label" for="projectNoteTableColumns">Columns</label>
            <input id="projectNoteTableColumns" class="project-dialog-input" name="columns" type="number" min="1" max="12" value="3" required>
        </div>`, "Insert table", form => {
        const rows = Number(form.elements.rows.value);
        const columns = Number(form.elements.columns.value);
        if(!Number.isInteger(rows) || rows < 1 || rows > 20 || !Number.isInteger(columns) || columns < 1 || columns > 12){
            setProjectDialogError("Choose 1–20 rows and 1–12 columns.");
            return false;
        }
        if(!range.startContainer.isConnected || !editor.contains(range.commonAncestorContainer)){
            setProjectDialogError("The insertion point is no longer available. Place the cursor in the note and try again.");
            return false;
        }
        const table = projectNoteCreateTable(rows, columns);
        const selection = window.getSelection();
        editor.focus({ preventScroll:true });
        selection?.removeAllRanges();
        selection?.addRange(range);
        if(!document.execCommand("insertHTML", false, table.outerHTML)){
            projectEquationInsertDisplay(editor, range, table);
        }
        editor.dispatchEvent(new Event("input", { bubbles:true }));
        return true;
    }, "#projectNoteTableRows");
}

function projectNoteApplyTableAction(editor, table, cell, action, selectedCells = [cell]){
    if(!editor.contains(table) || !table.contains(cell)) return false;
    const selectedRow = cell.closest("tr");
    const rows = [...table.rows];
    const columnCount = Math.max(1, ...rows.map(row => row.cells.length));
    let focusTarget = cell;

    if(action === "heading-set" || action === "heading-clear"){
        const validCells = selectedCells.filter(selectedCell => editor.contains(selectedCell) && table.contains(selectedCell));
        if(!projectNoteSetHeadingCells(editor, validCells, action === "heading-set")) return false;
        return true;
    }else if(action === "row-above" || action === "row-below"){
        const newRow = projectNoteCreateTableRow(columnCount);
        selectedRow.parentElement.insertBefore(newRow, action === "row-above" ? selectedRow : selectedRow.nextSibling);
        focusTarget = newRow.cells[Math.min(cell.cellIndex, newRow.cells.length - 1)];
    }else if(action === "row-delete"){
        if(rows.length > 1){
            const nextRow = selectedRow.nextElementSibling || selectedRow.previousElementSibling;
            selectedRow.remove();
            focusTarget = nextRow?.cells[Math.min(cell.cellIndex, (nextRow?.cells.length || 1) - 1)] || null;
        }else{
            [...selectedRow.cells].forEach(tableCell => tableCell.replaceChildren(document.createElement("br")));
            focusTarget = cell;
        }
    }else if(action === "column-before" || action === "column-after"){
        const insertIndex = cell.cellIndex + (action === "column-after" ? 1 : 0);
        const widths = projectNoteGetColumnWidths(table);
        const splitIndex = Math.min(insertIndex === widths.length ? widths.length - 1 : insertIndex, widths.length - 1);
        const newWidth = widths[splitIndex] / 2;
        widths[splitIndex] -= newWidth;
        widths.splice(insertIndex, 0, newWidth);
        rows.forEach(row => {
            const newCell = projectNoteCreateTableCell();
            row.insertBefore(newCell, row.cells[insertIndex] || null);
            if(row === selectedRow) focusTarget = newCell;
        });
        projectNoteSetColumnWidths(table, widths);
    }else if(action === "column-delete"){
        if(rows.every(row => row.cells.length <= 1)){
            rows.forEach(row => row.cells[0]?.replaceChildren(document.createElement("br")));
            focusTarget = cell;
        }else{
            const widths = projectNoteGetColumnWidths(table);
            widths.splice(cell.cellIndex, 1);
            rows.forEach(row => row.cells[cell.cellIndex]?.remove());
            projectNoteSetColumnWidths(table, widths);
            focusTarget = selectedRow.cells[Math.min(cell.cellIndex, selectedRow.cells.length - 1)] || null;
        }
    }else if(action === "table-delete"){
        let parent = table.parentElement;
        let nextSibling = table.nextElementSibling;
        const previousSibling = table.previousElementSibling;
        table.remove();
        if(parent && parent.matches("td, th")){
            if(!parent.childNodes.length) parent.appendChild(document.createElement("br"));
            projectNoteFocusCell(editor, parent);
        }else if(parent === editor){
            const adjacentTextBlock = [nextSibling, previousSibling].find(node => projectEquationIsTextBlock(node));
            if(adjacentTextBlock) projectEquationSetCaretAtStart(editor, adjacentTextBlock);
            else{
                const paragraph = document.createElement("p");
                paragraph.appendChild(document.createElement("br"));
                editor.insertBefore(paragraph, nextSibling && nextSibling.parentNode === editor ? nextSibling : null);
                projectEquationSetCaretAtStart(editor, paragraph);
            }
        }else if(parent){
            if(!parent.childNodes.length) parent.appendChild(document.createElement("br"));
            projectEquationSetCaretAtStart(editor, parent);
        }
        return true;
    }else{
        return false;
    }

    projectNoteFocusCell(editor, focusTarget);
    return true;
}

const projectNoteTableMoveModes = new WeakMap();

function projectNoteSelectWholeTable(editor, table){
    if(!editor.contains(table)) return false;
    editor.querySelectorAll("table[data-project-table-selected]").forEach(item => item.removeAttribute("data-project-table-selected"));
    table.setAttribute("data-project-table-selected", "true");
    editor.focus({ preventScroll:true });
    const range = document.createRange();
    range.selectNode(table);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
}

function projectNoteRangeSelectsNode(range, node){
    if(!range || !node?.isConnected) return false;
    const nodeRange = document.createRange();
    nodeRange.selectNode(node);
    return range.startContainer === nodeRange.startContainer
        && range.startOffset === nodeRange.startOffset
        && range.endContainer === nodeRange.endContainer
        && range.endOffset === nodeRange.endOffset;
}

function projectNoteSetTableSelection(editor, table){
    const range = document.createRange();
    range.selectNode(table);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}

function projectNoteMoveNodeVertically(parent, node, key){
    if(key === "ArrowUp"){
        let previous = node.previousSibling;
        while(previous && previous.nodeType !== Node.ELEMENT_NODE && !(previous.nodeType === Node.TEXT_NODE && previous.textContent.trim())) previous = previous.previousSibling;
        if(!previous) return false;
        parent.insertBefore(node, previous);
        return true;
    }
    if(key === "ArrowDown"){
        let next = node.nextSibling;
        while(next && next.nodeType !== Node.ELEMENT_NODE && !(next.nodeType === Node.TEXT_NODE && next.textContent.trim())) next = next.nextSibling;
        if(!next) return false;
        parent.insertBefore(next, node);
        return true;
    }
    return false;
}

function projectNoteStartTableMove(editor, table){
    if(!editor.contains(table) || projectNoteTableMoveModes.has(editor)) return false;
    const state = {
        table,
        movingNode:table,
        parent:table.parentNode,
        originalNodes:[...table.parentNode.childNodes],
        originalStyle:{
            float:table.style.getPropertyValue("float"),
            floatPriority:table.style.getPropertyPriority("float"),
            marginLeft:table.style.getPropertyValue("margin-left"),
            marginLeftPriority:table.style.getPropertyPriority("margin-left"),
            marginRight:table.style.getPropertyValue("margin-right"),
            marginRightPriority:table.style.getPropertyPriority("margin-right"),
            width:table.style.getPropertyValue("width"),
            widthPriority:table.style.getPropertyPriority("width")
        },
        changed:false
    };
    projectNoteTableMoveModes.set(editor, state);
    const selected = projectNoteSelectWholeTable(editor, table);
    if(selected) showToast("Use the arrow keys to move the table. Enter confirms; Escape cancels.");
    return selected;
}

function projectNoteRestoreTableMoveStyles(table, style){
    [["float", style.float, style.floatPriority], ["margin-left", style.marginLeft, style.marginLeftPriority], ["margin-right", style.marginRight, style.marginRightPriority], ["width", style.width, style.widthPriority]].forEach(([property, value, priority]) => {
        if(value) table.style.setProperty(property, value, priority);
        else table.style.removeProperty(property);
    });
}

function projectNoteMoveTablePreview(editor, state, key){
    const { table, parent, movingNode } = state;
    if(!table.isConnected || !editor.contains(table) || movingNode.parentNode !== parent) return false;

    if(key === "ArrowLeft" || key === "ArrowRight"){
        const parentStyle = getComputedStyle(parent);
        const paddingLeft = parseFloat(parentStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(parentStyle.paddingRight) || 0;
        const availableWidth = Math.max(0, parent.clientWidth - paddingLeft - paddingRight);
        const tableWidth = table.getBoundingClientRect().width;
        const computedTable = getComputedStyle(table);
        const floatSide = table.style.float || computedTable.float || "left";
        const marginLeft = Math.max(0, parseFloat(table.style.marginLeft || computedTable.marginLeft) || 0);
        const marginRight = Math.max(0, parseFloat(table.style.marginRight || computedTable.marginRight) || 0);
        if(floatSide === "right"){
            const maximumOffset = Math.max(0, availableWidth - tableWidth - marginLeft);
            const currentOffset = Math.min(maximumOffset, marginRight);
            const direction = key === "ArrowLeft" ? 1 : -1;
            const nextOffset = Math.min(maximumOffset, Math.max(0, currentOffset + direction * 12));
            if(nextOffset === currentOffset) return false;
            table.style.float = "right";
            table.style.marginRight = `${nextOffset}px`;
        }else{
            const maximumOffset = Math.max(0, availableWidth - tableWidth - marginRight);
            const currentOffset = Math.min(maximumOffset, marginLeft);
            const direction = key === "ArrowRight" ? 1 : -1;
            const nextOffset = Math.min(maximumOffset, Math.max(0, currentOffset + direction * 12));
            if(nextOffset === currentOffset) return false;
            table.style.float = "left";
            table.style.marginLeft = `${nextOffset}px`;
        }
        state.changed = true;
    }else if(key === "ArrowUp" || key === "ArrowDown"){
        if(!projectNoteMoveNodeVertically(parent, movingNode, key)) return false;
        state.changed = true;
    }else{
        return false;
    }

    projectNoteSetTableSelection(editor, table);
    return true;
}

function projectNoteSerializeMoveNodes(nodes, movedTable){
    return nodes.map(node => {
        if(node.nodeType === Node.TEXT_NODE) return escapeProjectHtml(node.nodeValue || "");
        if(node.nodeType !== Node.ELEMENT_NODE) return "";
        const container = document.createElement("div");
        container.appendChild(node.cloneNode(true));
        let safeHtml = sanitizeProjectNoteHtml(container.innerHTML);
        if(node === movedTable){
            safeHtml = safeHtml.replace(/^<table(?=[\s>])/, '<table data-project-table-move-result="true"');
        }
        return safeHtml;
    }).join("");
}

function projectNoteFinishTableMove(editor, confirmMove){
    const state = projectNoteTableMoveModes.get(editor);
    if(!state) return false;
    projectNoteTableMoveModes.delete(editor);
    const { table, parent, originalNodes } = state;
    if(!table.isConnected || !editor.contains(table) || !parent.isConnected){
        table.removeAttribute("data-project-table-selected");
        return false;
    }

    const currentNodes = [...parent.childNodes];
    let start = 0;
    while(start < originalNodes.length && start < currentNodes.length && originalNodes[start] === currentNodes[start]) start++;
    let end = originalNodes.length - 1;
    while(end >= start && end < currentNodes.length && originalNodes[end] === currentNodes[end]) end--;
    if(start > end){
        start = originalNodes.indexOf(state.movingNode);
        end = start;
    }

    const shouldCommit = confirmMove && state.changed;
    const finalHtml = shouldCommit ? projectNoteSerializeMoveNodes(currentNodes.slice(start, end + 1), table) : "";
    parent.replaceChildren(...originalNodes);
    projectNoteRestoreTableMoveStyles(table, state.originalStyle);
    table.removeAttribute("data-project-table-selected");

    if(shouldCommit && start >= 0 && end >= start){
        const affectedNodes = originalNodes.slice(start, end + 1);
        if(affectedNodes.length){
            const range = document.createRange();
            range.setStartBefore(affectedNodes[0]);
            range.setEndAfter(affectedNodes[affectedNodes.length - 1]);
            const selection = window.getSelection();
            editor.focus({ preventScroll:true });
            selection?.removeAllRanges();
            selection?.addRange(range);
            const nativeEdit = document.execCommand("insertHTML", false, finalHtml);
            let moveResult = editor.querySelector('[data-project-table-move-result="true"]');
            let movedTable = moveResult?.matches("table") ? moveResult : moveResult?.querySelector("table");

            if(!movedTable && !nativeEdit){
                const fallbackRange = document.createRange();
                fallbackRange.setStartBefore(affectedNodes[0]);
                fallbackRange.setEndAfter(affectedNodes[affectedNodes.length - 1]);
                fallbackRange.deleteContents();
                const fragmentHost = document.createElement("div");
                fragmentHost.innerHTML = finalHtml;
                const fragment = document.createDocumentFragment();
                while(fragmentHost.firstChild) fragment.appendChild(fragmentHost.firstChild);
                fallbackRange.insertNode(fragment);
                moveResult = editor.querySelector('[data-project-table-move-result="true"]');
                movedTable = moveResult?.matches("table") ? moveResult : moveResult?.querySelector("table");
                if(!nativeEdit) editor.dispatchEvent(new Event("input", { bubbles:true }));
            }

            if(movedTable){
                moveResult?.removeAttribute("data-project-table-move-result");
                movedTable.removeAttribute("data-project-table-selected");
                setupProjectEquationEditorNodes(editor);
                const nextBlock = state.movingNode.nextElementSibling;
                if(projectEquationIsTextBlock(nextBlock)){
                    projectEquationSetCaretAtStart(editor, nextBlock);
                }else{
                    const caret = document.createRange();
                    caret.setStartAfter(state.movingNode);
                    caret.collapse(true);
                    editor.focus({ preventScroll:true });
                    selection?.removeAllRanges();
                    selection?.addRange(caret);
                }
                editor.dispatchEvent(new Event("input", { bubbles:true }));
            }
        }
    }

    if(!shouldCommit){
        table.removeAttribute("data-project-table-selected");
        if(projectEquationIsTextBlock(state.movingNode.nextElementSibling)){
            const nextBlock = state.movingNode.nextElementSibling;
            projectEquationSetCaretAtStart(editor, nextBlock);
        }else{
            const caret = document.createRange();
            caret.setStartAfter(state.movingNode);
            caret.collapse(true);
            const selection = window.getSelection();
            editor.focus({ preventScroll:true });
            selection?.removeAllRanges();
            selection?.addRange(caret);
        }
    }
    return true;
}

let projectTableContextMenuState = null;

function projectNoteCloseTableContextMenu(restoreSelection = false){
    const state = projectTableContextMenuState;
    if(!state) return;
    projectTableContextMenuState = null;
    document.removeEventListener("pointerdown", state.onOutsidePointerDown, true);
    document.removeEventListener("keydown", state.onDocumentKeyDown, true);
    document.removeEventListener("scroll", state.onDocumentScroll, true);
    window.removeEventListener("resize", state.onWindowResize);
    state.menu.remove();

    if(restoreSelection && state.selectionRange?.startContainer?.isConnected){
        state.editor.focus({ preventScroll:true });
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(state.selectionRange);
    }
}

function projectNoteOpenTableContextMenu(editor, table, cell, selectedCells, selectionRange, pointerX, pointerY){
    projectNoteCloseTableContextMenu();
    const headingActionDisabled = selectedCells.every(item => item.tagName === "TH");
    const normalActionDisabled = selectedCells.every(item => item.tagName === "TD");
    const menu = document.createElement("div");
    menu.className = "project-table-context-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Table actions");
    menu.tabIndex = -1;
    menu.innerHTML = `
        <button type="button" role="menuitem" data-project-table-action="row-above" ${projectNoteStorageReady ? "" : "disabled"}>Add row above</button>
        <button type="button" role="menuitem" data-project-table-action="row-below" ${projectNoteStorageReady ? "" : "disabled"}>Add row below</button>
        <button type="button" role="menuitem" data-project-table-action="row-delete" ${projectNoteStorageReady ? "" : "disabled"}>Delete this row</button>
        <span class="project-table-context-menu-divider" role="separator"></span>
        <button type="button" role="menuitem" data-project-table-action="column-before" ${projectNoteStorageReady ? "" : "disabled"}>Add column before</button>
        <button type="button" role="menuitem" data-project-table-action="column-after" ${projectNoteStorageReady ? "" : "disabled"}>Add column after</button>
        <button type="button" role="menuitem" data-project-table-action="column-delete" ${projectNoteStorageReady ? "" : "disabled"}>Delete this column</button>
        <span class="project-table-context-menu-divider" role="separator"></span>
        <button type="button" role="menuitem" data-project-table-action="heading-set" ${!projectNoteStorageReady || headingActionDisabled ? "disabled" : ""}>Mark selected cells as headings</button>
        <button type="button" role="menuitem" data-project-table-action="heading-clear" ${!projectNoteStorageReady || normalActionDisabled ? "disabled" : ""}>Make selected cells normal</button>
        <span class="project-table-context-menu-divider" role="separator"></span>
        <button type="button" role="menuitem" data-project-table-action="table-select" ${projectNoteStorageReady ? "" : "disabled"}>Select whole table to move</button>
        <button type="button" role="menuitem" class="is-danger" data-project-table-action="table-delete" ${projectNoteStorageReady ? "" : "disabled"}>Delete the entire table</button>`;

    menu.addEventListener("pointerdown", event => {
        if(event.target.closest("[data-project-table-action]")) event.preventDefault();
    });
    menu.addEventListener("click", event => {
        const item = event.target.closest("[data-project-table-action]");
        if(!item || item.disabled) return;
        const action = item.dataset.projectTableAction;
        projectNoteCloseTableContextMenu();
        if(!editor.contains(table) || !table.contains(cell)) return;

        if(action === "table-select"){
            if(!projectNoteStartTableMove(editor, table)) return;
            requestAnimationFrame(() => {
                if(projectNoteTableMoveModes.get(editor)?.table === table) projectNoteSelectWholeTable(editor, table);
            });
            return;
        }

        const validCells = selectedCells.filter(selectedCell => editor.contains(selectedCell) && table.contains(selectedCell));
        if(!projectNoteApplyTableAction(editor, table, cell, action, validCells.length ? validCells : [cell])) return;
        editor.dispatchEvent(new Event("input", { bubbles:true }));
    });
    menu.addEventListener("keydown", event => {
        const items = [...menu.querySelectorAll('[role="menuitem"]:not(:disabled)')];
        const currentIndex = items.indexOf(document.activeElement);
        let nextIndex = currentIndex;
        if(event.key === "ArrowDown") nextIndex = (currentIndex + 1 + items.length) % items.length;
        else if(event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
        else if(event.key === "Home") nextIndex = 0;
        else if(event.key === "End") nextIndex = items.length - 1;
        else return;
        event.preventDefault();
        items[nextIndex]?.focus();
    });

    menu.style.visibility = "hidden";
    document.body.appendChild(menu);
    const editorBounds = editor.getBoundingClientRect();
    const leftBound = Math.max(8, editorBounds.left);
    const rightBound = Math.min(window.innerWidth - 8, editorBounds.right);
    const topBound = Math.max(8, editorBounds.top);
    const bottomBound = Math.min(window.innerHeight - 8, editorBounds.bottom);
    menu.style.maxHeight = `${Math.max(96, bottomBound - topBound - 8)}px`;
    const maxLeft = Math.max(leftBound, rightBound - menu.offsetWidth);
    const maxTop = Math.max(topBound, bottomBound - menu.offsetHeight);
    menu.style.left = `${Math.max(leftBound, Math.min(pointerX, maxLeft))}px`;
    menu.style.top = `${Math.max(topBound, Math.min(pointerY, maxTop))}px`;
    menu.style.visibility = "visible";

    const state = {
        editor,
        menu,
        selectionRange,
        onOutsidePointerDown: event => {
            if(!menu.contains(event.target)) projectNoteCloseTableContextMenu();
        },
        onDocumentKeyDown: event => {
            if(event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            projectNoteCloseTableContextMenu(true);
        },
        onDocumentScroll: event => {
            if(!menu.contains(event.target)) projectNoteCloseTableContextMenu();
        },
        onWindowResize:() => projectNoteCloseTableContextMenu()
    };
    projectTableContextMenuState = state;
    document.addEventListener("pointerdown", state.onOutsidePointerDown, true);
    document.addEventListener("keydown", state.onDocumentKeyDown, true);
    document.addEventListener("scroll", state.onDocumentScroll, true);
    window.addEventListener("resize", state.onWindowResize);
    menu.querySelector('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll:true });
}

function renderProjectNoteView(note){
    cleanupProjectNoteImageEditor();
    projectNoteCloseTableContextMenu();
    const subject = projectSubjects().find(item => getProjectSubjectId(item, false) === note.subjectId);
    const returnContext = projectState.selectedTopicId ? projectTopicById(projectState.selectedTopicId) : null;
    const returnLabel = returnContext ? returnContext.name : (subject ? subject.name : "subject workspace");
    projectTopicWelcome.classList.add("hidden");
    projectTopicDetail.classList.add("hidden");
    projectNoteView.classList.remove("hidden");
    projectNoteView.classList.toggle("is-editing", Boolean(projectState.isEditingNote));
    projectPage.classList.toggle("is-note-editing", Boolean(projectState.isEditingNote));
    projectAppShell?.classList.toggle("is-project-note-editing", Boolean(projectState.isEditingNote));
    projectSubjectWorkspace.classList.add("is-reading");

    if(projectState.isEditingNote){
        projectNoteView.innerHTML = `
            <div class="project-note-editor">
                <div class="project-note-toolbar">
                    <button class="project-note-back-button" type="button" data-project-note-back><i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>Back</span></button>
                    <input id="projectNoteTitleInput" class="project-note-title-input" type="text" maxlength="160" value="${escapeProjectHtml(note.title)}" aria-label="Note title">
                    <span id="projectNoteSaveStatus" class="project-note-save-status is-visually-hidden" role="status" aria-live="polite"></span>
                </div>
                <div class="project-note-format-toolbar" role="toolbar" aria-label="Note formatting">
                    <button type="button" data-note-command="bold" title="Bold" aria-label="Bold"><strong>B</strong></button>
                    <button type="button" data-note-command="italic" title="Italic" aria-label="Italic"><em>I</em></button>
                    <button type="button" data-note-command="underline" title="Underline" aria-label="Underline"><u>U</u></button>
                    <span class="project-note-format-divider" aria-hidden="true"></span>
                    <button type="button" data-note-command="formatBlock" data-note-value="h1" title="Heading 1" aria-label="Heading 1">H1</button>
                    <button type="button" data-note-command="formatBlock" data-note-value="h2" title="Heading 2" aria-label="Heading 2">H2</button>
                    <button type="button" data-note-command="formatBlock" data-note-value="p" title="Normal paragraph" aria-label="Normal paragraph">¶</button>
                    <span class="project-note-format-divider" aria-hidden="true"></span>
                    <button type="button" data-note-command="insertUnorderedList" title="Bulleted list" aria-label="Bulleted list"><i class="fa-solid fa-list-ul" aria-hidden="true"></i></button>
                    <button type="button" data-note-command="insertOrderedList" title="Numbered list" aria-label="Numbered list"><i class="fa-solid fa-list-ol" aria-hidden="true"></i></button>
                    <span class="project-note-format-divider" aria-hidden="true"></span>
                    <button type="button" data-note-command="undo" title="Undo" aria-label="Undo"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
                    <button type="button" data-note-command="redo" title="Redo" aria-label="Redo"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i></button>
                    <span class="project-note-format-divider" aria-hidden="true"></span>
                    <button class="project-note-equation-button" type="button" data-project-equation-insert title="Insert equation" aria-label="Insert equation"><i class="fa-solid fa-square-root-variable" aria-hidden="true"></i><span>Equation</span></button>
                    <button class="project-note-table-button" type="button" data-project-note-table-insert title="Insert table" aria-label="Insert table" ${projectNoteStorageReady ? "" : "disabled"}><i class="fa-solid fa-table" aria-hidden="true"></i><span>Table</span></button>
                    <button class="project-note-image-button" type="button" data-project-note-image-insert title="Insert image" aria-label="Insert image" ${projectNoteStorageReady ? "" : "disabled"}><i class="fa-regular fa-image" aria-hidden="true"></i><span>Image</span></button>
                    <input id="projectNoteImageInput" class="project-note-image-input" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" aria-label="Choose an image" hidden>
                </div>
                <div id="projectNoteContentInput" class="project-note-content-input" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Note content" data-placeholder="Write your note here…" spellcheck="true">${projectNoteEditorHtml(note)}</div>
                <div class="project-note-editor-footer">
                    <button class="project-primary-button" type="button" data-project-note-finish-edit>Done</button>
                </div>
            </div>`;

        const titleInput = projectNoteView.querySelector("#projectNoteTitleInput");
        const contentInput = projectNoteView.querySelector("#projectNoteContentInput");
        const saveStatus = projectNoteView.querySelector("#projectNoteSaveStatus");
        setupProjectEquationEditorNodes(contentInput);
        setupProjectNoteTableResizing(contentInput);
        projectNoteImageEditorCleanup = setupProjectNoteImageTools(
            contentInput,
            projectNoteView.querySelector("[data-project-note-image-insert]"),
            projectNoteView.querySelector("#projectNoteImageInput")
        );
        const saveDraft = (saveContent = true) => {
            const currentNote = projectNoteRecords.find(item => item.id === projectState.activeNoteId);
            if(!currentNote || !projectNoteStorageReady){
                saveStatus.textContent = "Changes could not be saved";
                return false;
            }
            const updatedNote = {
                ...currentNote,
                title: titleInput.value.trim() || "Untitled Note",
                ...(saveContent ? { content: sanitizeProjectNoteHtml(contentInput.innerHTML), contentFormat: "html" } : {}),
                updatedAt: new Date().toISOString()
            };
            const nextNotes = projectNoteRecords.map(item => item.id === updatedNote.id ? updatedNote : item);
            if(!saveProjectNotes(nextNotes)){
                saveStatus.textContent = "Changes could not be saved";
                return false;
            }
            projectNoteRecords = nextNotes;
            saveStatus.textContent = "Saved";
            renderProjectTree();
            return true;
        };
        titleInput.addEventListener("input", () => saveDraft(false));
        contentInput.addEventListener("input", () => {
            saveStatus.textContent = "Saving…";
            saveDraft();
        });
        const formatToolbar = projectNoteView.querySelector(".project-note-format-toolbar");
        formatToolbar.addEventListener("mousedown", event => {
            if(event.target.closest("[data-note-command], [data-project-equation-insert], [data-project-note-table-insert], [data-project-note-image-insert]")) event.preventDefault();
        });
        formatToolbar.addEventListener("click", event => {
            if(projectNoteTableMoveModes.has(contentInput)) projectNoteFinishTableMove(contentInput, false);
            if(event.target.closest("[data-project-note-table-insert]")){
                if(projectNoteStorageReady) projectNoteInsertTable(contentInput);
                return;
            }
            if(event.target.closest("[data-project-equation-insert]")){
                openProjectEquationDialog(contentInput);
                return;
            }
            const button = event.target.closest("[data-note-command]");
            if(!button || !projectNoteStorageReady) return;
            const command = button.dataset.noteCommand;
            const value = button.dataset.noteValue;
            contentInput.focus();
            if(command === "formatBlock") document.execCommand(command, false, `<${value}>`);
            else document.execCommand(command, false, null);
            saveDraft();
        });
        contentInput.addEventListener("click", event => {
            const moveState = projectNoteTableMoveModes.get(contentInput);
            if(moveState && !moveState.table.contains(event.target)) projectNoteFinishTableMove(contentInput, false);
            const selectedTable = contentInput.querySelector("table[data-project-table-selected]");
            const selection = window.getSelection();
            const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
            if(selectedTable && !projectNoteRangeSelectsNode(range, selectedTable)) selectedTable.removeAttribute("data-project-table-selected");
            const equation = event.target.closest("math-span, math-div");
            if(equation && contentInput.contains(equation)) openProjectEquationDialog(contentInput, equation);
        });
        let rightClickSelectionSnapshot = null;
        contentInput.addEventListener("mousedown", event => {
            if(event.button === 2){
                const selection = window.getSelection();
                const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
                rightClickSelectionSnapshot = range && contentInput.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
            }else{
                rightClickSelectionSnapshot = null;
            }
            const moveState = projectNoteTableMoveModes.get(contentInput);
            if(moveState && (event.target.closest("td, th") || !moveState.table.contains(event.target))) projectNoteFinishTableMove(contentInput, false);
            if(event.target.closest("td, th")) contentInput.querySelectorAll("table[data-project-table-selected]").forEach(table => table.removeAttribute("data-project-table-selected"));
        });
        contentInput.addEventListener("contextmenu", event => {
            const targetElement = event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement;
            const cell = targetElement?.closest("td, th");
            if(!cell || !contentInput.contains(cell)) return;
            const table = cell.closest("table");
            if(!table) return;
            event.preventDefault();
            const selection = window.getSelection();
            const liveRange = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
            const selectionRange = rightClickSelectionSnapshot?.startContainer?.isConnected
                ? rightClickSelectionSnapshot
                : liveRange && contentInput.contains(liveRange.commonAncestorContainer) ? liveRange.cloneRange() : null;
            rightClickSelectionSnapshot = null;
            const selectedCells = selectionRange
                ? projectNoteSelectedCells(contentInput, selectionRange, table, cell)
                : [cell];
            const contextCells = selectedCells.includes(cell) ? selectedCells : [cell];
            projectNoteOpenTableContextMenu(contentInput, table, cell, contextCells, selectionRange, event.clientX, event.clientY);
        });
        contentInput.addEventListener("keydown", event => {
            const selection = window.getSelection();
            const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
            const moveState = projectNoteTableMoveModes.get(contentInput);
            if(moveState){
                if((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())){
                    projectNoteFinishTableMove(contentInput, false);
                    return;
                }
                if(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)){
                    event.preventDefault();
                    event.stopPropagation();
                    projectNoteMoveTablePreview(contentInput, moveState, event.key);
                    return;
                }
                if(event.key === "Enter"){
                    event.preventDefault();
                    event.stopPropagation();
                    projectNoteFinishTableMove(contentInput, true);
                    return;
                }
                if(event.key === "Escape"){
                    event.preventDefault();
                    event.stopPropagation();
                    projectNoteFinishTableMove(contentInput, false);
                    return;
                }
                if(!["Shift", "Control", "Alt", "Meta"].includes(event.key)) event.preventDefault();
                return;
            }
            if(event.key === "Tab"){
                const cell = range && contentInput.contains(range.commonAncestorContainer)
                    ? projectNoteFindCell(contentInput, range.startContainer)
                    : null;
                const table = cell && cell.closest("table");
                if(cell && table){
                    const cells = [...table.rows].flatMap(row => [...row.cells]);
                    const index = cells.indexOf(cell);
                    if(event.shiftKey){
                        if(index > 0){
                            event.preventDefault();
                            projectNoteFocusCell(contentInput, cells[index - 1]);
                        }
                    }else{
                        event.preventDefault();
                        if(index >= 0 && index < cells.length - 1){
                            projectNoteFocusCell(contentInput, cells[index + 1]);
                        }else{
                            const lastRow = table.rows[table.rows.length - 1];
                            const newRow = projectNoteCreateTableRow(Math.max(1, lastRow?.cells.length || 1));
                            (lastRow?.parentElement || table.createTBody()).appendChild(newRow);
                            projectNoteFocusCell(contentInput, newRow.cells[0]);
                            contentInput.dispatchEvent(new Event("input", { bubbles:true }));
                        }
                    }
                    if(event.defaultPrevented) return;
                }
            }
            if(event.key !== "Enter" && event.key !== " ") return;
            const equation = event.target.closest("math-span, math-div");
            if(!equation || !contentInput.contains(equation)) return;
            event.preventDefault();
            openProjectEquationDialog(contentInput, equation);
        });
        titleInput.addEventListener("blur", () => {
            if(!titleInput.value.trim()) titleInput.value = "Untitled Note";
        });
        projectNoteView.querySelector("[data-project-note-finish-edit]").disabled = !projectNoteStorageReady;
        return;
    }

    projectNoteView.innerHTML = `
        <article class="project-note-reader">
            <div class="project-note-toolbar">
                <button class="project-note-back-button" type="button" data-project-note-back><i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>Back to ${escapeProjectHtml(returnLabel)}</span></button>
                <div class="project-note-reader-actions">
                    <button class="project-secondary-button" type="button" data-project-note-edit ${projectNoteStorageReady ? "" : "disabled"}><i class="fa-regular fa-pen-to-square" aria-hidden="true"></i> Edit</button>
                    <button class="project-note-delete-button" type="button" data-project-note-delete ${projectNoteStorageReady ? "" : "disabled"}>Delete</button>
                </div>
            </div>
            <p class="project-note-owner">${escapeProjectHtml(projectNoteOwnerDescription(note))}</p>
            <h1 class="project-note-reader-title">${escapeProjectHtml(note.title)}</h1>
            <div class="project-note-reader-content">${renderProjectNoteContent(note.content, note.contentFormat)}</div>
        </article>`;
}

function returnFromProjectNote(){
    if(!projectState.activeNoteId) return;
    cleanupProjectNoteImageEditor();
    projectState.activeNoteId = null;
    projectState.isEditingNote = false;
    projectPage.classList.remove("is-note-editing");
    projectAppShell?.classList.remove("is-project-note-editing");
    projectSubjectWorkspace.classList.remove("is-reading");
    projectNoteView.classList.add("hidden");
    renderProjectWorkspace();
    projectTopicMain.focus({ preventScroll: true });
}

function openProjectNote(noteId){
    const note = projectNoteRecords.find(item => item.id === noteId && item.subjectId === projectState.subjectId);
    if(!note) return;
    if(note.ownerType === "subject"){
        if(note.ownerId !== projectState.subjectId) return;
        projectState.selectedTopicId = null;
    }else{
        const topic = projectTopicRecords.find(item => item.id === note.ownerId && item.subjectId === projectState.subjectId);
        if(!topic) return;
        projectState.selectedTopicId = topic.id;
        projectTopicPath(topic.id).forEach(parent => projectState.expandedIds.add(parent.id));
        projectState.expandedIds.add(topic.id);
        saveProjectExpandedState();
    }
    projectState.activeNoteId = note.id;
    projectState.isEditingNote = false;
    closeProjectTreeDrawer();
    renderProjectWorkspace();
}

function openProjectNoteTitleForm(ownerType, ownerId, subjectId){
    setProjectDialog("Create New Note", `
        <form class="project-dialog-form project-note-title-form" data-project-note-title-form novalidate>
            <label class="project-dialog-label" for="projectNewNoteTitle">Note title</label>
            <input id="projectNewNoteTitle" class="project-dialog-input" name="title" type="text" maxlength="160" autocomplete="off" placeholder="Enter note title" aria-describedby="projectNewNoteTitleError">
            <p id="projectNewNoteTitleError" class="project-dialog-error" data-project-note-title-error role="status" aria-live="polite"></p>
            <div class="project-dialog-actions">
                <button class="project-secondary-button" type="button" data-project-note-title-cancel>Cancel</button>
                <button class="project-primary-button" type="submit" data-project-note-title-create disabled>Create Note</button>
            </div>
        </form>
    `, "#projectNewNoteTitle", "note-title");
    const form = projectDialogContent.querySelector("[data-project-note-title-form]");
    const input = form.elements.title;
    const createButton = form.querySelector("[data-project-note-title-create]");
    const errorMessage = form.querySelector("[data-project-note-title-error]");
    let isSubmitting = false;
    const updateCreateButton = () => {
        createButton.disabled = isSubmitting || !input.value.trim();
        if(input.value.trim()) errorMessage.textContent = "";
    };
    input.addEventListener("input", updateCreateButton);
    form.querySelector("[data-project-note-title-cancel]").addEventListener("click", closeProjectDialog);
    form.addEventListener("submit", event => {
        event.preventDefault();
        const title = input.value.trim();
        if(isSubmitting) return;
        if(!title){
            errorMessage.textContent = "Enter a note title to continue.";
            createButton.disabled = true;
            input.focus();
            return;
        }
        isSubmitting = true;
        updateCreateButton();
        if(createProjectNote(ownerType, ownerId, title, subjectId)){
            closeProjectDialog();
            projectNoteView.querySelector("#projectNoteTitleInput")?.focus({ preventScroll: true });
            return;
        }
        isSubmitting = false;
        errorMessage.textContent = "The note could not be created. Check that Project Notes can be saved, then try again.";
        updateCreateButton();
    });
}

function createProjectNote(ownerType, ownerId, title, subjectId = projectState.subjectId){
    title = typeof title === "string" ? title.trim() : "";
    if(!title || !projectNoteStorageReady || !subjectId || subjectId !== projectState.subjectId) return false;
    const subject = projectSubjects().find(item => getProjectSubjectId(item, false) === projectState.subjectId);
    if(!subject) return false;
    if(ownerType === "subject"){
        if(ownerId !== projectState.subjectId) return false;
    }else if(ownerType === "topic"){
        const topic = projectTopicRecords.find(item => item.id === ownerId && item.subjectId === projectState.subjectId);
        if(!topic) return false;
    }else{
        return false;
    }

    let noteId = createProjectId();
    while(projectNoteRecords.some(note => note.id === noteId)) noteId = createProjectId();
    const timestamp = new Date().toISOString();
    const note = {
        id: noteId,
        title,
        content: "",
        ownerType,
        ownerId,
        subjectId: projectState.subjectId,
        createdAt: timestamp,
        updatedAt: timestamp
    };
    const nextNotes = [...projectNoteRecords, note];
    if(!saveProjectNotes(nextNotes)){
        return false;
    }
    projectNoteRecords = nextNotes;
    if(ownerType === "topic"){
        projectTopicPath(ownerId).forEach(topic => projectState.expandedIds.add(topic.id));
        projectState.expandedIds.add(ownerId);
        saveProjectExpandedState();
    }
    projectState.activeNoteId = noteId;
    projectState.isEditingNote = true;
    renderProjectWorkspace();
    projectNoteView.querySelector("#projectNoteTitleInput")?.focus({ preventScroll: true });
    return true;
}

function deleteProjectNote(noteId){
    const note = projectNoteRecords.find(item => item.id === noteId);
    if(!note || !projectNoteStorageReady) return false;
    const nextNotes = projectNoteRecords.filter(item => item.id !== noteId);
    const subject = projectSubjects().find(item => getProjectSubjectId(item, false) === note.subjectId);
    const topic = note.ownerType === "topic" ? projectTopicRecords.find(item => item.id === note.ownerId && item.subjectId === note.subjectId) : null;
    const entry = makeRecycleBinEntry("note", note.title, {
        subjectId: note.subjectId,
        subjectName: subject?.name || "Project",
        ownerType: note.ownerType,
        ownerId: note.ownerId,
        topicName: topic?.name || ""
    }, { note: { ...note } });
    if(!persistRecycleBinAndStorage([...recycleBinEntries, entry], [[PROJECT_NOTES_KEY, nextNotes]])) return false;
    projectNoteRecords = nextNotes;
    if(projectState.activeNoteId === noteId){
        projectState.activeNoteId = null;
        projectState.isEditingNote = false;
        projectSubjectWorkspace.classList.remove("is-reading");
    }
    renderProjectWorkspace();
    return true;
}

function openProjectNoteRenameForm(noteId){
    if(!projectNoteStorageReady){
        showToast("Saved notes are read-only because their data could not be read safely.", "error");
        return;
    }
    const note = projectNoteRecords.find(item => item.id === noteId);
    if(!note) return;
    openProjectForm(
        "Rename note",
        "Choose a title for this note. Its content and location will stay the same.",
        `<label class="project-dialog-label" for="projectDialogNoteTitle">Note title</label>
         <input id="projectDialogNoteTitle" class="project-dialog-input" name="title" type="text" maxlength="160" required autocomplete="off" aria-describedby="projectDialogError" value="${escapeProjectHtml(note.title)}" placeholder="e.g. Lecture notes">`,
        "Save title",
        form => {
            const currentNote = projectNoteRecords.find(item => item.id === noteId);
            if(!currentNote){ setProjectDialogError("This note is no longer available."); return false; }
            const title = form.elements.title.value.trim();
            if(!title){ setProjectDialogError("Enter a note title to continue."); return false; }
            const updatedNote = { ...currentNote, title, updatedAt: new Date().toISOString() };
            const nextNotes = projectNoteRecords.map(item => item.id === noteId ? updatedNote : item);
            if(!saveProjectNotes(nextNotes)){
                setProjectDialogError("The note title could not be saved. No changes were made.");
                return false;
            }
            projectNoteRecords = nextNotes;
            renderProjectWorkspace();
            showToast("Note renamed successfully.", "success");
            return true;
        }
    );
}

function projectNoteMoveOptions(note){
    const groups = [];
    projectSubjects().forEach(subject => {
        const subjectId = getProjectSubjectId(subject, false);
        if(!subjectId) return;
        const subjectDestination = encodeURIComponent(JSON.stringify({ ownerType: "subject", ownerId: subjectId, subjectId }));
        const options = [`<option value="${subjectDestination}" ${note.ownerType === "subject" && note.ownerId === subjectId ? "selected" : ""}>Subject · ${escapeProjectHtml(subject.name)}</option>`];
        const visited = new Set();
        const addBranch = (parentId, level) => {
            projectTopicChildren(parentId, subjectId).forEach(topic => {
                if(visited.has(topic.id)) return;
                visited.add(topic.id);
                const destination = encodeURIComponent(JSON.stringify({ ownerType: "topic", ownerId: topic.id, subjectId }));
                const prefix = `${"— ".repeat(Math.min(level + 1, 6))}`;
                const isCurrent = note.ownerType === "topic" && note.ownerId === topic.id && note.subjectId === subjectId;
                options.push(`<option value="${destination}" ${isCurrent ? "selected" : ""}>${escapeProjectHtml(prefix + topic.name)}</option>`);
                addBranch(topic.id, level + 1);
            });
        };
        addBranch(null, 0);
        groups.push(`<optgroup label="${escapeProjectHtml(subject.name)}">${options.join("")}</optgroup>`);
    });
    return groups.join("");
}

function isValidProjectNoteTopic(topicId, subjectId){
    let current = projectTopicRecords.find(item => item.id === topicId && item.subjectId === subjectId);
    const visited = new Set();
    while(current){
        if(visited.has(current.id) || current.subjectId !== subjectId) return false;
        visited.add(current.id);
        if(!current.parentId) return true;
        current = projectTopicRecords.find(item => item.id === current.parentId && item.subjectId === subjectId);
    }
    return false;
}

function openProjectNoteMoveForm(noteId){
    if(!projectNoteStorageReady){
        showToast("Saved notes are read-only because their data could not be read safely.", "error");
        return;
    }
    const note = projectNoteRecords.find(item => item.id === noteId);
    if(!note) return;
    openProjectForm(
        "Move note",
        `Choose where “${note.title}” belongs. Only its location will change; its title and content will stay intact.`,
        `<label class="project-dialog-label" for="projectNoteMoveDestination">New location</label>
         <select id="projectNoteMoveDestination" class="project-dialog-input" name="destination" required aria-describedby="projectDialogError">${projectNoteMoveOptions(note)}</select>`,
        "Move note",
        form => {
            const currentNote = projectNoteRecords.find(item => item.id === noteId);
            if(!currentNote){ setProjectDialogError("This note is no longer available."); return false; }
            let destination;
            try{
                destination = JSON.parse(decodeURIComponent(form.elements.destination.value));
            }catch(error){
                setProjectDialogError("Choose a valid destination.");
                return false;
            }
            if(!destination || typeof destination !== "object"){
                setProjectDialogError("Choose a valid destination.");
                return false;
            }
            const destinationSubject = projectSubjects().find(item => getProjectSubjectId(item, false) === destination.subjectId);
            const validSubjectDestination = destination.ownerType === "subject" && destination.ownerId === destination.subjectId && destinationSubject;
            const validTopicDestination = destination.ownerType === "topic" && isValidProjectNoteTopic(destination.ownerId, destination.subjectId) && destinationSubject;
            if(!validSubjectDestination && !validTopicDestination){
                setProjectDialogError("Choose a valid Project subject or topic.");
                return false;
            }
            if(currentNote.ownerType === destination.ownerType && currentNote.ownerId === destination.ownerId && currentNote.subjectId === destination.subjectId){
                showToast("This note is already in that location.", "info");
                return true;
            }

            const updatedNote = {
                ...currentNote,
                ownerType: destination.ownerType,
                ownerId: destination.ownerId,
                subjectId: destination.subjectId,
                updatedAt: new Date().toISOString()
            };
            const nextNotes = projectNoteRecords.map(item => item.id === noteId ? updatedNote : item);
            if(!saveProjectNotes(nextNotes)){
                setProjectDialogError("The note could not be moved. No changes were made.");
                return false;
            }
            projectNoteRecords = nextNotes;

            if(projectState.activeNoteId === noteId){
                if(projectState.subjectId !== destination.subjectId){
                    projectState.subjectId = destination.subjectId;
                    const savedExpanded = projectExpandedBySubject[destination.subjectId];
                    projectState.expandedIds = new Set(Array.isArray(savedExpanded) ? savedExpanded : []);
                }
                projectState.selectedTopicId = destination.ownerType === "topic" ? destination.ownerId : null;
                if(destination.ownerType === "topic"){
                    projectTopicPath(destination.ownerId).forEach(topic => projectState.expandedIds.add(topic.id));
                    projectState.expandedIds.add(destination.ownerId);
                }
                saveProjectExpandedState();
            }
            renderProjectWorkspace();
            showToast("Note moved successfully.", "success");
            return true;
        },
        "#projectNoteMoveDestination"
    );
}

function confirmDeleteProjectNote(noteId){
    if(!projectNoteStorageReady){
        showToast("Saved notes are read-only because their data could not be read safely.", "error");
        return;
    }
    const note = projectNoteRecords.find(item => item.id === noteId);
    if(!note) return;
    openProjectConfirm("Move note to Recycle Bin?", `Move “${note.title}” to Recycle Bin? Its rich text, equations, tables, and embedded images will be kept.`, "Move to Recycle Bin", () => {
        if(!deleteProjectNote(noteId)){
            showToast("The note could not be moved to Recycle Bin. No changes were made.", "error");
            return;
        }
        showToast("Note moved to Recycle Bin.", "success");
    });
}

function renderProjectWorkspace(){
    const subject = projectSubjects().find(item => getProjectSubjectId(item, false) === projectState.subjectId);
    if(!subject){
        closeProjectWorkspace();
        return;
    }
    projectHomeView.classList.add("hidden");
    projectSubjectWorkspace.classList.remove("hidden");
    projectWorkspaceSubjectTitle.textContent = subject.name;
    document.getElementById("projectSidebarSubjectTitle").textContent = subject.name;
    const ownerType = projectState.selectedTopicId && projectTopicById(projectState.selectedTopicId) ? "topic" : "subject";
    const ownerId = ownerType === "topic" ? projectState.selectedTopicId : projectState.subjectId;
    [document.getElementById("projectCreateNoteButton"), document.getElementById("projectAddResourcesButton")].forEach(button => {
        button.dataset.projectOwnerType = ownerType;
        button.dataset.projectOwnerId = ownerId;
        button.dataset.projectSubjectId = projectState.subjectId;
    });
    renderProjectTree();
    if(projectState.activeNoteId){
        const note = projectNoteRecords.find(item => item.id === projectState.activeNoteId && item.subjectId === projectState.subjectId);
        if(note){
            renderProjectNoteView(note);
            return;
        }
        projectState.activeNoteId = null;
        projectState.isEditingNote = false;
    }
    projectSubjectWorkspace.classList.remove("is-reading");
    projectNoteView.classList.add("hidden");
    const topic = projectState.selectedTopicId ? projectTopicById(projectState.selectedTopicId) : null;
    renderProjectTopicDetail(topic);
}

function openProjectSubject(subjectId){
    const subject = projectSubjects().find(item => getProjectSubjectId(item, false) === subjectId);
    if(!subject) return;
    projectState.subjectId = subjectId;
    projectState.selectedTopicId = null;
    const savedExpanded = projectExpandedBySubject[subjectId];
    projectState.expandedIds = new Set(Array.isArray(savedExpanded) ? savedExpanded.filter(id => projectTopicsForSubject(subjectId).some(topic => topic.id === id)) : []);
    renderProjectWorkspace();
}

function closeProjectWorkspace(){
    cleanupProjectNoteImageEditor();
    projectState.subjectId = null;
    projectState.selectedTopicId = null;
    projectState.activeNoteId = null;
    projectState.isEditingNote = false;
    projectPage.classList.remove("is-note-editing");
    projectAppShell?.classList.remove("is-project-note-editing");
    projectState.expandedIds.clear();
    projectSubjectWorkspace.classList.remove("is-reading");
    projectNoteView.classList.add("hidden");
    projectSubjectWorkspace.classList.add("hidden");
    projectHomeView.classList.remove("hidden");
    closeProjectTreeDrawer();
    renderProjectHome();
}

function renderProjectHome(){
    if(!projectSubjectGrid) return;
    const allSubjects = projectSubjects();
    const hasSubjects = allSubjects.length > 0;
    projectSubjectGrid.dataset.count = String(allSubjects.length);
    const subjectTiles = allSubjects.map((subject, index) => {
        const id = getProjectSubjectId(subject);
        return `<article class="project-subject-tile project-gradient-${index}">
            <button class="project-subject-open" type="button" data-project-open-subject="${escapeProjectHtml(id)}" aria-label="Open ${escapeProjectHtml(subject.name)}">
                <i class="fa-regular fa-folder-open" aria-hidden="true"></i><span>${escapeProjectHtml(subject.name)}</span>
            </button>
            <button class="project-subject-menu-toggle" type="button" data-subject-menu-toggle="${escapeProjectHtml(id)}" aria-label="Options for ${escapeProjectHtml(subject.name)}" aria-haspopup="menu" aria-expanded="false"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button>
            <div class="project-subject-menu hidden" role="menu">
                <button type="button" role="menuitem" data-subject-action="rename" data-subject-id="${escapeProjectHtml(id)}">Rename</button>
                <button type="button" role="menuitem" class="is-danger" data-subject-action="delete" data-subject-id="${escapeProjectHtml(id)}">Delete</button>
            </div>
        </article>`;
    }).join("");
    const addSubjectTile = `<article class="project-subject-tile project-add-subject-card">
        <button class="project-subject-open project-add-subject-button" type="button" data-project-add-subject aria-label="Add Subject">
            <i class="fa-solid fa-plus" aria-hidden="true"></i><span>Add Subject</span>
        </button>
    </article>`;
    projectSubjectGrid.innerHTML = subjectTiles + addSubjectTile;
    if(projectPageHeader) projectPageHeader.classList.toggle("hidden", !hasSubjects);
    if(projectPage){
        projectPage.classList.toggle("project-page-empty", !hasSubjects);
        projectPage.setAttribute("aria-labelledby", hasSubjects ? "projectPageTitle" : "projectEmptyTitle");
    }
    projectSubjectGrid.classList.toggle("hidden", !hasSubjects);
    projectEmptyState.classList.toggle("hidden", hasSubjects);
    if(!projectSubjectWorkspace.classList.contains("hidden")) projectSubjectWorkspace.classList.add("hidden");
    projectHomeView.classList.remove("hidden");
}

function openProjectTreeDrawer(){
    projectTopicSidebar.inert = false;
    projectTopicSidebar.setAttribute("aria-hidden", "false");
    projectTopicSidebar.classList.add("is-open");
    projectTreeScrim.classList.remove("hidden");
    projectOpenTreeButton.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => projectTreeScrim.classList.add("is-visible"));
}

function closeProjectTreeDrawer(){
    if(!projectTopicSidebar) return;
    projectTopicSidebar.classList.remove("is-open");
    const isMobile = window.matchMedia && window.matchMedia("(max-width: 799px)").matches;
    projectTopicSidebar.inert = Boolean(isMobile);
    projectTopicSidebar.setAttribute("aria-hidden", String(Boolean(isMobile)));
    projectOpenTreeButton.setAttribute("aria-expanded", "false");
    projectTreeScrim.classList.remove("is-visible");
    projectTreeScrim.classList.add("hidden");
}

function closeProjectContextMenus(){
    const focusedMenu = document.activeElement?.closest?.(".project-subject-menu, .project-topic-menu, .project-note-menu, .project-resource-menu");
    const owner = focusedMenu?.closest(".project-subject-tile, .project-topic-row, .project-note-row, .project-content-note-row, .project-content-resource");
    const toggle = owner?.querySelector("[data-topic-menu-toggle], [data-subject-menu-toggle], [data-note-menu-toggle], [data-resource-menu-toggle]");
    projectSubjectGrid.querySelectorAll(".project-subject-menu").forEach(menu => menu.classList.add("hidden"));
    projectSubjectGrid.querySelectorAll("[data-subject-menu-toggle]").forEach(toggle => toggle.setAttribute("aria-expanded", "false"));
    projectTopicTree.querySelectorAll(".project-topic-menu").forEach(menu => menu.classList.add("hidden"));
    projectTopicTree.querySelectorAll("[data-topic-menu-toggle]").forEach(toggle => toggle.setAttribute("aria-expanded", "false"));
    projectTopicTree.querySelectorAll(".project-note-menu").forEach(menu => menu.classList.add("hidden"));
    projectTopicTree.querySelectorAll("[data-note-menu-toggle]").forEach(toggle => toggle.setAttribute("aria-expanded", "false"));
    projectTopicMain.querySelectorAll(".project-note-menu").forEach(menu => menu.classList.add("hidden"));
    projectTopicMain.querySelectorAll("[data-note-menu-toggle]").forEach(toggle => toggle.setAttribute("aria-expanded", "false"));
    projectTopicDetail.querySelectorAll(".project-resource-menu").forEach(menu => menu.classList.add("hidden"));
    projectTopicDetail.querySelectorAll("[data-resource-menu-toggle]").forEach(toggle => toggle.setAttribute("aria-expanded", "false"));
    toggle?.focus();
}

function handleProjectContentAction(button){
    const ownerType = button.dataset.projectOwnerType;
    const ownerId = button.dataset.projectOwnerId;
    const currentSubjectId = projectState.subjectId;
    if(!currentSubjectId || button.dataset.projectSubjectId !== currentSubjectId) return;

    if(ownerType === "subject"){
        const subject = projectSubjects().find(item => getProjectSubjectId(item, false) === currentSubjectId);
        if(!subject || ownerId !== currentSubjectId) return;
    }else if(ownerType === "topic"){
        const topic = projectTopicById(ownerId);
        if(!topic || topic.subjectId !== currentSubjectId) return;
    }else{
        return;
    }

    if(button.dataset.projectLater === "Create Notes") openProjectNoteTitleForm(ownerType, ownerId, currentSubjectId);
    else if(button.dataset.projectLater === "Add Resources") openProjectResourceForm(ownerType, ownerId, currentSubjectId);
}

document.getElementById("projectAddSubjectButton").addEventListener("click", () => openProjectSubjectForm());
document.getElementById("projectBackToSubjects").addEventListener("click", closeProjectWorkspace);
document.getElementById("projectAddTopicButton").addEventListener("click", () => openProjectTopicForm(projectState.selectedTopicId || null));
document.getElementById("projectSearchButton").addEventListener("click", openProjectSearchPopup);
projectOpenTreeButton.addEventListener("click", openProjectTreeDrawer);
projectTreeScrim.addEventListener("click", closeProjectTreeDrawer);
document.getElementById("projectDialogClose").addEventListener("click", closeProjectDialog);
projectDialog.addEventListener("click", event => { if(event.target === projectDialog) closeProjectDialog(); });

projectSubjectGrid.addEventListener("click", event => {
    const addSubject = event.target.closest("[data-project-add-subject]");
    if(addSubject){
        openProjectSubjectForm();
        return;
    }
    const toggle = event.target.closest("[data-subject-menu-toggle]");
    if(toggle){
        const tile = toggle.closest(".project-subject-tile");
        const menu = tile.querySelector(".project-subject-menu");
        const shouldOpen = menu.classList.contains("hidden");
        projectSubjectGrid.querySelectorAll(".project-subject-menu").forEach(item => item.classList.add("hidden"));
        projectSubjectGrid.querySelectorAll("[data-subject-menu-toggle]").forEach(item => item.setAttribute("aria-expanded", "false"));
        menu.classList.toggle("hidden", !shouldOpen);
        toggle.setAttribute("aria-expanded", String(shouldOpen));
        if(shouldOpen) requestAnimationFrame(() => menu.querySelector("button:not([disabled])")?.focus());
        return;
    }
    const action = event.target.closest("[data-subject-action]");
    if(action){
        const id = action.dataset.subjectId;
        action.closest(".project-subject-tile").querySelector("[data-subject-menu-toggle]")?.focus();
        projectSubjectGrid.querySelectorAll(".project-subject-menu").forEach(item => item.classList.add("hidden"));
        if(action.dataset.subjectAction === "rename") openProjectSubjectForm(id);
        else openProjectDeleteSubject(id);
        return;
    }
    const openButton = event.target.closest("[data-project-open-subject]");
    if(openButton) openProjectSubject(openButton.dataset.projectOpenSubject);
});

projectTopicTree.addEventListener("click", event => {
    const noteToggle = event.target.closest("[data-note-menu-toggle]");
    if(noteToggle){
        const row = noteToggle.closest(".project-note-row");
        const menu = row.querySelector(".project-note-menu");
        const shouldOpen = menu.classList.contains("hidden");
        projectTopicTree.querySelectorAll(".project-topic-menu, .project-note-menu").forEach(item => item.classList.add("hidden"));
        projectTopicTree.querySelectorAll("[data-topic-menu-toggle], [data-note-menu-toggle]").forEach(item => item.setAttribute("aria-expanded", "false"));
        menu.classList.toggle("hidden", !shouldOpen);
        noteToggle.setAttribute("aria-expanded", String(shouldOpen));
        if(shouldOpen) requestAnimationFrame(() => menu.querySelector("button:not([disabled])")?.focus());
        return;
    }
    const noteAction = event.target.closest("[data-note-action]");
    if(noteAction){
        const noteId = noteAction.dataset.noteId;
        const action = noteAction.dataset.noteAction;
        noteAction.closest(".project-note-row").querySelector("[data-note-menu-toggle]")?.focus();
        projectTopicTree.querySelectorAll(".project-note-menu").forEach(item => item.classList.add("hidden"));
        projectTopicTree.querySelectorAll("[data-note-menu-toggle]").forEach(item => item.setAttribute("aria-expanded", "false"));
        if(action === "rename") openProjectNoteRenameForm(noteId);
        if(action === "move") openProjectNoteMoveForm(noteId);
        if(action === "delete") confirmDeleteProjectNote(noteId);
        return;
    }
    const noteButton = event.target.closest("[data-project-note-open]");
    if(noteButton){ openProjectNote(noteButton.dataset.projectNoteOpen); return; }
    const toggle = event.target.closest("[data-topic-menu-toggle]");
    if(toggle){
        const row = toggle.closest(".project-topic-row");
        const menu = row.querySelector(".project-topic-menu");
        const shouldOpen = menu.classList.contains("hidden");
        projectTopicTree.querySelectorAll(".project-topic-menu, .project-note-menu").forEach(item => item.classList.add("hidden"));
        projectTopicTree.querySelectorAll("[data-topic-menu-toggle], [data-note-menu-toggle]").forEach(item => item.setAttribute("aria-expanded", "false"));
        menu.classList.toggle("hidden", !shouldOpen);
        toggle.setAttribute("aria-expanded", String(shouldOpen));
        if(shouldOpen) requestAnimationFrame(() => menu.querySelector("button:not([disabled])")?.focus());
        return;
    }
    const expand = event.target.closest("[data-topic-expand]");
    if(expand){ toggleProjectTopic(expand.dataset.topicExpand); return; }
    const select = event.target.closest("[data-topic-select]");
    if(select){ selectProjectTopic(select.dataset.topicSelect); return; }
    const action = event.target.closest("[data-topic-action]");
    if(!action) return;
    const { topicId, topicAction } = { topicId: action.dataset.topicId, topicAction: action.dataset.topicAction };
    action.closest(".project-topic-row").querySelector("[data-topic-menu-toggle]")?.focus();
    projectTopicTree.querySelectorAll(".project-topic-menu").forEach(item => item.classList.add("hidden"));
    if(topicAction === "rename") openProjectTopicForm(null, topicId);
    if(topicAction === "move") openProjectMoveTopic(topicId);
    if(topicAction === "up") reorderProjectTopic(topicId, -1);
    if(topicAction === "down") reorderProjectTopic(topicId, 1);
    if(topicAction === "delete") deleteProjectTopic(topicId);
});

projectTopicTree.addEventListener("keydown", event => {
    const control = event.target.closest("[data-topic-select], [data-topic-expand]");
    if(!control) return;
    const topicId = control.dataset.topicSelect || control.dataset.topicExpand;
    const topic = projectTopicById(topicId);
    if(!topic) return;
    const visibleTopics = [...projectTopicTree.querySelectorAll(".project-topic-select")];
    const selectedButton = projectTopicTree.querySelector(`[data-topic-select="${topicId}"]`);
    const index = visibleTopics.indexOf(selectedButton);
    if(event.key === "ArrowDown" || event.key === "ArrowUp"){
        event.preventDefault();
        const nextIndex = Math.max(0, Math.min(visibleTopics.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
        visibleTopics[nextIndex]?.focus();
    }else if(event.key === "Home" || event.key === "End"){
        event.preventDefault();
        (event.key === "Home" ? visibleTopics[0] : visibleTopics[visibleTopics.length - 1])?.focus();
    }else if(event.key === "ArrowRight"){
        if(!projectTopicHasNestedItems(topicId)) return;
        event.preventDefault();
        if(!projectState.expandedIds.has(topicId)) toggleProjectTopic(topicId);
        else{
            const firstChild = projectTopicChildren(topicId)[0];
            if(firstChild) projectTopicTree.querySelector(`[data-topic-select="${firstChild.id}"]`)?.focus();
        }
    }else if(event.key === "ArrowLeft"){
        event.preventDefault();
        if(projectState.expandedIds.has(topicId)) toggleProjectTopic(topicId);
        else if(topic.parentId) projectTopicTree.querySelector(`[data-topic-select="${topic.parentId}"]`)?.focus();
    }
});

projectTopicDetail.addEventListener("click", event => {
    const menuToggle = event.target.closest("[data-resource-menu-toggle]");
    if(menuToggle){
        event.stopPropagation();
        const menu = menuToggle.closest(".project-content-resource").querySelector(".project-resource-menu");
        const shouldOpen = menu.classList.contains("hidden");
        projectTopicDetail.querySelectorAll(".project-resource-menu").forEach(item => item.classList.add("hidden"));
        projectTopicDetail.querySelectorAll("[data-resource-menu-toggle]").forEach(item => item.setAttribute("aria-expanded", "false"));
        if(shouldOpen){
            positionProjectResourceMenu(menu, menuToggle);
            menuToggle.setAttribute("aria-expanded", "true");
            requestAnimationFrame(() => menu.querySelector("button:not([disabled])")?.focus());
        }
        return;
    }
    const resourceAction = event.target.closest("[data-resource-action]");
    if(resourceAction){
        event.stopPropagation();
        const list = resourceAction.closest("[data-project-resource-list]");
        const owner = projectResourceOwnerFromList(list);
        resourceAction.focus();
        handleProjectResourceAction(resourceAction, owner);
        return;
    }
    const resourceOpen = event.target.closest("[data-project-resource-open]");
    if(resourceOpen){
        event.stopPropagation();
        const list = resourceOpen.closest("[data-project-resource-list]");
        openProjectResource(resourceOpen.dataset.projectResourceOpen, projectResourceOwnerFromList(list));
        return;
    }
    const select = event.target.closest("[data-topic-select]");
    if(select){ selectProjectTopic(select.dataset.topicSelect); return; }
    const addChild = event.target.closest("[data-add-child-topic]");
    if(addChild){ openProjectTopicForm(addChild.dataset.addChildTopic); return; }
    const breadcrumb = event.target.closest("[data-project-breadcrumb]");
    if(breadcrumb){
        if(breadcrumb.dataset.projectBreadcrumb === "projects"){
            closeProjectWorkspace();
            return;
        }
        if(breadcrumb.dataset.projectBreadcrumb === "subject") projectState.selectedTopicId = null;
        else selectProjectTopic(breadcrumb.dataset.projectBreadcrumb);
        renderProjectWorkspace();
        return;
    }
});

projectTopicMain.addEventListener("click", event => {
    const noteToggle = event.target.closest("[data-note-menu-toggle]");
    if(noteToggle){
        const row = noteToggle.closest(".project-content-note-row");
        const menu = row.querySelector(".project-note-menu");
        const shouldOpen = menu.classList.contains("hidden");
        projectTopicMain.querySelectorAll(".project-note-menu").forEach(item => item.classList.add("hidden"));
        projectTopicMain.querySelectorAll("[data-note-menu-toggle]").forEach(item => item.setAttribute("aria-expanded", "false"));
        menu.classList.toggle("hidden", !shouldOpen);
        noteToggle.setAttribute("aria-expanded", String(shouldOpen));
        if(shouldOpen) requestAnimationFrame(() => menu.querySelector("button:not([disabled])")?.focus());
        return;
    }
    const noteAction = event.target.closest("[data-note-action]");
    if(noteAction){
        const noteId = noteAction.dataset.noteId;
        const actionName = noteAction.dataset.noteAction;
        noteAction.closest(".project-content-note-row").querySelector("[data-note-menu-toggle]")?.focus();
        projectTopicMain.querySelectorAll(".project-note-menu").forEach(item => item.classList.add("hidden"));
        if(actionName === "rename") openProjectNoteRenameForm(noteId);
        if(actionName === "move") openProjectNoteMoveForm(noteId);
        if(actionName === "delete") confirmDeleteProjectNote(noteId);
        return;
    }
    const noteButton = event.target.closest("[data-project-note-open]");
    if(noteButton){ openProjectNote(noteButton.dataset.projectNoteOpen); return; }
    const action = event.target.closest("[data-project-later]");
    if(action) handleProjectContentAction(action);
});

projectNoteView.addEventListener("click", event => {
    const back = event.target.closest("[data-project-note-back]");
    if(back){ returnFromProjectNote(); return; }
    const edit = event.target.closest("[data-project-note-edit]");
    if(edit && projectNoteStorageReady){
        projectState.isEditingNote = true;
        renderProjectWorkspace();
        projectNoteView.querySelector("#projectNoteTitleInput")?.focus({ preventScroll: true });
        return;
    }
    const finish = event.target.closest("[data-project-note-finish-edit]");
    if(finish && projectNoteStorageReady){
        const contentInput = projectNoteView.querySelector("#projectNoteContentInput");
        if(contentInput && projectNoteTableMoveModes.has(contentInput)) projectNoteFinishTableMove(contentInput, false);
        projectState.isEditingNote = false;
        renderProjectWorkspace();
        return;
    }
    const remove = event.target.closest("[data-project-note-delete]");
    if(remove){
        confirmDeleteProjectNote(projectState.activeNoteId);
    }
});

document.addEventListener("click", event => {
    if(!event.target.closest(".project-subject-tile")){
        projectSubjectGrid.querySelectorAll(".project-subject-menu").forEach(item => item.classList.add("hidden"));
        projectSubjectGrid.querySelectorAll("[data-subject-menu-toggle]").forEach(item => item.setAttribute("aria-expanded", "false"));
    }
    if(!event.target.closest(".project-topic-row")){
        projectTopicTree.querySelectorAll(".project-topic-menu").forEach(item => item.classList.add("hidden"));
        projectTopicTree.querySelectorAll("[data-topic-menu-toggle]").forEach(item => item.setAttribute("aria-expanded", "false"));
    }
    if(!event.target.closest(".project-note-row")){
        projectTopicTree.querySelectorAll(".project-note-menu").forEach(item => item.classList.add("hidden"));
        projectTopicTree.querySelectorAll("[data-note-menu-toggle]").forEach(item => item.setAttribute("aria-expanded", "false"));
    }
    if(!event.target.closest(".project-content-note-row")){
        projectTopicMain.querySelectorAll(".project-note-menu").forEach(item => item.classList.add("hidden"));
        projectTopicMain.querySelectorAll("[data-note-menu-toggle]").forEach(item => item.setAttribute("aria-expanded", "false"));
    }
    if(!event.target.closest(".project-content-resource")){
        projectTopicDetail.querySelectorAll(".project-resource-menu").forEach(item => item.classList.add("hidden"));
        projectTopicDetail.querySelectorAll("[data-resource-menu-toggle]").forEach(item => item.setAttribute("aria-expanded", "false"));
    }
});

document.addEventListener("keydown", event => {
    if(projectDialog.classList.contains("hidden")) return;
    if(event.key === "Tab"){
        const focusable = [...projectDialogPanel.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")];
        if(!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
        else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
    }
});

document.addEventListener("keydown", event => {
    const menu = event.target.closest('[role="menu"]');
    if(!menu || menu.classList.contains("hidden") || menu.classList.contains("project-table-context-menu")) return;
    const items = [...menu.querySelectorAll("button:not([disabled])")];
    const index = items.indexOf(event.target);
    if(event.key === "ArrowDown" || event.key === "ArrowUp"){
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        items[(index + direction + items.length) % items.length]?.focus();
    }else if(event.key === "Home" || event.key === "End"){
        event.preventDefault();
        (event.key === "Home" ? items[0] : items[items.length - 1])?.focus();
    }
});

function initializeProjectWorkspace(){
    projectTopicRecords.forEach(topic => {
        if(topic.parentId && !projectTopicRecords.some(parent => parent.id === topic.parentId && parent.subjectId === topic.subjectId)){
            topic.parentId = null;
        }
    });
    const parentGroups = new Map();
    projectTopicRecords.forEach(topic => {
        const key = `${topic.subjectId}\u0000${topic.parentId || ""}`;
        if(!parentGroups.has(key)) parentGroups.set(key, { subjectId: topic.subjectId, parentId: topic.parentId });
    });
    parentGroups.forEach(group => normalizeProjectSiblingOrder(group.parentId, group.subjectId));
    saveProjectTopics();
    closeProjectTreeDrawer();
    renderProjectHome();
}

window.addEventListener("resize", () => {
    const isMobile = window.matchMedia && window.matchMedia("(max-width: 799px)").matches;
    if(!isMobile){
        closeProjectTreeDrawer();
    }else if(!projectTopicSidebar.classList.contains("is-open")){
        projectTopicSidebar.inert = true;
        projectTopicSidebar.setAttribute("aria-hidden", "true");
    }
});

initializeProjectWorkspace();

const appHealthRunButton = document.getElementById("appHealthRunButton");
const appHealthOverall = document.getElementById("appHealthOverall");
const appHealthLastRun = document.getElementById("appHealthLastRun");
const appHealthResults = document.getElementById("appHealthResults");

function createAppHealthResult(name, status, detail, guidance = "", critical = false){
    return { name, status, detail, guidance, critical };
}

function checkAppHealthLocalStorage(){
    const expectedKeys = [
        ["ironMindSubjects", Array.isArray],
        ["ironMindTasks", Array.isArray],
        ["ironMindSettings", value => value && typeof value === "object" && !Array.isArray(value)],
        ["ironMindProjectTopics", Array.isArray],
        ["ironMindProjectSubjectIds", value => value && typeof value === "object" && !Array.isArray(value)],
        ["ironMindProjectSubjects", Array.isArray],
        ["ironMindProjectNotes", Array.isArray],
        ["ironMindProjectExpandedTopics", value => value && typeof value === "object" && !Array.isArray(value)]
    ];
    let missing = 0;
    let invalid = 0;
    try{
        const storage = workspaceStorage;
        expectedKeys.forEach(([key, validate]) => {
            const rawValue = storage.getItem(key);
            if(rawValue === null){ missing += 1; return; }
            try{
                if(!validate(JSON.parse(rawValue))) invalid += 1;
            }catch(error){ invalid += 1; }
        });
    }catch(error){
        return createAppHealthResult(
            "Local data access", "fail",
            "The browser blocked access to IRON MIND localStorage.",
            "Check the browser’s site storage permissions and available disk space.", true
        );
    }
    if(invalid){
        return createAppHealthResult(
            "Local data readability", "fail",
            `${invalid} expected data ${invalid === 1 ? "entry has" : "entries have"} invalid JSON or an unexpected structure. No stored values are shown.`,
            "Avoid clearing site data. Export any accessible backup and review the affected browser storage before continuing.", true
        );
    }
    return createAppHealthResult(
        "Local data access", "pass",
        `LocalStorage is readable; ${8 - missing} of 8 expected keys are present and valid, and ${missing} have not been created yet. Stored contents are not displayed.`
    );
}

function checkAppHealthIntegrity(){
    const requiredElements = [
        "homePage", "subjectPage", "taskModal", "taskContainer", "projectPage",
        "projectSubjectWorkspace", "projectDialog", "settingsOverlay", "settingsPanel"
    ];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    const requiredModules = [
        ["showTab", typeof showTab === "function"],
        ["openTaskModal", typeof openTaskModal === "function"],
        ["Project workspace", typeof initializeProjectWorkspace === "function" && typeof openProjectSearchPopup === "function"],
        ["note editor", typeof openProjectNoteTitleForm === "function" && typeof renderProjectNoteView === "function"]
    ];
    const missingModules = requiredModules.filter(([, available]) => !available).map(([name]) => name);
    if(missingElements.length || missingModules.length){
        const details = [
            missingElements.length ? `${missingElements.length} essential interface element(s) are missing` : "",
            missingModules.length ? `Unavailable app module(s): ${missingModules.join(", ")}` : ""
        ].filter(Boolean).join(". ");
        return createAppHealthResult(
            "Application integrity", "fail", details,
            "Reload the application. If the issue remains, update or restore the application files.", true
        );
    }
    return createAppHealthResult(
        "Application integrity", "pass",
        "Essential task, Project, Settings, and note interfaces and modules are available."
    );
}

function checkAppHealthRuntime(){
    const missingCore = [
        ["Promise", typeof window.Promise === "function"],
        ["Map", typeof window.Map === "function"],
        ["Set", typeof window.Set === "function"]
    ].filter(([, available]) => !available).map(([name]) => name);
    const results = [];
    if(missingCore.length){
        results.push(createAppHealthResult(
            "Browser runtime", "fail", `Required JavaScript APIs are unavailable: ${missingCore.join(", ")}.`,
            "Use a current desktop browser to run IRON MIND.", true
        ));
    }else{
        results.push(createAppHealthResult("Browser runtime", "pass", "Core JavaScript APIs used by the application are available."));
    }
    if(typeof window.FileReader !== "function" || typeof window.Blob !== "function"){
        results.push(createAppHealthResult(
            "File handling APIs", "warning", "FileReader or Blob support is unavailable; image and resource file features may not work.",
            "Use a current browser with local file APIs enabled."
        ));
    }else{
        results.push(createAppHealthResult("File handling APIs", "pass", "Browser file APIs used by images and resources are available."));
    }
    const mathLiveAvailable = typeof window.MathfieldElement === "function" &&
        window.customElements && window.customElements.get("math-field");
    results.push(mathLiveAvailable
        ? createAppHealthResult("Bundled MathLive library", "pass", "The bundled equation editor is registered and available.")
        : createAppHealthResult("Bundled MathLive library", "warning", "The bundled equation editor is unavailable; equation editing may not work.", "Check that the local vendor/mathlive files are present and reload the app."));
    if(appHealthRuntimeIssues.length){
        results.push(createAppHealthResult(
            "Runtime errors", "warning",
            `${appHealthRuntimeIssues.length} same-origin script error(s) or unhandled promise rejection(s) have occurred since this page loaded. Error text is omitted.`,
            "If a feature is not working, inspect the browser console and reload the application."
        ));
    }else{
        results.push(createAppHealthResult("Runtime errors", "pass", "No same-origin script errors or unhandled promise rejections have been observed since page load."));
    }
    if(!window.indexedDB){
        results.push(createAppHealthResult(
            "IndexedDB API", "warning", "IndexedDB is unavailable; resource storage and retrieval may not work.",
            "Use a browser that supports IndexedDB."
        ));
    }else{
        results.push(createAppHealthResult("IndexedDB API", "pass", "The browser provides IndexedDB."));
    }
    return results;
}

async function checkAppHealthResourcesDatabase(){
    if(!window.indexedDB){
        return createAppHealthResult("Resource database", "warning", "IndexedDB is unavailable, so the resource database cannot be checked.", "Resource files may not be available in this browser.");
    }
    if(typeof window.indexedDB.databases !== "function"){
        return createAppHealthResult("Resource database", "not-available", "This browser cannot safely list existing databases; no database was opened or created.");
    }
    let databaseList;
    try{
        databaseList = await window.indexedDB.databases();
    }catch(error){
        return createAppHealthResult("Resource database", "not-available", "The browser did not allow a safe database listing; no database was opened or modified.");
    }
    if(!databaseList.some(database => database.name === PROJECT_RESOURCES_DB_NAME)){
        return createAppHealthResult("Resource database", "pass", "No Project resource database exists yet; it will be initialized when resources are first used.");
    }
    let database;
    let schemaChangeRefused = false;
    try{
        database = await new Promise((resolve, reject) => {
            const request = window.indexedDB.open(PROJECT_RESOURCES_DB_NAME);
            request.onupgradeneeded = () => {
                schemaChangeRefused = true;
                try{ request.transaction.abort(); }catch(error){ /* Prevent any schema creation if the database changed during the check. */ }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("Database open failed"));
            request.onblocked = () => reject(new Error("Database open was blocked"));
        });
        const hasStore = database.objectStoreNames.contains(PROJECT_RESOURCE_STORE);
        let hasOwnerIndex = false;
        if(hasStore){
            const transaction = database.transaction(PROJECT_RESOURCE_STORE, "readonly");
            hasOwnerIndex = transaction.objectStore(PROJECT_RESOURCE_STORE).indexNames.contains("byOwner");
        }
        database.close();
        if(!hasStore){
            return createAppHealthResult("Resource database", "fail", "The existing database is missing its required resources object store.", "Do not clear site data. Keep this browser profile intact and seek help recovering the local resource database.", true);
        }
        if(!hasOwnerIndex){
            return createAppHealthResult("Resource database", "fail", "The resources store is missing its required byOwner index.", "Do not clear site data. Keep this browser profile intact and seek help repairing the local resource database.", true);
        }
        return createAppHealthResult("Resource database", "pass", "The existing database opens read-only and contains the expected resources store and index.");
    }catch(error){
        database?.close();
        if(schemaChangeRefused){
            return createAppHealthResult("Resource database", "not-available", "The database changed during the read-only check. The diagnostic stopped before making a schema change.");
        }
        return createAppHealthResult("Resource database", "fail", "The existing Project resource database could not be opened safely.", "Close other IRON MIND tabs and retry. Do not clear site data if resource files are important.", true);
    }
}

async function checkAppHealthStorageCapacity(){
    if(!navigator.storage || typeof navigator.storage.estimate !== "function"){
        return createAppHealthResult("Storage capacity", "not-available", "This browser does not report origin storage usage and quota.");
    }
    try{
        const estimate = await navigator.storage.estimate();
        const usage = Number(estimate.usage);
        const quota = Number(estimate.quota);
        if(!Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0){
            return createAppHealthResult("Storage capacity", "not-available", "The browser did not provide reliable usage and quota figures.");
        }
        const percent = Math.min(100, (usage / quota) * 100);
        const formattedUsage = formatAppHealthBytes(usage);
        const formattedQuota = formatAppHealthBytes(quota);
        const formattedAvailable = formatAppHealthBytes(Math.max(0, quota - usage));
        if(percent >= 80){
            return createAppHealthResult(
                "Storage capacity", "warning",
                `About ${formattedUsage} is used and ${formattedAvailable} remains of ${formattedQuota} (${Math.round(percent)}% used). Browser figures are estimates and may include other data from this site origin.`,
                "Export an app backup and free space only after confirming what other origin data can be safely removed."
            );
        }
        return createAppHealthResult(
            "Storage capacity", "pass",
            `About ${formattedUsage} is used and ${formattedAvailable} remains of ${formattedQuota} (${Math.round(percent)}% used). Browser figures are estimates and may include other data from this site origin.`
        );
    }catch(error){
        return createAppHealthResult("Storage capacity", "warning", "The browser’s storage estimate could not be read.", "This does not confirm a storage failure; check browser storage settings if saves are failing.");
    }
}

function formatAppHealthBytes(value){
    const units = ["B", "KB", "MB", "GB", "TB"];
    let amount = Math.max(0, value);
    let unit = 0;
    while(amount >= 1024 && unit < units.length - 1){ amount /= 1024; unit += 1; }
    return `${amount.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function renderAppHealthResults(results, completedAt){
    const failed = results.some(result => result.status === "fail");
    const warned = results.some(result => result.status === "warning");
    const overall = failed
        ? (results.some(result => result.status === "fail" && result.critical) ? "Critical" : "Needs Attention")
        : warned ? "Needs Attention" : "Healthy";
    appHealthOverall.textContent = overall;
    appHealthOverall.dataset.status = overall.toLowerCase().replaceAll(" ", "-");
    appHealthResults.replaceChildren();
    results.forEach(result => {
        const item = document.createElement("li");
        item.className = "app-health-result";
        item.dataset.status = result.status;
        const heading = document.createElement("div");
        heading.className = "app-health-result-heading";
        const name = document.createElement("strong");
        name.textContent = result.name;
        const status = document.createElement("span");
        status.className = "app-health-status";
        status.textContent = result.status === "not-available" ? "Not Available" : result.status[0].toUpperCase() + result.status.slice(1);
        heading.append(name, status);
        const detail = document.createElement("p");
        detail.textContent = result.detail;
        item.append(heading, detail);
        if(result.guidance){
            const guidance = document.createElement("p");
            guidance.className = "app-health-guidance";
            guidance.textContent = result.guidance;
            item.append(guidance);
        }
        appHealthResults.append(item);
    });
    appHealthLastRun.textContent = `Last run: ${completedAt.toLocaleString()}`;
}

async function runAppHealthDiagnostics(){
    appHealthRunButton.disabled = true;
    appHealthRunButton.textContent = "Checking…";
    try{
        const results = [
            checkAppHealthIntegrity(),
            checkAppHealthLocalStorage(),
            ...checkAppHealthRuntime(),
            await checkAppHealthResourcesDatabase(),
            await checkAppHealthStorageCapacity()
        ];
        renderAppHealthResults(results, new Date());
    }catch(error){
        renderAppHealthResults([
            createAppHealthResult("Diagnostics", "warning", "The diagnostic run could not complete. No application data was changed.", "Retry the check. If the problem continues, inspect the browser console.")
        ], new Date());
    }finally{
        appHealthRunButton.disabled = false;
        appHealthRunButton.textContent = "Run Diagnostics";
    }
}

appHealthRunButton?.addEventListener("click", runAppHealthDiagnostics);
backupRecoveryButton?.addEventListener("click", recoverFailedBackupRestore);
updateRecycleBinCount();
cleanupExpiredRecycleBin({ report: false });
