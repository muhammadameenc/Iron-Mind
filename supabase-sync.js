/* Manual, local-first sync for tasks, settings, and Project subjects/topics. */
(function setupIronMindCloudSync(){
    "use strict";

    const workspace = window.IRON_MIND_WORKSPACE;
    const panel = document.getElementById("cloudSyncPanel");
    const statusElement = document.getElementById("cloudSyncStatus");
    const accountElement = document.getElementById("cloudSyncAccount");
    const syncButton = document.getElementById("cloudSyncNowButton");
    const previewPanel = document.getElementById("cloudSyncPreview");
    const previewDetails = document.getElementById("cloudSyncPreviewDetails");
    const previewRecords = document.getElementById("cloudSyncPreviewRecords");
    const confirmButton = document.getElementById("cloudSyncConfirmButton");
    const cancelButton = document.getElementById("cloudSyncCancelButton");
    const accountActionButtons = [
        "supabaseSignOutButton",
        "copyDeviceWorkspaceButton",
        "openDeviceWorkspaceButton",
        "openAccountWorkspaceButton"
    ].map(id => document.getElementById(id)).filter(Boolean);
    const SYNC_STATE_KEY = "ironMindCloudSyncState";
    const LOCAL_TOMBSTONES_KEY = "ironMindCloudTombstones";
    const VALID_STATUSES = new Set(["Planned", "Halfway", "Completed", "Missed"]);

    if(!workspace || !panel || !statusElement || !syncButton || !previewPanel || !previewDetails || !previewRecords || !confirmButton || !cancelButton) return;

    let busy = false;
    let pendingUpload = null;
    let authGeneration = 0;

    class SyncConflictError extends Error{}
    class SyncAuthError extends Error{}
    class ProjectDeletionConflict extends SyncConflictError{
        constructor(label, recordId, localHasRecord, cloudHasRecord, survivorMatchesBaseline = null){
            const missingFrom = localHasRecord ? "cloud" : cloudHasRecord ? "local workspace" : "both local and cloud data";
            const comparison = survivorMatchesBaseline === true
                ? "; the surviving record matches the saved baseline"
                : survivorMatchesBaseline === false ? "; the surviving record differs from the saved baseline" : "";
            super(`Saved Project baseline ${label} ID ${recordId} is missing from ${missingFrom}${comparison}.`);
            this.label = label;
            this.recordId = recordId;
            this.localHasRecord = localHasRecord;
            this.cloudHasRecord = cloudHasRecord;
            this.survivorMatchesBaseline = survivorMatchesBaseline;
        }
    }

    function setStatus(state, message){
        statusElement.dataset.syncState = state;
        statusElement.textContent = message;
    }

    function accountId(){
        return workspace.userId && workspace.userId === workspace.authenticatedUserId
            ? workspace.userId
            : null;
    }

    function canUseAccountWorkspace(){
        return Boolean(workspace.authAvailable && accountId());
    }

    function assertOperationIdentity(userId, generation){
        if(generation !== authGeneration || !canUseAccountWorkspace() || accountId() !== userId){
            throw new SyncAuthError("The signed-in account changed during sync. Retry from its matching local workspace.");
        }
    }

    function updateControls(){
        const ready = canUseAccountWorkspace();
        panel.classList.toggle("hidden", !ready);
        syncButton.disabled = busy || !ready;
        confirmButton.disabled = busy || !ready || !pendingUpload?.fingerprint || !pendingUpload?.cloudFingerprint;
        cancelButton.disabled = busy;
        accountActionButtons.forEach(button => { button.disabled = busy || !ready; });
        if(accountElement && ready){
            const email = workspace.session?.user?.email;
            accountElement.textContent = email
                ? `Sync target: ${email} (${accountId()})`
                : `Sync target account ID: ${accountId()}`;
        }
    }

    function setBusy(value){
        busy = value;
        updateControls();
    }

    function setOfflineStatus(){
        if(navigator.onLine === false){
            setStatus("offline", "Offline. Tasks, subjects, Projects, topics, and settings remain available locally.");
            return true;
        }
        return false;
    }

    function stableValue(value){
        if(Array.isArray(value)) return value.map(stableValue);
        if(value && typeof value === "object"){
            const result = {};
            Object.keys(value).sort().forEach(key => {
                if(value[key] !== undefined) result[key] = stableValue(value[key]);
            });
            return result;
        }
        return value;
    }

    async function signature(value){
        if(!window.crypto?.subtle || typeof TextEncoder !== "function"){
            throw new Error("Secure change checking is unavailable in this browser.");
        }
        const bytes = new TextEncoder().encode(JSON.stringify(stableValue(value)));
        const digest = await window.crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    }

    function normalizeSubjectName(value){
        return String(value || "").trim().toLowerCase();
    }

    function isUuid(value){
        return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }

    function validateTopicSiblingOrder(topics, label){
        const occupiedOrders = new Set();
        topics.forEach(topic => {
            const group = JSON.stringify([topic.canonical.subjectId, topic.canonical.parentId]);
            const key = JSON.stringify([group, topic.canonical.order]);
            if(occupiedOrders.has(key)) throw new SyncConflictError(`${label} Project topics have ambiguous sibling order; resolve the order before syncing.`);
            occupiedOrders.add(key);
        });
    }

    function toIsoDate(value){
        if(value === null || value === undefined || value === "") return null;
        const raw = String(value).trim();
        let year, month, day, match;
        if((match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/))){
            year = Number(match[1]); month = Number(match[2]); day = Number(match[3]);
        }else if((match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/))){
            day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
        }else{
            throw new SyncConflictError("A task has a date format that cannot be safely synchronized.");
        }
        const date = new Date(Date.UTC(year, month - 1, day));
        if(date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day){
            throw new SyncConflictError("A task has an invalid calendar date; no data was changed.");
        }
        return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    function fromIsoDate(value){
        if(!value) return "";
        const iso = toIsoDate(value);
        const [year, month, day] = iso.split("-");
        return `${day}-${month}-${year}`;
    }

    function parseStoredSettings(){
        let raw;
        try{ raw = workspace.storage.getItem("ironMindSettings"); }
        catch(error){ throw new Error("Local settings could not be read. No cloud operation was started."); }
        if(raw === null) return null;
        try{
            const value = JSON.parse(raw);
            if(!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid settings object.");
            return value;
        }catch(error){
            throw new SyncConflictError("Local settings are unreadable; resolve the local data issue before syncing.");
        }
    }

    function addRecycleDeletionMarkers(markers, entry){
        const put = (type, value) => {
            if(value !== null && value !== undefined && String(value)) markers[`${type}:${String(value)}`] = true;
        };
        const payload = entry?.payload || {};
        if(entry?.type === "task") put("task", payload.task?.id);
        else if(entry?.type === "subject"){
            const subject = payload.subject;
            put("task_subject", subject?.id || `name:${normalizeSubjectName(subject?.name)}`);
            (payload.tasks || []).forEach(task => put("task", task?.id));
        }else if(entry?.type === "projectSubject"){
            put("project_subject", payload.subject?.id);
            (payload.topics || []).forEach(topic => put("project_topic", topic?.id));
        }else if(entry?.type === "topic") (payload.topics || []).forEach(topic => put("project_topic", topic?.id));
    }

    function readLocalTombstones(){
        let markers = {};
        try{
            const raw = workspace.storage.getItem(LOCAL_TOMBSTONES_KEY);
            if(raw !== null){
                markers = JSON.parse(raw);
                if(!markers || typeof markers !== "object" || Array.isArray(markers) ||
                    Object.values(markers).some(value => typeof value !== "boolean")) throw new Error("Invalid tombstone state.");
            }
            const recycleRaw = workspace.storage.getItem("ironMindRecycleBin");
            if(recycleRaw !== null){
                const entries = JSON.parse(recycleRaw);
                if(!Array.isArray(entries)) throw new Error("Invalid Recycle Bin.");
                entries.forEach(entry => addRecycleDeletionMarkers(markers, entry));
            }
            const result = new Map(Object.entries(markers));
            result.needsPersist = raw !== null ? JSON.stringify(markers) !== raw : Object.keys(markers).length > 0;
            return result;
        }catch(error){
            throw new SyncConflictError("Local deletion records or Recycle Bin are unreadable. Resolve that local data issue before syncing.");
        }
    }

    function makeLocalData(subjectRows, taskRows, settings, projectSubjectRows, projectTopicRows){
        const localSubjects = new Map();
        const localSubjectsByName = new Map();
        if(!Array.isArray(subjectRows) || !Array.isArray(taskRows) || !Array.isArray(projectSubjectRows) || !Array.isArray(projectTopicRows)){
            throw new SyncConflictError("Local tasks or subjects are not in the expected format.");
        }
        subjectRows.forEach(subject => {
            if(!subject || typeof subject.name !== "string" || !subject.name.trim()){
                throw new SyncConflictError("A local task subject is invalid; no data was changed.");
            }
            const nameKey = normalizeSubjectName(subject.name);
            const key = isUuid(subject.id) ? subject.id : `legacy:${nameKey}`;
            if(localSubjectsByName.has(nameKey) || localSubjects.has(key)) throw new SyncConflictError("Local task subjects contain duplicate names or IDs; no data was changed.");
            const row = {
                key,
                id:isUuid(subject.id) ? subject.id : null,
                nameKey,
                canonical:{ name:subject.name, priority:String(subject.priority || "high") },
                original:subject
            };
            localSubjects.set(key, row);
            localSubjectsByName.set(nameKey, row);
        });

        const localTasks = new Map();
        taskRows.forEach(task => {
            if(!task || (typeof task.id !== "number" && typeof task.id !== "string") || String(task.id) === ""){
                throw new SyncConflictError("A local task has no stable ID; no data was changed.");
            }
            const key = String(task.id);
            if(localTasks.has(key)) throw new SyncConflictError("Local tasks contain duplicate IDs; no data was changed.");
            const subject = localSubjectsByName.get(normalizeSubjectName(task.subject));
            if(!subject) throw new SyncConflictError("A local task refers to a missing subject; no data was changed.");
            if(!VALID_STATUSES.has(task.status)) throw new SyncConflictError("A local task has an unsupported status; no data was changed.");
            localTasks.set(key, {
                key,
                canonical:{
                    subject:subject.canonical.name,
                    topic:String(task.topic ?? ""),
                    source:String(task.source ?? ""),
                    task_date:toIsoDate(task.task_date),
                    status:task.status,
                    remarks:String(task.remarks ?? "")
                },
                original:task
            });
        });

        if(settings !== null && (!settings || typeof settings !== "object" || Array.isArray(settings))){
            throw new SyncConflictError("Local settings are not an object; no data was changed.");
        }

        const localProjectSubjects = new Map();
        const localProjectNames = new Set();
        projectSubjectRows.forEach(subject => {
            if(!subject || !isUuid(subject.id) || typeof subject.name !== "string" || !subject.name.trim()){
                throw new SyncConflictError("A Project subject is invalid or has an ID the cloud schema cannot preserve; no data was changed.");
            }
            const key = subject.id;
            const nameKey = normalizeSubjectName(subject.name);
            if(localProjectSubjects.has(key)) throw new SyncConflictError("Local Project subjects contain duplicate IDs; no data was changed.");
            if(localProjectNames.has(nameKey)) throw new SyncConflictError("Local Project subjects contain duplicate names; no data was changed.");
            localProjectNames.add(nameKey);
            localProjectSubjects.set(key, {
                key,
                id:subject.id,
                canonical:{ name:subject.name, priority:String(subject.priority || "high") },
                original:subject
            });
        });

        const localProjectTopics = new Map();
        const localTopicNames = new Set();
        projectTopicRows.forEach(topic => {
            if(!topic || !isUuid(topic.id) || !isUuid(topic.subjectId) ||
                (topic.parentId !== null && topic.parentId !== undefined && !isUuid(topic.parentId)) ||
                typeof topic.name !== "string" || !topic.name.trim() ||
                !Number.isInteger(Number(topic.order)) || Number(topic.order) < 0){
                throw new SyncConflictError("A Project topic has invalid IDs, a name, or an order; no data was changed.");
            }
            const key = topic.id;
            if(localProjectTopics.has(key)) throw new SyncConflictError("Local Project topics contain duplicate IDs; no data was changed.");
            if(!localProjectSubjects.has(topic.subjectId)) throw new SyncConflictError("A Project topic refers to a missing subject; no data was changed.");
            if(topic.parentId && !projectTopicRows.some(parent => parent?.id === topic.parentId && parent.subjectId === topic.subjectId)){
                throw new SyncConflictError("A Project subtopic refers to a missing or different-subject parent; no data was changed.");
            }
            const nameKey = JSON.stringify([topic.subjectId, topic.parentId || null, normalizeSubjectName(topic.name)]);
            if(localTopicNames.has(nameKey)) throw new SyncConflictError("Project topics contain duplicate sibling names; no data was changed.");
            localTopicNames.add(nameKey);
            localProjectTopics.set(key, {
                key,
                id:topic.id,
                canonical:{ subjectId:topic.subjectId, parentId:topic.parentId || null, name:topic.name, order:Number(topic.order) },
                original:topic
            });
        });
        localProjectTopics.forEach(topic => {
            const seen = new Set([topic.id]);
            let parentId = topic.canonical.parentId;
            while(parentId){
                if(seen.has(parentId)) throw new SyncConflictError("Project topics contain a parent cycle; no data was changed.");
                seen.add(parentId);
                parentId = localProjectTopics.get(parentId)?.canonical.parentId || null;
            }
        });
        validateTopicSiblingOrder(localProjectTopics, "Local");
        return {
            subjects:localSubjects,
            subjectsByName:localSubjectsByName,
            tasks:localTasks,
            settings,
            projectSubjects:localProjectSubjects,
            projectTopics:localProjectTopics
        };
    }

    function readLocalData(){
        function verifyStoredRows(key, currentRows, label){
            let raw;
            try{ raw = workspace.storage.getItem(key); }
            catch(error){ throw new Error(`Local ${label} could not be read. No cloud operation was started.`); }
            if(raw === null){
                if(currentRows.length) throw new SyncConflictError(`Local ${label} changed or was removed outside this tab. Reload before syncing.`);
                return;
            }
            let storedRows;
            try{ storedRows = JSON.parse(raw); }
            catch(error){ throw new SyncConflictError(`Local ${label} are unreadable. Resolve the local data issue before syncing.`); }
            if(!Array.isArray(storedRows) || JSON.stringify(stableValue(storedRows)) !== JSON.stringify(stableValue(currentRows))){
                throw new SyncConflictError(`Local ${label} changed in another tab or is not saved in this tab. Reload before syncing.`);
            }
        }

        const localSubjects = Array.isArray(subjects) ? subjects : [];
        const localTasks = Array.isArray(tasks) ? tasks : [];
        verifyStoredRows("ironMindSubjects", localSubjects, "task subjects");
        verifyStoredRows("ironMindTasks", localTasks, "tasks");
        const localProjectSubjects = Array.isArray(projectSubjectRecords) ? projectSubjectRecords : [];
        const localProjectTopics = Array.isArray(projectTopicRecords) ? projectTopicRecords : [];
        verifyStoredRows("ironMindProjectSubjects", localProjectSubjects, "Project subjects");
        verifyStoredRows("ironMindProjectTopics", localProjectTopics, "Project topics");
        const local = makeLocalData(
            localSubjects,
            localTasks,
            parseStoredSettings(),
            localProjectSubjects,
            localProjectTopics
        );
        local.tombstones = readLocalTombstones();
        local.changedTombstones = Boolean(local.tombstones.needsPersist);
        return local;
    }

    function newSyncUuid(){
        if(typeof window.crypto?.randomUUID !== "function") throw new SyncConflictError("Stable task-subject IDs are unavailable in this browser; no cloud records were changed.");
        return window.crypto.randomUUID();
    }

    function alignTaskSubjectIds(local, cloud){
        let changed = false;
        const rows = [...local.subjects.values()].map(row => {
            const namedCloudRow = cloud.subjectsByName.get(row.nameKey);
            const id = namedCloudRow?.id || row.id || newSyncUuid();
            if(row.original.id !== id) changed = true;
            return { ...row.original, id };
        });
        const aligned = makeLocalData(
            rows,
            [...local.tasks.values()].map(row => row.original),
            local.settings,
            [...local.projectSubjects.values()].map(row => row.original),
            [...local.projectTopics.values()].map(row => row.original)
        );
        aligned.tombstones = local.tombstones;
        aligned.changedSubjects = changed;
        return aligned;
    }

    function remapLegacyTaskSubjectBaseline(state, local, cloud){
        if(!state?.baseline?.subjects || typeof state.baseline.subjects !== "object") return {};
        const mapped = {};
        for(const [key, value] of Object.entries(state.baseline.subjects)){
            if(cloud.subjects.has(key) || isUuid(key)){
                mapped[key] = value;
                continue;
            }
            const match = cloud.subjectsByName.get(normalizeSubjectName(key)) || local.subjectsByName.get(normalizeSubjectName(key));
            mapped[match?.id || key] = value;
        }
        return mapped;
    }

    function remapLegacySubjectTombstones(local, cloud){
        const mapped = new Map();
        let changed = false;
        for(const [identity, deleted] of local.tombstones){
            const prefix = "task_subject:name:";
            if(identity.startsWith(prefix)){
                const name = identity.slice(prefix.length);
                const match = local.subjectsByName.get(normalizeSubjectName(name)) || cloud.subjectsByName.get(normalizeSubjectName(name));
                if(match){ mapped.set(`task_subject:${match.id}`, deleted); changed = true; continue; }
            }
            mapped.set(identity, deleted);
        }
        local.tombstones = mapped;
        local.changedTombstones = Boolean(local.changedTombstones || changed);
    }

    async function getVerifiedClient(){
        if(!canUseAccountWorkspace()) throw new SyncAuthError("Sign in and open that account’s local workspace before syncing.");
        if(navigator.onLine === false) throw new Error("Offline");
        const expectedUserId = accountId();
        const generation = authGeneration;
        const client = await workspace.getClient();
        const result = await client.auth.getUser();
        if(generation !== authGeneration || result.error || result.data?.user?.id !== expectedUserId){
            throw new SyncAuthError("The current session could not be verified for this workspace. Sign in again before syncing.");
        }
        return { client, userId:expectedUserId, generation };
    }

    function checkedResult(result, message){
        if(result.error) throw new Error(message);
        return result.data;
    }

    async function readAllRows(client, table, columns, orderColumn, userId){
        const pageSize = 500;
        const rows = [];
        const tableLabels = {
            task_subjects:"task subjects",
            tasks:"tasks",
            project_subjects:"Project subjects",
            project_topics:"Project topics"
        };
        const label = tableLabels[table] || "records";
        for(let offset = 0; ; ){
            let query = client.from(table)
                .select(columns)
                .eq("user_id", userId);
            (Array.isArray(orderColumn) ? orderColumn : [orderColumn]).forEach(column => {
                query = query.order(column, { ascending:true });
            });
            const result = await query.range(offset, offset + pageSize - 1);
            const page = checkedResult(result, `Cloud ${label} could not be read.`) || [];
            if(!Array.isArray(page)) throw new SyncConflictError("The cloud returned an unexpected page of records.");
            if(page.length === 0) return rows;
            rows.push(...page);
            offset += page.length;
        }
    }

    async function readCloudData(client, userId){
        const [subjectRows, taskRows, settingsResult, projectSubjectRows, projectTopicRows, tombstoneRows, syncStateResult, noteReferences, resourceReferences] = await Promise.all([
            readAllRows(client, "task_subjects", "id,user_id,name,priority,revision,sync_generation", "id", userId),
            readAllRows(client, "tasks", "id,user_id,subject_id,legacy_id,topic,source,task_date,status,remarks,revision,sync_generation", "id", userId),
            client.from("user_settings")
                .select("user_id,settings,revision,sync_generation")
                .eq("user_id", userId)
                .limit(2),
            readAllRows(client, "project_subjects", "id,user_id,name,priority,revision,created_at,sync_generation", ["created_at", "id"], userId),
            readAllRows(client, "project_topics", "id,user_id,subject_id,parent_id,name,sort_order,revision,sync_generation", "id", userId),
            readAllRows(client, "sync_tombstones", "user_id,entity_type,entity_key,is_deleted,revision,sync_generation", ["entity_type", "entity_key"], userId),
            client.from("user_sync_state").select("user_id,reset_generation,revision").eq("user_id", userId).limit(2),
            readAllRows(client, "notes", "id,user_id,subject_id,topic_id", "id", userId),
            readAllRows(client, "resource_metadata", "id,user_id,subject_id,topic_id", "id", userId)
        ]);
        const settingsRows = checkedResult(settingsResult, "Cloud settings could not be read.") || [];
        const syncStateRows = checkedResult(syncStateResult, "Cloud sync reset state could not be read.") || [];
        if(!Array.isArray(subjectRows) || !Array.isArray(taskRows) || !Array.isArray(settingsRows) || settingsRows.length > 1 ||
            !Array.isArray(projectSubjectRows) || !Array.isArray(projectTopicRows) || !Array.isArray(tombstoneRows) ||
            !Array.isArray(syncStateRows) || syncStateRows.length > 1 || !Array.isArray(noteReferences) || !Array.isArray(resourceReferences)){
            throw new SyncConflictError("The cloud returned an unexpected data shape; no local data was changed.");
        }
        const syncStateRow = syncStateRows.length ? syncStateRows[0] : null;
        if(syncStateRow && (syncStateRow.user_id !== userId || !Number.isSafeInteger(Number(syncStateRow.reset_generation)) || Number(syncStateRow.reset_generation) < 0)){
            throw new SyncConflictError("Cloud sync reset state could not be verified.");
        }
        const resetGeneration = syncStateRow ? Number(syncStateRow.reset_generation) : 0;
        if(noteReferences.some(row => row.user_id !== userId) || resourceReferences.some(row => row.user_id !== userId)){
            throw new SyncConflictError("Cloud Project dependencies could not be verified as belonging to this account.");
        }

        const cloudSubjects = new Map();
        const cloudSubjectsByName = new Map();
        const subjectsById = new Map();
        subjectRows.forEach(subject => {
            if(subject.user_id !== userId || !subject.id || typeof subject.name !== "string" || Number(subject.sync_generation) !== resetGeneration){
                throw new SyncConflictError("Cloud subject ownership or shape could not be verified.");
            }
            const nameKey = normalizeSubjectName(subject.name);
            if(!nameKey || !isUuid(subject.id) || cloudSubjects.has(subject.id) || cloudSubjectsByName.has(nameKey)) throw new SyncConflictError("Cloud task subjects contain an ID or name conflict.");
            const record = { key:subject.id, id:subject.id, nameKey, revision:Number(subject.revision), canonical:{ name:subject.name, priority:String(subject.priority || "high") } };
            cloudSubjects.set(subject.id, record);
            cloudSubjectsByName.set(nameKey, record);
            subjectsById.set(subject.id, record);
        });

        const cloudTasks = new Map();
        taskRows.forEach(task => {
            if(task.user_id !== userId || !task.id || Number(task.sync_generation) !== resetGeneration) throw new SyncConflictError("Cloud task ownership or reset generation could not be verified.");
            const subject = subjectsById.get(task.subject_id);
            if(!subject) throw new SyncConflictError("A cloud task refers to a missing subject; no data was changed.");
            const key = String(task.legacy_id || task.id);
            if(cloudTasks.has(key)) throw new SyncConflictError("Cloud tasks contain a duplicate stable ID.");
            if(!VALID_STATUSES.has(task.status)) throw new SyncConflictError("A cloud task has an unsupported status.");
            cloudTasks.set(key, {
                key,
                id:task.id,
                legacyId:task.legacy_id ? String(task.legacy_id) : null,
                subjectId:subject.id,
                revision:Number(task.revision),
                canonical:{
                    subject:subject.canonical.name,
                    topic:String(task.topic ?? ""),
                    source:String(task.source ?? ""),
                    task_date:toIsoDate(task.task_date),
                    status:task.status,
                    remarks:String(task.remarks ?? "")
                }
            });
        });

        const tombstones = new Map();
        tombstoneRows.forEach(row => {
            const type = String(row.entity_type || "");
            const key = String(row.entity_key || "");
            if(row.user_id !== userId || Number(row.sync_generation) !== resetGeneration || !["task", "task_subject", "project_subject", "project_topic"].includes(type) || !key || typeof row.is_deleted !== "boolean"){
                throw new SyncConflictError("Cloud deletion markers have an invalid owner or shape.");
            }
            const identity = `${type}:${key}`;
            if(tombstones.has(identity)) throw new SyncConflictError("Cloud deletion markers contain duplicate identities.");
            tombstones.set(identity, { identity, type, key, deleted:row.is_deleted, revision:Number(row.revision) });
        });

        const settingsRow = settingsRows.length ? settingsRows[0] : null;
        if(settingsRow && Number(settingsRow.sync_generation) !== resetGeneration){
            throw new SyncConflictError("Cloud settings belong to a previous account reset generation.");
        }
        const settings = settingsRow ? settingsRow.settings : null;
        if(settingsRows.length && settingsRows[0].user_id !== userId){
            throw new SyncConflictError("Cloud settings ownership could not be verified.");
        }
        if(settings !== null && (!settings || typeof settings !== "object" || Array.isArray(settings))){
            throw new SyncConflictError("Cloud settings have an unexpected format.");
        }

        const cloudProjectSubjects = new Map();
        projectSubjectRows.forEach(subject => {
            if(subject.user_id !== userId || Number(subject.sync_generation) !== resetGeneration || !isUuid(subject.id) || typeof subject.name !== "string" || !subject.name.trim()){
                throw new SyncConflictError("Cloud Project subject ownership or shape could not be verified.");
            }
            if(cloudProjectSubjects.has(subject.id)) throw new SyncConflictError("Cloud Project subjects contain duplicate IDs.");
            cloudProjectSubjects.set(subject.id, {
                key:subject.id,
                id:subject.id,
                revision:Number(subject.revision),
                createdAt:subject.created_at,
                canonical:{ name:subject.name, priority:String(subject.priority || "high") }
            });
        });
        const cloudProjectTopics = new Map();
        const topicNames = new Set();
        projectTopicRows.forEach(topic => {
            if(topic.user_id !== userId || Number(topic.sync_generation) !== resetGeneration || !isUuid(topic.id) || !isUuid(topic.subject_id) ||
                (topic.parent_id !== null && !isUuid(topic.parent_id)) || typeof topic.name !== "string" || !topic.name.trim() ||
                !Number.isInteger(Number(topic.sort_order)) || Number(topic.sort_order) < 0){
                throw new SyncConflictError("Cloud Project topic ownership or shape could not be verified.");
            }
            if(cloudProjectTopics.has(topic.id)) throw new SyncConflictError("Cloud Project topics contain duplicate IDs.");
            if(!cloudProjectSubjects.has(topic.subject_id)) throw new SyncConflictError("A cloud Project topic refers to a missing subject.");
            if(topic.parent_id && !projectTopicRows.some(parent => parent.id === topic.parent_id && parent.subject_id === topic.subject_id)){
                throw new SyncConflictError("A cloud Project subtopic refers to a missing or different-subject parent.");
            }
            const nameKey = JSON.stringify([topic.subject_id, topic.parent_id, normalizeSubjectName(topic.name)]);
            if(topicNames.has(nameKey)) throw new SyncConflictError("Cloud Project topics contain duplicate sibling names.");
            topicNames.add(nameKey);
            cloudProjectTopics.set(topic.id, {
                key:topic.id,
                id:topic.id,
                revision:Number(topic.revision),
                canonical:{ subjectId:topic.subject_id, parentId:topic.parent_id, name:topic.name, order:Number(topic.sort_order) }
            });
        });
        cloudProjectTopics.forEach(topic => {
            const seen = new Set([topic.id]);
            let parentId = topic.canonical.parentId;
            while(parentId){
                if(seen.has(parentId)) throw new SyncConflictError("Cloud Project topics contain a parent cycle.");
                seen.add(parentId);
                parentId = cloudProjectTopics.get(parentId)?.canonical.parentId || null;
            }
        });
        validateTopicSiblingOrder(cloudProjectTopics, "Cloud");
        return {
            subjects:cloudSubjects,
            subjectsByName:cloudSubjectsByName,
            tasks:cloudTasks,
            settings,
            settingsRevision:settingsRow ? Number(settingsRow.revision) : null,
            projectSubjects:cloudProjectSubjects,
            projectTopics:cloudProjectTopics,
            tombstones,
            resetGeneration,
            projectDependencies:[...noteReferences, ...resourceReferences]
        };
    }

    async function signatures(map){
        const result = {};
        for(const [key, record] of map){ result[key] = await signature(record.canonical); }
        return result;
    }

    async function settingsSignature(settings){
        return settings === null ? null : signature(settings);
    }

    function mapHasRecords(data){
        return data.subjects.size > 0 || data.tasks.size > 0 || data.settings !== null || mapHasProjectRecords(data);
    }

    function mapHasProjectRecords(data){
        return data.projectSubjects.size > 0 || data.projectTopics.size > 0;
    }

    async function mapsEqual(left, right){
        if(left.size !== right.size) return false;
        const leftSigs = await signatures(left);
        const rightSigs = await signatures(right);
        return [...left.keys()].every(key => leftSigs[key] === rightSigs[key]);
    }

    async function sameData(local, cloud){
        const [subjectsMatch, tasksMatch, localSettings, cloudSettings, projectSubjectsMatch, projectTopicsMatch] = await Promise.all([
            mapsEqual(local.subjects, cloud.subjects),
            mapsEqual(local.tasks, cloud.tasks),
            settingsSignature(local.settings),
            settingsSignature(cloud.settings),
            mapsEqual(local.projectSubjects, cloud.projectSubjects),
            mapsEqual(local.projectTopics, cloud.projectTopics)
        ]);
        return subjectsMatch && tasksMatch && localSettings === cloudSettings && projectSubjectsMatch && projectTopicsMatch;
    }

    async function sameTaskAndSettingsData(left, right){
        const [subjectsMatch, tasksMatch, leftSettings, rightSettings] = await Promise.all([
            mapsEqual(left.subjects, right.subjects),
            mapsEqual(left.tasks, right.tasks),
            settingsSignature(left.settings),
            settingsSignature(right.settings)
        ]);
        return subjectsMatch && tasksMatch && leftSettings === rightSettings;
    }

    async function cloudIsMatchingSubset(local, cloud){
        for(const [key, row] of cloud.subjects){
            const localRow = local.subjects.get(key);
            if(!localRow || await signature(localRow.canonical) !== await signature(row.canonical)) return false;
        }
        for(const [key, row] of cloud.tasks){
            const localRow = local.tasks.get(key);
            if(!localRow || await signature(localRow.canonical) !== await signature(row.canonical)) return false;
        }
        if(cloud.settings !== null){
            if(local.settings === null || await settingsSignature(local.settings) !== await settingsSignature(cloud.settings)) return false;
        }
        if(!await projectMapsSubset(cloud.projectSubjects, local.projectSubjects) ||
            !await projectMapsSubset(cloud.projectTopics, local.projectTopics)) return false;
        return true;
    }

    async function projectMapsSubset(subset, superset){
        for(const [key, row] of subset){
            const matching = superset.get(key);
            if(!matching || await signature(matching.canonical) !== await signature(row.canonical)) return false;
        }
        return true;
    }

    async function projectMapsCanMerge(left, right){
        for(const [key, row] of left){
            const matching = right.get(key);
            if(matching && await signature(row.canonical) !== await signature(matching.canonical)) return false;
        }
        return true;
    }

    async function projectDataCanMerge(local, cloud){
        if(!await projectMapsCanMerge(local.projectSubjects, cloud.projectSubjects) ||
            !await projectMapsCanMerge(local.projectTopics, cloud.projectTopics)) return false;

        const mergedTopics = new Map([...cloud.projectTopics, ...local.projectTopics]);
        validateTopicSiblingOrder(mergedTopics, "Combined");
        return true;
    }

    async function sameProjectData(left, right){
        const [subjectsMatch, topicsMatch] = await Promise.all([
            mapsEqual(left.projectSubjects, right.projectSubjects),
            mapsEqual(left.projectTopics, right.projectTopics)
        ]);
        return subjectsMatch && topicsMatch;
    }

    function projectTopicOrderSignatures(topics){
        const groups = new Map();
        topics.forEach(topic => {
            const key = JSON.stringify([topic.canonical.subjectId, topic.canonical.parentId]);
            if(!groups.has(key)) groups.set(key, []);
            groups.get(key).push(topic);
        });
        const result = {};
        groups.forEach((rows, key) => {
            rows.sort((left, right) => left.canonical.order - right.canonical.order || left.id.localeCompare(right.id));
            result[key] = rows.map(row => row.id);
        });
        return result;
    }

    function validateProjectNameCollisions(local, cloud){
        const cloudSubjectNames = new Map([...cloud.projectSubjects.values()].map(row => [normalizeSubjectName(row.canonical.name), row.id]));
        local.projectSubjects.forEach(row => {
            const existingId = cloudSubjectNames.get(normalizeSubjectName(row.canonical.name));
            if(existingId && existingId !== row.id){
                throw new SyncConflictError("A Project subject with the same name has a different ID on each side. Review the two records before syncing.");
            }
        });

        const siblingKey = row => JSON.stringify([
            row.canonical.subjectId,
            row.canonical.parentId,
            normalizeSubjectName(row.canonical.name)
        ]);
        const cloudTopicNames = new Map([...cloud.projectTopics.values()].map(row => [siblingKey(row), row.id]));
        local.projectTopics.forEach(row => {
            const existingId = cloudTopicNames.get(siblingKey(row));
            if(existingId && existingId !== row.id){
                throw new SyncConflictError("A Project topic with the same parent and name has a different ID on each side. Review the two records before syncing.");
            }
        });
    }

    async function datasetFingerprint(local){
        const subjectsList = [...local.subjects].sort(([a], [b]) => a.localeCompare(b)).map(([key, row]) => [key, row.canonical]);
        const tasksList = [...local.tasks].sort(([a], [b]) => a.localeCompare(b)).map(([key, row]) => [key, row.canonical]);
        const projectSubjectsList = [...local.projectSubjects].sort(([a], [b]) => a.localeCompare(b)).map(([key, row]) => [key, row.canonical]);
        const projectTopicsList = [...local.projectTopics].sort(([a], [b]) => a.localeCompare(b)).map(([key, row]) => [key, row.canonical]);
        return signature({
            subjects:subjectsList,
            tasks:tasksList,
            settings:local.settings,
            projectSubjects:projectSubjectsList,
            projectSubjectOrder:[...local.projectSubjects.keys()],
            projectTopics:projectTopicsList,
            tombstones:[...local.tombstones].sort(([a], [b]) => a.localeCompare(b)),
            resetGeneration:Number(local.resetGeneration || 0)
        });
    }

    async function assertLocalUnchanged(expectedFingerprint){
        if(await datasetFingerprint(readLocalData()) !== expectedFingerprint){
            throw new SyncConflictError("Local data changed while sync was running. No local values were overwritten; run Sync now again.");
        }
    }

    function countForPreview(local, cloud){
        let subjectsToUpload = 0, tasksToUpload = 0, settingsToUpload = 0, projectSubjectsToUpload = 0, projectTopicsToUpload = 0;
        for(const key of local.subjects.keys()) if(!cloud.subjects.has(key)) subjectsToUpload++;
        for(const key of local.tasks.keys()) if(!cloud.tasks.has(key)) tasksToUpload++;
        if(local.settings !== null && cloud.settings === null) settingsToUpload = 1;
        for(const key of local.projectSubjects.keys()) if(!cloud.projectSubjects.has(key)) projectSubjectsToUpload++;
        for(const key of local.projectTopics.keys()) if(!cloud.projectTopics.has(key)) projectTopicsToUpload++;
        return { subjectsToUpload, tasksToUpload, settingsToUpload, projectSubjectsToUpload, projectTopicsToUpload };
    }

    function projectTopicPreviewPath(local, topicRow){
        const names = [];
        const seen = new Set();
        let current = topicRow;
        while(current && !seen.has(current.id)){
            seen.add(current.id);
            names.unshift(current.canonical.name);
            current = current.canonical.parentId ? local.projectTopics.get(current.canonical.parentId) : null;
        }
        const subject = local.projectSubjects.get(topicRow.canonical.subjectId);
        return [subject?.canonical.name || topicRow.canonical.subjectId, ...names].join(" / ");
    }

    function showFirstUploadPreview(local, cloud, userId, scope = "all", options = {}){
        const counts = countForPreview(local, cloud);
        const projectScope = scope === "projects" || scope === "projects-reconcile";
        const reconciliation = scope === "projects-reconcile" ? options.conflict : null;
        const cloudProjectSubjectsToDownload = [...cloud.projectSubjects.keys()]
            .filter(key => !local.projectSubjects.has(key)).length;
        const cloudProjectTopicsToDownload = [...cloud.projectTopics.keys()]
            .filter(key => !local.projectTopics.has(key)).length;
        const alreadyPresent = projectScope
            ? local.projectSubjects.size + local.projectTopics.size - counts.projectSubjectsToUpload - counts.projectTopicsToUpload
            : local.subjects.size + local.tasks.size + (local.settings === null ? 0 : 1) -
                counts.subjectsToUpload - counts.tasksToUpload - counts.settingsToUpload +
                local.projectSubjects.size + local.projectTopics.size - counts.projectSubjectsToUpload - counts.projectTopicsToUpload;
        const email = workspace.session?.user?.email || "this verified account";
        const uploadSummary = projectScope
            ? `${counts.projectSubjectsToUpload} Project subjects and ${counts.projectTopicsToUpload} topics/subtopics will be uploaded; ${cloudProjectSubjectsToDownload} cloud subjects and ${cloudProjectTopicsToDownload} cloud topics/subtopics will be added to this workspace.`
            : `${counts.subjectsToUpload} task subjects, ${counts.tasksToUpload} tasks, ${counts.projectSubjectsToUpload} Project subjects, ${counts.projectTopicsToUpload} topics/subtopics, and ${counts.settingsToUpload ? "your settings" : "no settings"} will be uploaded.`;
        const baselineComparison = reconciliation?.survivorMatchesBaseline === true
            ? "The surviving copy matches the saved baseline, consistent with a deletion on the missing side. "
            : reconciliation?.survivorMatchesBaseline === false
                ? "The surviving copy differs from the saved baseline, so a change and deletion overlapped. "
                : "";
        const intro = reconciliation
            ? `Review Project recovery for ${email} (${userId}): the saved baseline includes ${reconciliation.label} ID ${reconciliation.recordId}, which is missing from ${reconciliation.localHasRecord ? "the cloud" : "this local workspace"}. ${baselineComparison}Confirming restores missing records from the side that still has them. `
            : `Review ${projectScope ? "Project data" : "first upload"} for ${email} (${userId}): `;
        previewDetails.textContent = reconciliation
            ? `${intro}${uploadSummary} No records will be deleted; the saved baseline changes only after the copies are reconciled.`
            : `${intro}${uploadSummary} ${alreadyPresent} matching record(s) are already in the cloud and will not be replaced. Local data stays in this account workspace; nothing will be deleted.`;
        previewRecords.replaceChildren();
        const previewItems = [];
        if(!projectScope){
            for(const [key, row] of local.subjects){
                if(!cloud.subjects.has(key)) previewItems.push(`Subject: ${row.canonical.name} (${row.canonical.priority} priority)`);
            }
            for(const [key, row] of local.tasks){
                if(!cloud.tasks.has(key)){
                    const date = row.canonical.task_date ? fromIsoDate(row.canonical.task_date) : "no date";
                    previewItems.push(`Task ${key}: subject=${row.canonical.subject}; topic=${row.canonical.topic}; source=${row.canonical.source}; date=${date}; status=${row.canonical.status}; remarks=${row.canonical.remarks}`);
                }
            }
            if(counts.settingsToUpload){
                previewItems.push(`Settings: ${JSON.stringify(stableValue(local.settings))}`);
            }
        }
        for(const [key, row] of local.projectSubjects){
            if(!cloud.projectSubjects.has(key)) previewItems.push(`Project subject ${key}: ${row.canonical.name} (${row.canonical.priority} priority)`);
        }
        for(const [key, row] of local.projectTopics){
            if(!cloud.projectTopics.has(key)){
                previewItems.push(`Project topic ${key}: ${projectTopicPreviewPath(local, row)} (sibling order ${row.canonical.order})`);
            }
        }
        if(projectScope){
            for(const [key, row] of cloud.projectSubjects){
                if(!local.projectSubjects.has(key)) previewItems.push(`Add cloud Project subject ${key}: ${row.canonical.name}`);
            }
            for(const [key, row] of cloud.projectTopics){
                if(!local.projectTopics.has(key)){
                    previewItems.push(`Add cloud Project topic ${key}: ${projectTopicPreviewPath(cloud, row)} (sibling order ${row.canonical.order})`);
                }
            }
        }
        const visibleItems = previewItems.slice(0, 20);
        visibleItems.forEach(label => {
            const item = document.createElement("li");
            item.textContent = label;
            previewRecords.appendChild(item);
        });
        if(previewItems.length > visibleItems.length){
            const remainder = document.createElement("li");
            remainder.textContent = `…and ${previewItems.length - visibleItems.length} more item(s).`;
            previewRecords.appendChild(remainder);
        }
        const preview = {
            userId,
            scope,
            fingerprint:null,
            cloudFingerprint:null,
            checkpointWasAbsent:Boolean(options.checkpointWasAbsent),
            checkpointFingerprint:null,
            projectBaseState:scope === "projects" && options.checkpointWasAbsent ? options.checkpoint || null : null,
            reconciliation:Boolean(reconciliation)
        };
        pendingUpload = preview;
        previewPanel.classList.remove("hidden");
        confirmButton.textContent = reconciliation ? "Confirm Project recovery" : "Confirm reviewed changes";
        setStatus("idle", reconciliation
            ? "Review the Project recovery preview. Nothing changes until you confirm."
            : `Not synced. Review the ${projectScope ? "Project data" : "first-upload"} preview before any local data is uploaded.`);
        updateControls();
        Promise.all([
            datasetFingerprint(local),
            datasetFingerprint(cloud),
            options.checkpoint ? signature(options.checkpoint) : Promise.resolve(null)
        ]).then(([fingerprint, cloudFingerprint, checkpointFingerprint]) => {
            if(pendingUpload === preview){
                preview.fingerprint = fingerprint;
                preview.cloudFingerprint = cloudFingerprint;
                preview.checkpointFingerprint = checkpointFingerprint;
                updateControls();
            }
        }).catch(() => {
            if(pendingUpload !== preview) return;
            pendingUpload = null;
            previewPanel.classList.add("hidden");
            setStatus("failed", "The local dataset could not be verified. Nothing was uploaded.");
            updateControls();
        });
    }

    function discardPreview(preview){
        if(pendingUpload !== preview) return;
        pendingUpload = null;
        previewPanel.classList.add("hidden");
        updateControls();
    }

    function assertPreviewActive(preview){
        if(pendingUpload !== preview){
            throw new SyncConflictError("The upload preview is no longer active. Run Sync now to review the current data.");
        }
    }

    function readState(){
        let raw;
        try{ raw = workspace.storage.getItem(SYNC_STATE_KEY); }
        catch(error){ throw new Error("The local sync checkpoint could not be read."); }
        if(raw === null) return null;
        try{
            const state = JSON.parse(raw);
            if(state?.version !== 1 || !state.userId || !state.baseline) throw new Error("Invalid checkpoint.");
            if(state.resetGeneration === undefined) state.resetGeneration = 0;
            if(!state.baseline.tombstones) state.baseline.tombstones = {};
            return state;
        }catch(error){
            throw new SyncConflictError("The local sync checkpoint is unreadable. No cloud or task data was changed.");
        }
    }

    function hasProjectBaseline(state){
        const keys = ["projectSubjects", "projectTopics", "projectTopicOrders"];
        const baseline = state?.baseline || {};
        const present = keys.filter(key => Object.prototype.hasOwnProperty.call(baseline, key));
        if(!present.length) return false;
        if(present.length !== keys.length || keys.some(key => !baseline[key] || typeof baseline[key] !== "object" || Array.isArray(baseline[key]))){
            throw new SyncConflictError("The Project sync checkpoint is incomplete or unreadable. No Project data was changed.");
        }
        return true;
    }

    async function makeState(userId, cloud){
        return {
            version:1,
            userId,
            resetGeneration:Number(cloud.resetGeneration || 0),
            syncedAt:new Date().toISOString(),
            baseline:{
                subjects:await signatures(cloud.subjects),
                tasks:await signatures(cloud.tasks),
                settings:await settingsSignature(cloud.settings),
                projectSubjects:await signatures(cloud.projectSubjects),
                projectTopics:await signatures(cloud.projectTopics),
                projectTopicOrders:projectTopicOrderSignatures(cloud.projectTopics),
                tombstones:Object.fromEntries([...cloud.tombstones].map(([key, row]) => [key, row.deleted]))
            }
        };
    }

    async function makeProjectState(userId, cloud, previousState){
        return {
            version:1,
            userId,
            resetGeneration:Number(cloud.resetGeneration || previousState.resetGeneration || 0),
            syncedAt:new Date().toISOString(),
            baseline:{
                ...previousState.baseline,
                projectSubjects:await signatures(cloud.projectSubjects),
                projectTopics:await signatures(cloud.projectTopics),
                projectTopicOrders:projectTopicOrderSignatures(cloud.projectTopics),
                tombstones:Object.fromEntries([...cloud.tombstones].map(([key, row]) => [key, row.deleted]))
            }
        };
    }

    function emptySyncState(userId, resetGeneration = 0){
        return {
            version:1,
            userId,
            resetGeneration,
            baseline:{ subjects:{}, tasks:{}, settings:null, tombstones:{} }
        };
    }

    async function makeProjectStartingState(userId, cloud){
        return {
            version:1,
            userId,
            resetGeneration:Number(cloud.resetGeneration || 0),
            baseline:{
                subjects:await signatures(cloud.subjects),
                tasks:await signatures(cloud.tasks),
                settings:await settingsSignature(cloud.settings),
                tombstones:Object.fromEntries([...cloud.tombstones].map(([key, row]) => [key, row.deleted]))
            }
        };
    }

    async function classifyRecords(label, local, cloud, baseline, restoreMissing = false){
        const push = new Set();
        const pull = new Set();
        const localSignatures = await signatures(local);
        const cloudSignatures = await signatures(cloud);
        const baseSignatures = baseline || {};
        const keys = new Set([...local.keys(), ...cloud.keys(), ...Object.keys(baseSignatures)]);

        for(const key of keys){
            const hasBase = Object.prototype.hasOwnProperty.call(baseSignatures, key);
            const localHas = local.has(key), cloudHas = cloud.has(key);
            if(hasBase && (!localHas || !cloudHas)){
                if(restoreMissing && localHas !== cloudHas){
                    if(localHas) push.add(key);
                    else pull.add(key);
                    continue;
                }
                if(label === "Project subject" || label === "Project topic"){
                    const survivorMatchesBaseline = localHas
                        ? localSignatures[key] === baseSignatures[key]
                        : cloudHas ? cloudSignatures[key] === baseSignatures[key] : null;
                    throw new ProjectDeletionConflict(label, key, localHas, cloudHas, survivorMatchesBaseline);
                }
                throw new SyncConflictError(`A ${label} record was removed on one side. Deletion sync is not enabled, so neither dataset was changed.`);
            }
            if(!hasBase){
                if(localHas && cloudHas){
                    if(localSignatures[key] !== cloudSignatures[key]){
                        throw new SyncConflictError(`A new ${label} differs between this device and the cloud. Resolve the conflict before syncing.`);
                    }
                }else if(localHas) push.add(key);
                else if(cloudHas) pull.add(key);
                continue;
            }

            const localChanged = localSignatures[key] !== baseSignatures[key];
            const cloudChanged = cloudSignatures[key] !== baseSignatures[key];
            if(localChanged && cloudChanged && localSignatures[key] !== cloudSignatures[key]){
                throw new SyncConflictError(`A ${label} changed differently on this device and in the cloud. No changes were made.`);
            }
            if(localChanged && !cloudChanged) push.add(key);
            else if(cloudChanged && !localChanged) pull.add(key);
        }
        return { push, pull };
    }

    async function classifySettings(local, cloud, baseline){
        const localSig = await settingsSignature(local);
        const cloudSig = await settingsSignature(cloud);
        const baseSig = baseline ?? null;
        if(baseSig === null){
            if(localSig === null && cloudSig === null) return { push:false, pull:false };
            if(localSig === null) return { push:false, pull:true };
            if(cloudSig === null) return { push:true, pull:false };
            if(localSig !== cloudSig) throw new SyncConflictError("Settings changed independently on this device and in the cloud. No changes were made.");
            return { push:false, pull:false };
        }
        if(localSig === null || cloudSig === null){
            throw new SyncConflictError("Settings were removed on one side. Deletion sync is not enabled, so neither dataset was changed.");
        }
        const localChanged = localSig !== baseSig;
        const cloudChanged = cloudSig !== baseSig;
        if(localChanged && cloudChanged && localSig !== cloudSig){
            throw new SyncConflictError("Settings changed differently on this device and in the cloud. No changes were made.");
        }
        return { push:localChanged && !cloudChanged, pull:cloudChanged && !localChanged };
    }

    async function classifyProjectTopics(local, cloud, baseline, baselineOrders, restoreMissing = false){
        const plan = await classifyRecords("Project topic", local.projectTopics, cloud.projectTopics, baseline, restoreMissing);
        const localOrders = projectTopicOrderSignatures(local.projectTopics);
        const cloudOrders = projectTopicOrderSignatures(cloud.projectTopics);
        const baseOrders = baselineOrders || {};
        const groups = new Set([...Object.keys(baseOrders), ...Object.keys(localOrders), ...Object.keys(cloudOrders)]);
        groups.forEach(group => {
            if(!Object.prototype.hasOwnProperty.call(baseOrders, group)) return;
            const base = JSON.stringify(baseOrders[group] || []);
            const localOrder = JSON.stringify(localOrders[group] || []);
            const cloudOrder = JSON.stringify(cloudOrders[group] || []);
            if(localOrder !== base && cloudOrder !== base && localOrder !== cloudOrder){
                throw new SyncConflictError("Project topic order changed differently on this device and in the cloud. Review the sibling order before syncing.");
            }
        });
        return plan;
    }

    function recordsForDeletion(data, type){
        if(type === "task_subject") return data.subjects;
        if(type === "task") return data.tasks;
        if(type === "project_subject") return data.projectSubjects;
        return data.projectTopics;
    }

    function baselineForDeletion(state, type){
        if(type === "task_subject") return state.baseline.subjects || {};
        if(type === "task") return state.baseline.tasks || {};
        if(type === "project_subject") return state.baseline.projectSubjects || {};
        return state.baseline.projectTopics || {};
    }

    function deleteIdentityParts(identity){
        const separator = identity.indexOf(":");
        if(separator <= 0) throw new SyncConflictError("A local deletion record has an invalid identity.");
        return [identity.slice(0, separator), identity.slice(separator + 1)];
    }

    async function prepareDeletionPlan(local, cloud, state){
        const baselineTombstones = state.baseline.tombstones || {};
        const identities = new Set([
            ...local.tombstones.keys(),
            ...cloud.tombstones.keys(),
            ...Object.keys(baselineTombstones)
        ]);
        const desired = new Map();
        const cloudDeletes = [];
        const localChanges = { subjects:false, tasks:false, projectSubjects:false, projectTopics:false };

        for(const identity of identities){
            const [type, key] = deleteIdentityParts(identity);
            if(!["task", "task_subject", "project_subject", "project_topic"].includes(type)){
                throw new SyncConflictError("A deletion record refers to an unsupported app record.");
            }
            const hasLocalMark = local.tombstones.has(identity);
            const hasCloudMark = cloud.tombstones.has(identity);
            const localState = hasLocalMark ? local.tombstones.get(identity) : undefined;
            const cloudMark = cloud.tombstones.get(identity);
            const cloudState = cloudMark?.deleted;
            const baseState = Object.prototype.hasOwnProperty.call(baselineTombstones, identity) ? baselineTombstones[identity] : undefined;
            if(localState === false && baseState === undefined && !hasCloudMark){
                local.tombstones.delete(identity);
                local.changedTombstones = true;
                continue;
            }
            const localChanged = hasLocalMark && localState !== baseState;
            const cloudChanged = hasCloudMark && cloudState !== baseState;
            if(localChanged && cloudChanged && localState !== cloudState){
                throw new SyncConflictError(`Deletion and restoration of ${type} ${key} happened independently on both devices. Review the copies before syncing.`);
            }
            const stateValue = localChanged ? localState : cloudChanged ? cloudState :
                baseState !== undefined ? baseState : hasLocalMark ? localState : hasCloudMark ? cloudState : undefined;
            if(stateValue === undefined) continue;

            const localMap = recordsForDeletion(local, type);
            const cloudMap = recordsForDeletion(cloud, type);
            const localRecord = localMap.get(key);
            const cloudRecord = cloudMap.get(key);
            const baselineRecords = baselineForDeletion(state, type);
            const baselineSignature = baselineRecords[key];
            if(stateValue){
                for(const [label, record] of [["local", localRecord], ["cloud", cloudRecord]]){
                    if(!record) continue;
                    if(!baselineSignature || await signature(record.canonical) !== baselineSignature){
                        throw new SyncConflictError(`A deletion of ${type} ${key} conflicts with a newer ${label} edit. Neither copy was changed.`);
                    }
                }
                if(localRecord){
                    localMap.delete(key);
                    if(type === "task_subject") localChanges.subjects = true;
                    else if(type === "task") localChanges.tasks = true;
                    else if(type === "project_subject") localChanges.projectSubjects = true;
                    else localChanges.projectTopics = true;
                }
                if(cloudRecord){
                    cloudMap.delete(key);
                    cloudDeletes.push({ type, key, record:cloudRecord });
                }
                if(!hasLocalMark || localState !== true){ local.tombstones.set(identity, true); local.changedTombstones = true; }
                desired.set(identity, true);
                delete baselineRecords[key];
                if(type === "project_topic"){
                    for(const group of Object.values(state.baseline.projectTopicOrders || {})){
                        const index = group.indexOf(key);
                        if(index >= 0) group.splice(index, 1);
                    }
                }
            }else{
                if(!localRecord && !cloudRecord){
                    throw new SyncConflictError(`A restore marker exists for ${type} ${key}, but neither copy contains that record.`);
                }
                if(hasLocalMark && localState === false && !localRecord){
                    throw new SyncConflictError(`The restored local ${type} ${key} is missing. No data was changed.`);
                }
                if(hasCloudMark && cloudState === false && !cloudRecord && !localRecord){
                    throw new SyncConflictError(`The restored cloud ${type} ${key} is missing. No data was changed.`);
                }
                if(!hasLocalMark || localState !== false){ local.tombstones.set(identity, false); local.changedTombstones = true; }
                desired.set(identity, false);
            }
        }

        const deletedTaskIds = new Set([...desired].filter(([identity, value]) => identity.startsWith("task:") && value).map(([identity]) => identity));
        for(const [identity, value] of desired){
            if(!value || !identity.startsWith("task_subject:")) continue;
            const subjectId = identity.slice("task_subject:".length);
            const activeChildren = [...cloud.tasks.values()].filter(task => task.subjectId === subjectId && !deletedTaskIds.has(`task:${task.key}`));
            if(activeChildren.length) throw new SyncConflictError(`Task subject ${subjectId} still has cloud tasks without confirmed deletion records. Neither dataset was changed.`);
        }
        for(const [identity, value] of desired){
            if(!value || !(identity.startsWith("project_subject:") || identity.startsWith("project_topic:"))) continue;
            const [, key] = deleteIdentityParts(identity);
            const referenced = (cloud.projectDependencies || []).some(row =>
                row.subject_id === key && identity.startsWith("project_subject:") ||
                row.topic_id === key && identity.startsWith("project_topic:"));
            if(referenced) throw new SyncConflictError("Project deletion is paused because cloud notes or file metadata still reference it. Notes and files are not part of this sync phase.");
        }

        const hasChanges = cloudDeletes.length > 0 || Boolean(local.changedTombstones) || [...desired].some(([identity, value]) =>
            !local.tombstones.has(identity) || local.tombstones.get(identity) !== value || cloud.tombstones.get(identity)?.deleted !== value);
        return { desired, cloudDeletes, localChanges, hasChanges };
    }

    async function sameProjectMaps(left, right){
        return await projectMapsSubset(left.projectSubjects, right.projectSubjects) &&
            await projectMapsSubset(left.projectTopics, right.projectTopics);
    }

    async function projectCloudIsSubset(local, cloud){
        return sameProjectMaps(cloud, local);
    }

    async function projectLocalIsSubset(local, cloud){
        return sameProjectMaps(local, cloud);
    }

    function makeProjectPullPlan(local, cloud){
        return {
            projectSubjects:{
                push:new Set(),
                pull:new Set([...cloud.projectSubjects.keys()].filter(key => !local.projectSubjects.has(key)))
            },
            projectTopics:{
                push:new Set(),
                pull:new Set([...cloud.projectTopics.keys()].filter(key => !local.projectTopics.has(key)))
            }
        };
    }

    function applyPulls(local, cloud, plan){
        const subjectRows = [...local.subjects.values()].map(row => row.original);
        for(const key of plan.subjects.pull){
            const remote = cloud.subjects.get(key).canonical;
            const index = subjectRows.findIndex(item => item.id === key);
            if(index >= 0) subjectRows[index] = { ...subjectRows[index], name:remote.name, priority:remote.priority };
            else subjectRows.push({ id:key, name:remote.name, priority:remote.priority });
        }
        const finalSubjects = new Map(subjectRows.map(subject => [subject.id, subject]));

        const taskRows = [...local.tasks.values()].map(row => row.original);
        for(const key of plan.tasks.pull){
            const remote = cloud.tasks.get(key).canonical;
            const subject = finalSubjects.get(remote.subjectId) || subjectRows.find(item => normalizeSubjectName(item.name) === normalizeSubjectName(remote.subject));
            if(!subject) throw new SyncConflictError("A cloud task refers to a subject that is not available locally.");
            const index = taskRows.findIndex(task => String(task.id) === key);
            const taskPatch = {
                subject:subject.name,
                topic:remote.topic,
                source:remote.source,
                task_date:fromIsoDate(remote.task_date),
                status:remote.status,
                remarks:remote.remarks
            };
            if(index >= 0) taskRows[index] = { ...taskRows[index], ...taskPatch };
            else taskRows.push({ id:/^\d+$/.test(key) && Number.isSafeInteger(Number(key)) ? Number(key) : key, ...taskPatch });
        }
        const settings = plan.settings.pull ? cloud.settings : local.settings;
        const projects = applyProjectPulls(local, cloud, plan);
        return {
            subjects:subjectRows,
            tasks:taskRows,
            settings,
            tombstones:local.tombstones,
            changedTombstones:Boolean(local.changedTombstones),
            changedSubjects:plan.subjects.pull.size > 0 || Boolean(local.deletionChanges?.subjects),
            changedTasks:plan.tasks.pull.size > 0 || Boolean(local.deletionChanges?.tasks),
            changedSettings:plan.settings.pull,
            ...projects
        };
    }

    function orderProjectSubjects(rows, cloudSubjects){
        // The schema has no subject sort column, so use its stable creation order and
        // leave any not-yet-uploaded local subjects in their existing relative order.
        const localById = new Map(rows.map(subject => [subject.id, subject]));
        const ordered = [];
        cloudSubjects.forEach((record, id) => {
            if(localById.has(id)) ordered.push(localById.get(id));
        });
        rows.forEach(subject => {
            if(!cloudSubjects.has(subject.id)) ordered.push(subject);
        });
        return ordered;
    }

    function projectSubjectOrderChanged(before, after){
        return before.some((subject, index) => subject.id !== after[index]?.id);
    }

    function applyProjectPulls(local, cloud, plan){
        const projectSubjectRows = [...local.projectSubjects.values()].map(row => row.original);
        for(const key of plan.projectSubjects.pull){
            const remote = cloud.projectSubjects.get(key);
            const index = projectSubjectRows.findIndex(subject => subject.id === key);
            const patch = { name:remote.canonical.name, priority:remote.canonical.priority };
            if(index >= 0) projectSubjectRows[index] = { ...projectSubjectRows[index], ...patch };
            else projectSubjectRows.push({ id:remote.id, ...patch });
        }

        const projectTopicRows = [...local.projectTopics.values()].map(row => row.original);
        for(const key of plan.projectTopics.pull){
            const remote = cloud.projectTopics.get(key);
            const index = projectTopicRows.findIndex(topic => topic.id === key);
            const patch = {
                subjectId:remote.canonical.subjectId,
                parentId:remote.canonical.parentId,
                name:remote.canonical.name,
                order:remote.canonical.order
            };
            if(index >= 0) projectTopicRows[index] = { ...projectTopicRows[index], ...patch };
            else projectTopicRows.push({ id:remote.id, ...patch });
        }
        const orderedSubjects = orderProjectSubjects(projectSubjectRows, cloud.projectSubjects);
        return {
            projectSubjects:orderedSubjects,
            projectTopics:projectTopicRows,
            changedProjectSubjects:plan.projectSubjects.pull.size > 0 || projectSubjectOrderChanged(projectSubjectRows, orderedSubjects) || Boolean(local.deletionChanges?.projectSubjects),
            changedProjectTopics:plan.projectTopics.pull.size > 0 || Boolean(local.deletionChanges?.projectTopics)
        };
    }

    function ensureCloudSuccess(result, message){
        if(result.error) throw new Error(message);
        return result.data;
    }

    async function syncTombstonesAndDeleteRows(client, userId, authGeneration, resetGeneration, cloud, deletionPlan, operation){
        for(const [identity, deleted] of deletionPlan.desired){
            assertOperationIdentity(userId, authGeneration);
            const [type, key] = deleteIdentityParts(identity);
            const existing = cloud.tombstones.get(identity);
            if(existing?.deleted === deleted) continue;
            operation.writesStarted = true;
            if(existing){
                const result = await client.from("sync_tombstones")
                    .update({ is_deleted:deleted, sync_generation:resetGeneration })
                    .eq("user_id", userId)
                    .eq("entity_type", type)
                    .eq("entity_key", key)
                    .eq("revision", existing.revision)
                    .eq("sync_generation", resetGeneration)
                    .select("user_id,entity_type,entity_key,is_deleted,revision")
                    .maybeSingle();
                const updated = ensureCloudSuccess(result, "A sync deletion marker could not be saved.");
                if(!updated) throw new SyncConflictError("A deletion marker changed in the cloud during sync. Retry to review the current state.");
                cloud.tombstones.set(identity, { identity, type, key, deleted, revision:Number(updated.revision) });
            }else{
                const result = await client.from("sync_tombstones")
                    .insert({ user_id:userId, entity_type:type, entity_key:key, is_deleted:deleted, sync_generation:resetGeneration })
                    .select("user_id,entity_type,entity_key,is_deleted,revision")
                    .single();
                const inserted = ensureCloudSuccess(result, "A sync deletion marker could not be saved.");
                cloud.tombstones.set(identity, { identity, type, key, deleted, revision:Number(inserted.revision) });
            }
        }

        const deletingTopics = new Map(deletionPlan.cloudDeletes.filter(item => item.type === "project_topic").map(item => [item.key, item.record]));
        const topicDepth = (row, visiting = new Set()) => {
            const parentId = row.canonical?.parentId;
            if(!parentId) return 0;
            if(visiting.has(row.id)) throw new SyncConflictError("Cloud Project topic deletion contains a parent cycle.");
            visiting.add(row.id);
            const parent = deletingTopics.get(parentId) || cloud.projectTopics.get(parentId);
            const depth = parent ? 1 + topicDepth(parent, visiting) : 0;
            visiting.delete(row.id);
            return depth;
        };
        const typeOrder = { task:0, project_topic:1, task_subject:2, project_subject:3 };
        const orderedDeletes = deletionPlan.cloudDeletes.slice().sort((left, right) => {
            const typeDelta = typeOrder[left.type] - typeOrder[right.type];
            if(typeDelta) return typeDelta;
            if(left.type === "project_topic") return topicDepth(right.record) - topicDepth(left.record);
            return String(left.key).localeCompare(String(right.key));
        });
        for(const item of orderedDeletes){
            assertOperationIdentity(userId, authGeneration);
            const table = item.type === "task" ? "tasks"
                : item.type === "task_subject" ? "task_subjects"
                : item.type === "project_subject" ? "project_subjects" : "project_topics";
            operation.writesStarted = true;
            const result = await client.from(table).delete()
                .eq("user_id", userId)
                .eq("id", item.record.id)
                .eq("revision", item.record.revision)
                .eq("sync_generation", resetGeneration)
                .select("id")
                .maybeSingle();
            const removed = ensureCloudSuccess(result, `A deleted ${item.type.replaceAll("_", " ")} could not be removed from the cloud.`);
            if(!removed) throw new SyncConflictError(`A ${item.type.replaceAll("_", " ")} changed in the cloud during deletion. No further writes were sent.`);
        }
    }

    function deletionPlanMatchesCloud(plan, cloud){
        for(const [identity, deleted] of plan.desired){
            if(cloud.tombstones.get(identity)?.deleted !== deleted) return false;
        }
        for(const item of plan.cloudDeletes){
            const map = recordsForDeletion(cloud, item.type);
            if(map.has(item.key)) return false;
        }
        return true;
    }

    function orderedProjectTopicKeys(keys, topics){
        const depthCache = new Map();
        function depth(key, visiting = new Set()){
            if(depthCache.has(key)) return depthCache.get(key);
            const row = topics.get(key);
            if(!row || !row.canonical.parentId) return 0;
            if(visiting.has(key)) throw new SyncConflictError("Project topics contain a parent cycle; no records were uploaded.");
            visiting.add(key);
            const result = 1 + depth(row.canonical.parentId, visiting);
            visiting.delete(key);
            depthCache.set(key, result);
            return result;
        }
        return [...keys].sort((leftKey, rightKey) => {
            const left = topics.get(leftKey), right = topics.get(rightKey);
            return depth(leftKey) - depth(rightKey) ||
                left.canonical.order - right.canonical.order || left.id.localeCompare(right.id);
        });
    }

    async function pushChanges(client, userId, authGeneration, resetGeneration, finalLocal, cloud, plan, operation){
        validateProjectNameCollisions(finalLocal, cloud);
        if(plan.deletionPlan) await syncTombstonesAndDeleteRows(client, userId, authGeneration, resetGeneration, cloud, plan.deletionPlan, operation);
        for(const key of plan.projectSubjects.push){
            assertOperationIdentity(userId, authGeneration);
            const localRecord = finalLocal.projectSubjects.get(key);
            const existing = cloud.projectSubjects.get(key);
            if(existing){
                operation.writesStarted = true;
                const result = await client.from("project_subjects")
                    .update({ name:localRecord.canonical.name, priority:localRecord.canonical.priority, sync_generation:resetGeneration })
                    .eq("user_id", userId)
                    .eq("id", existing.id)
                    .eq("revision", existing.revision)
                    .select("id,user_id,name,priority,revision,created_at")
                    .maybeSingle();
                const updated = ensureCloudSuccess(result, "A Project subject could not be synchronized.");
                if(!updated) throw new SyncConflictError("A Project subject changed in the cloud during sync. No further writes were sent.");
                existing.revision = Number(updated.revision);
                existing.canonical = { ...localRecord.canonical };
            }else{
                operation.writesStarted = true;
                const result = await client.from("project_subjects")
                    .insert({ id:localRecord.id, user_id:userId, name:localRecord.canonical.name, priority:localRecord.canonical.priority, sync_generation:resetGeneration })
                    .select("id,user_id,name,priority,revision,created_at")
                    .single();
                const inserted = ensureCloudSuccess(result, "A Project subject could not be synchronized.");
                cloud.projectSubjects.set(key, {
                    key,
                    id:inserted.id,
                    revision:Number(inserted.revision),
                    createdAt:inserted.created_at,
                    canonical:{ name:inserted.name, priority:String(inserted.priority || "high") }
                });
            }
        }

        for(const key of orderedProjectTopicKeys(plan.projectTopics.push, finalLocal.projectTopics)){
            assertOperationIdentity(userId, authGeneration);
            const localRecord = finalLocal.projectTopics.get(key);
            const existing = cloud.projectTopics.get(key);
            if(!cloud.projectSubjects.has(localRecord.canonical.subjectId) ||
                (localRecord.canonical.parentId && !cloud.projectTopics.has(localRecord.canonical.parentId))){
                throw new SyncConflictError("A Project topic’s subject or parent is not available in the cloud. No topic was uploaded.");
            }
            const record = {
                user_id:userId,
                subject_id:localRecord.canonical.subjectId,
                parent_id:localRecord.canonical.parentId,
                name:localRecord.canonical.name,
                sort_order:localRecord.canonical.order,
                sync_generation:resetGeneration
            };
            if(existing){
                operation.writesStarted = true;
                const result = await client.from("project_topics")
                    .update(record)
                    .eq("user_id", userId)
                    .eq("id", existing.id)
                    .eq("revision", existing.revision)
                    .select("id,user_id,subject_id,parent_id,name,sort_order,revision")
                    .maybeSingle();
                const updated = ensureCloudSuccess(result, "A Project topic could not be synchronized.");
                if(!updated) throw new SyncConflictError("A Project topic changed in the cloud during sync. No further writes were sent.");
                existing.revision = Number(updated.revision);
                existing.canonical = { ...localRecord.canonical };
            }else{
                operation.writesStarted = true;
                const result = await client.from("project_topics")
                    .insert({ id:localRecord.id, ...record })
                    .select("id,user_id,subject_id,parent_id,name,sort_order,revision")
                    .single();
                const inserted = ensureCloudSuccess(result, "A Project topic could not be synchronized.");
                cloud.projectTopics.set(key, {
                    key,
                    id:inserted.id,
                    revision:Number(inserted.revision),
                    canonical:{
                        subjectId:inserted.subject_id,
                        parentId:inserted.parent_id,
                        name:inserted.name,
                        order:Number(inserted.sort_order)
                    }
                });
            }
        }

        for(const key of plan.subjects.push){
            assertOperationIdentity(userId, authGeneration);
            const localRecord = finalLocal.subjects.get(key);
            const existing = cloud.subjects.get(key);
            if(existing){
                operation.writesStarted = true;
                const result = await client.from("task_subjects")
                    .update({ name:localRecord.canonical.name, priority:localRecord.canonical.priority, sync_generation:resetGeneration })
                    .eq("user_id", userId)
                    .eq("id", existing.id)
                    .eq("revision", existing.revision)
                    .select("id,user_id,name,priority,revision")
                    .maybeSingle();
                const updated = ensureCloudSuccess(result, "A task subject could not be synchronized.");
                if(!updated) throw new SyncConflictError("A task subject changed in the cloud during sync. No further writes were sent.");
                cloud.subjectsByName.delete(existing.nameKey);
                existing.revision = Number(updated.revision);
                existing.nameKey = normalizeSubjectName(updated.name);
                existing.canonical = { ...localRecord.canonical };
                cloud.subjectsByName.set(existing.nameKey, existing);
            }else{
                assertOperationIdentity(userId, authGeneration);
                operation.writesStarted = true;
                const result = await client.from("task_subjects")
                    .insert({ id:localRecord.id, user_id:userId, name:localRecord.canonical.name, priority:localRecord.canonical.priority, sync_generation:resetGeneration })
                    .select("id,user_id,name,priority,revision")
                    .single();
                const inserted = ensureCloudSuccess(result, "A task subject could not be synchronized.");
                const insertedSubject = {
                    key:inserted.id,
                    nameKey:normalizeSubjectName(inserted.name),
                    id:inserted.id,
                    revision:Number(inserted.revision),
                    canonical:{ name:inserted.name, priority:String(inserted.priority || "high") }
                };
                cloud.subjects.set(key, insertedSubject);
                cloud.subjectsByName.set(insertedSubject.nameKey, insertedSubject);
            }
        }

        const taskInserts = [];
        for(const key of plan.tasks.push){
            assertOperationIdentity(userId, authGeneration);
            const localRecord = finalLocal.tasks.get(key);
            const subject = cloud.subjectsByName.get(normalizeSubjectName(localRecord.canonical.subject));
            if(!subject) throw new SyncConflictError("A task subject could not be resolved; no task was uploaded.");
            const existing = cloud.tasks.get(key);
            const record = {
                user_id:userId,
                legacy_id:key,
                subject_id:subject.id,
                topic:localRecord.canonical.topic,
                source:localRecord.canonical.source,
                task_date:localRecord.canonical.task_date,
                status:localRecord.canonical.status,
                remarks:localRecord.canonical.remarks,
                sync_generation:resetGeneration
            };
            if(existing){
                operation.writesStarted = true;
                const result = await client.from("tasks")
                    .update(record)
                    .eq("user_id", userId)
                    .eq("id", existing.id)
                    .eq("revision", existing.revision)
                    .select("id,revision")
                    .maybeSingle();
                const updated = ensureCloudSuccess(result, "A task could not be synchronized.");
                if(!updated) throw new SyncConflictError("A task changed in the cloud during sync. No further writes were sent.");
                existing.revision = Number(updated.revision);
                existing.legacyId = key;
                existing.canonical = { ...localRecord.canonical };
            }else{
                taskInserts.push(record);
            }
        }
        for(let offset = 0; offset < taskInserts.length; offset += 100){
            assertOperationIdentity(userId, authGeneration);
            operation.writesStarted = true;
            const result = await client.from("tasks").insert(taskInserts.slice(offset, offset + 100));
            ensureCloudSuccess(result, "A task could not be synchronized.");
        }

        if(plan.settings.push){
            assertOperationIdentity(userId, authGeneration);
            if(cloud.settingsRevision !== null){
                operation.writesStarted = true;
                const result = await client.from("user_settings")
                    .update({ settings:finalLocal.settings, sync_generation:resetGeneration })
                    .eq("user_id", userId)
                    .eq("revision", cloud.settingsRevision)
                    .select("user_id,revision")
                    .maybeSingle();
                const updated = ensureCloudSuccess(result, "Settings could not be synchronized.");
                if(!updated) throw new SyncConflictError("Settings changed in the cloud during sync. No further writes were sent.");
                cloud.settingsRevision = Number(updated.revision);
            }else{
                operation.writesStarted = true;
                const result = await client.from("user_settings")
                    .insert({ user_id:userId, settings:finalLocal.settings, sync_generation:resetGeneration });
                ensureCloudSuccess(result, "Settings could not be synchronized.");
            }
        }
    }

    async function persistResult(local, state){
        const storage = workspace.storage;
        const updates = [[SYNC_STATE_KEY, JSON.stringify(state)]];
        if(local.changedTombstones) updates.push([LOCAL_TOMBSTONES_KEY, JSON.stringify(Object.fromEntries(local.tombstones || new Map()))]);
        if(local.changedSubjects) updates.push(["ironMindSubjects", JSON.stringify(local.subjects)]);
        if(local.changedTasks) updates.push(["ironMindTasks", JSON.stringify(local.tasks)]);
        if(local.changedSettings) updates.push(["ironMindSettings", JSON.stringify(local.settings)]);
        if(local.changedProjectSubjects) updates.push(["ironMindProjectSubjects", JSON.stringify(local.projectSubjects)]);
        if(local.changedProjectTopics) updates.push(["ironMindProjectTopics", JSON.stringify(local.projectTopics)]);
        const snapshots = updates.map(([key]) => [key, storage.getItem(key)]);
        try{
            updates.forEach(([key, value]) => storage.setItem(key, value));
        }catch(error){
            snapshots.forEach(([key, value]) => {
                try{
                    if(value === null) storage.removeItem(key);
                    else storage.setItem(key, value);
                }catch(restoreError){ /* Preserve the original failure and report the local storage issue. */ }
            });
            throw new Error("Local storage could not save the sync result. Existing data was preserved where the browser allowed rollback.");
        }

        if(local.changedSubjects) subjects = local.subjects;
        if(local.changedTasks) tasks = local.tasks;
        if(local.changedSettings) appSettings = { ...defaultSettings, ...local.settings };
        if(local.changedProjectSubjects) projectSubjectRecords = local.projectSubjects;
        if(local.changedProjectTopics) projectTopicRecords = local.projectTopics;
        refreshApplicationAfterPull(local);
    }

    function refreshApplicationAfterPull(local){
        if(!local.changedSubjects && !local.changedTasks && !local.changedSettings &&
            !local.changedProjectSubjects && !local.changedProjectTopics) return;
        try{
            if(local.changedSettings){
                if(typeof syncSettingsUI === "function") syncSettingsUI();
                if(typeof applyTheme === "function") applyTheme();
            }
            if(local.changedSubjects || local.changedTasks){
                if(typeof buildSubjects === "function") buildSubjects();
                if(typeof refreshDashboard === "function") refreshDashboard();
                if(typeof renderSearchResults === "function") renderSearchResults();
                if(typeof currentSubject !== "undefined" && currentSubject){
                    if(typeof renderTasks === "function") renderTasks();
                    if(typeof updateSubjectStats === "function") updateSubjectStats();
                }
            }
            if(local.changedProjectSubjects || local.changedProjectTopics) refreshProjectAfterPull();
        }catch(error){ /* Local records are already saved; the next app render will read them. */ }
    }

    function refreshProjectAfterPull(){
        const home = document.getElementById("projectHomeView");
        const projectWorkspace = document.getElementById("projectSubjectWorkspace");
        const homeWasVisible = Boolean(home && !home.classList.contains("hidden"));
        const workspaceWasVisible = Boolean(projectWorkspace && !projectWorkspace.classList.contains("hidden"));
        if(typeof renderProjectHome === "function") renderProjectHome();
        if(home) home.classList.toggle("hidden", !homeWasVisible);
        if(projectWorkspace) projectWorkspace.classList.toggle("hidden", !workspaceWasVisible);
        if(!workspaceWasVisible) return;

        try{
            const subject = typeof projectState !== "undefined"
                ? projectSubjectRecords.find(item => item.id === projectState.subjectId)
                : null;
            if(!subject) return;
            const title = document.getElementById("projectWorkspaceSubjectTitle");
            const sidebarTitle = document.getElementById("projectSidebarSubjectTitle");
            if(title) title.textContent = subject.name;
            if(sidebarTitle) sidebarTitle.textContent = subject.name;
            if(projectState.activeNoteId){
                if(typeof renderProjectTree === "function") renderProjectTree();
            }else if(typeof renderProjectWorkspace === "function"){
                renderProjectWorkspace();
            }
        }catch(error){ /* Keep the currently open note or Project view intact if it cannot be refreshed. */ }
    }

    async function localMatchesCloud(local, cloud){
        return sameData(local, cloud);
    }

    async function processFirstSync(client, userId, generation, local, localFingerprint, cloud){
        assertOperationIdentity(userId, generation);
        await assertLocalUnchanged(localFingerprint);
        validateProjectNameCollisions(local, cloud);
        const localHas = mapHasRecords(local), cloudHas = mapHasRecords(cloud);
        if(!localHas && !cloudHas){
            pendingUpload = null;
            previewPanel.classList.add("hidden");
            if(cloud.resetGeneration > 0){
                const state = await makeState(userId, cloud);
                assertOperationIdentity(userId, generation);
                await assertLocalUnchanged(localFingerprint);
                await persistResult({
                    subjects:[], tasks:[], settings:null, projectSubjects:[], projectTopics:[],
                    changedSubjects:false, changedTasks:false, changedSettings:false,
                    changedProjectSubjects:false, changedProjectTopics:false
                }, state);
                setStatus("synced", "This clean account workspace is ready. New data will sync from this reset generation.");
                return;
            }
            setStatus("idle", "Not synced. There are no tasks, task subjects, Project subjects/topics, or saved settings to sync yet.");
            return;
        }
        if(!localHas && cloudHas){
            const plan = {
                subjects:{ push:new Set(), pull:new Set(cloud.subjects.keys()) },
                tasks:{ push:new Set(), pull:new Set(cloud.tasks.keys()) },
                settings:{ push:false, pull:cloud.settings !== null },
                projectSubjects:{ push:new Set(), pull:new Set(cloud.projectSubjects.keys()) },
                projectTopics:{ push:new Set(), pull:new Set(cloud.projectTopics.keys()) }
            };
            const pulled = applyPulls(local, cloud, plan);
            const verifiedLocal = makeLocalData(pulled.subjects, pulled.tasks, pulled.settings, pulled.projectSubjects, pulled.projectTopics);
            if(!await localMatchesCloud(verifiedLocal, cloud)) throw new SyncConflictError("Cloud data could not be verified before it was copied locally.");
            const state = await makeState(userId, cloud);
            assertOperationIdentity(userId, generation);
            await assertLocalUnchanged(localFingerprint);
            await persistResult({
                ...pulled,
                changedSubjects:cloud.subjects.size > 0,
                changedTasks:cloud.tasks.size > 0,
                changedSettings:cloud.settings !== null,
                changedProjectSubjects:cloud.projectSubjects.size > 0,
                changedProjectTopics:cloud.projectTopics.size > 0
            }, state);
            pendingUpload = null;
            previewPanel.classList.add("hidden");
            setStatus("synced", `Downloaded cloud tasks, settings, and Project subjects/topics at ${new Date(state.syncedAt).toLocaleString()}.`);
            return;
        }
        if(localHas && cloudHas && await localMatchesCloud(local, cloud)){
            pendingUpload = null;
            previewPanel.classList.add("hidden");
            assertOperationIdentity(userId, generation);
            await assertLocalUnchanged(localFingerprint);
            const noPullPlan = {
                subjects:{ push:new Set(), pull:new Set() },
                tasks:{ push:new Set(), pull:new Set() },
                settings:{ push:false, pull:false },
                projectSubjects:{ push:new Set(), pull:new Set() },
                projectTopics:{ push:new Set(), pull:new Set() }
            };
            const aligned = applyPulls(local, cloud, noPullPlan);
            const state = await makeState(userId, cloud);
            await persistResult(aligned, state);
            setStatus("synced", `Synced at ${new Date(state.syncedAt).toLocaleString()}.`);
            return;
        }
        if(localHas && (!cloudHas || await cloudIsMatchingSubset(local, cloud))){
            showFirstUploadPreview(local, cloud, userId, "all", { checkpointWasAbsent:true });
            return;
        }
        throw new SyncConflictError("This account and this device both contain different task, settings, or Project data, and there is no prior sync checkpoint. No data was changed. Resolve or back up the two datasets before syncing.");
    }

    async function processFirstProjectSync(client, userId, generation, local, localFingerprint, cloud, previousState, checkpointWasAbsent = false){
        assertOperationIdentity(userId, generation);
        await assertLocalUnchanged(localFingerprint);
        validateProjectNameCollisions(local, cloud);
        const localHas = mapHasProjectRecords(local);
        const cloudHas = mapHasProjectRecords(cloud);
        if(!localHas && !cloudHas){
            const nextState = await makeProjectState(userId, cloud, previousState);
            assertOperationIdentity(userId, generation);
            await assertLocalUnchanged(localFingerprint);
            workspace.storage.setItem(SYNC_STATE_KEY, JSON.stringify(nextState));
            setStatus("synced", "Project subjects and topics are ready to sync. No Project records were found yet.");
            return;
        }
        if(await sameProjectData(local, cloud)){
            const nextState = await makeProjectState(userId, cloud, previousState);
            assertOperationIdentity(userId, generation);
            await assertLocalUnchanged(localFingerprint);
            const pulled = applyProjectPulls(local, cloud, makeProjectPullPlan(local, cloud));
            await persistResult({
                ...pulled,
                changedProjectSubjects:pulled.changedProjectSubjects,
                changedProjectTopics:false
            }, nextState);
            setStatus("synced", "Project subjects and topics are synced. No records needed to be copied.");
            return;
        }
        if(await projectLocalIsSubset(local, cloud)){
            const plan = makeProjectPullPlan(local, cloud);
            const pulled = applyProjectPulls(local, cloud, plan);
            const verifiedLocal = makeLocalData(
                [...local.subjects.values()].map(row => row.original),
                [...local.tasks.values()].map(row => row.original),
                local.settings,
                pulled.projectSubjects,
                pulled.projectTopics
            );
            if(!await sameProjectData(verifiedLocal, cloud)) throw new SyncConflictError("Cloud Project data could not be verified before it was added locally.");
            const nextState = await makeProjectState(userId, cloud, previousState);
            assertOperationIdentity(userId, generation);
            await assertLocalUnchanged(localFingerprint);
            await persistResult({ ...pulled }, nextState);
            setStatus("synced", "Downloaded cloud Project subjects and topics. Existing notes, resources, and local Project records were preserved.");
            return;
        }
        if(await projectCloudIsSubset(local, cloud)){
            showFirstUploadPreview(local, cloud, userId, "projects", { checkpoint:previousState, checkpointWasAbsent });
            return;
        }
        if(await projectDataCanMerge(local, cloud)){
            showFirstUploadPreview(local, cloud, userId, "projects", { checkpoint:previousState, checkpointWasAbsent });
            return;
        }
        throw new SyncConflictError("This device and the cloud contain different Project subjects or topics without a shared baseline. No Project data was changed; review both copies before syncing.");
    }

    async function confirmFirstUpload(){
        const preview = pendingUpload;
        if(busy || !preview || !preview.fingerprint || !preview.cloudFingerprint) return;
        if(setOfflineStatus()) return;
        const operation = { writesStarted:false };
        setBusy(true);
        setStatus("syncing", preview.scope.startsWith("projects")
            ? "Verifying the preview and applying the confirmed Project additions…"
            : "Verifying the first-upload preview and uploading the confirmed records…");
        try{
            const { client, userId, generation } = await getVerifiedClient();
            let projectPreviousState = null;
            assertPreviewActive(preview);
            if(userId !== preview.userId) throw new SyncConflictError("The signed-in account changed. Review the upload for the current account.");
            const local = readLocalData();
            if(await datasetFingerprint(local) !== preview.fingerprint){
                discardPreview(preview);
                throw new SyncConflictError("Local data changed after the preview. Run Sync now to review a fresh preview.");
            }
            assertPreviewActive(preview);
            let cloud = await readCloudData(client, userId);
            assertOperationIdentity(userId, generation);
            assertPreviewActive(preview);
            const latestLocal = readLocalData();
            if(await datasetFingerprint(latestLocal) !== preview.fingerprint){
                discardPreview(preview);
                throw new SyncConflictError("Local data changed while checking the cloud. Run Sync now to review a fresh preview.");
            }
            const uploadLocal = latestLocal;
            const projectOnlyPreview = preview.scope === "projects" || preview.scope === "projects-reconcile";
            const projectReconciliationPreview = preview.scope === "projects-reconcile";
            const currentCloudFingerprint = await datasetFingerprint(cloud);
            if(currentCloudFingerprint !== preview.cloudFingerprint){
                discardPreview(preview);
                throw new SyncConflictError("Cloud data changed after the preview. Neither dataset was replaced; run Sync now to review the current data.");
            }
            assertPreviewActive(preview);
            const previousState = readState();
            if(preview.checkpointWasAbsent){
                if(previousState !== null){
                    discardPreview(preview);
                    throw new SyncConflictError("The sync checkpoint changed after the preview. Run Sync now to review the current state.");
                }
            }else if(!previousState || previousState.userId !== userId ||
                !preview.checkpointFingerprint || await signature(previousState) !== preview.checkpointFingerprint){
                discardPreview(preview);
                throw new SyncConflictError("The Project sync checkpoint changed after the preview. Run Sync now to review the current state.");
            }
            if(projectOnlyPreview){
                if(preview.checkpointWasAbsent){
                    projectPreviousState = preview.projectBaseState || emptySyncState(userId);
                }else if(projectReconciliationPreview){
                    if(!hasProjectBaseline(previousState)){
                        discardPreview(preview);
                        throw new SyncConflictError("The Project checkpoint no longer contains a baseline. Run Sync now to review the current state.");
                    }
                    projectPreviousState = previousState;
                }else if(hasProjectBaseline(previousState)){
                    discardPreview(preview);
                    throw new SyncConflictError("The Project sync checkpoint changed after the preview. Run Sync now to review the current state.");
                }else{
                    projectPreviousState = previousState;
                }
                validateProjectNameCollisions(uploadLocal, cloud);
                if(!await projectDataCanMerge(uploadLocal, cloud)){
                    throw new SyncConflictError("The local and cloud Project records conflict by ID or sibling order. Review both copies; neither dataset was changed.");
                }
            }else if(!await cloudIsMatchingSubset(uploadLocal, cloud)){
                discardPreview(preview);
                throw new SyncConflictError("Cloud data no longer matches the first-upload preview. Neither dataset was replaced; run Sync now to review the conflict.");
            }
            const counts = countForPreview(uploadLocal, cloud);
            const projectSubjectsToDownload = projectOnlyPreview
                ? [...cloud.projectSubjects.keys()].filter(key => !uploadLocal.projectSubjects.has(key)).length
                : 0;
            const projectTopicsToDownload = projectOnlyPreview
                ? [...cloud.projectTopics.keys()].filter(key => !uploadLocal.projectTopics.has(key)).length
                : 0;
            const projectSubjectsPlan = projectReconciliationPreview
                ? await classifyRecords("Project subject", uploadLocal.projectSubjects, cloud.projectSubjects, projectPreviousState.baseline.projectSubjects, true)
                : {
                    push:new Set([...uploadLocal.projectSubjects.keys()].filter(key => !cloud.projectSubjects.has(key))),
                    pull:new Set(projectOnlyPreview ? [...cloud.projectSubjects.keys()].filter(key => !uploadLocal.projectSubjects.has(key)) : [])
                };
            const projectTopicsPlan = projectReconciliationPreview
                ? await classifyProjectTopics(uploadLocal, cloud, projectPreviousState.baseline.projectTopics, projectPreviousState.baseline.projectTopicOrders, true)
                : {
                    push:new Set([...uploadLocal.projectTopics.keys()].filter(key => !cloud.projectTopics.has(key))),
                    pull:new Set(projectOnlyPreview ? [...cloud.projectTopics.keys()].filter(key => !uploadLocal.projectTopics.has(key)) : [])
                };
            const plan = {
                subjects:{ push:projectOnlyPreview ? new Set() : new Set([...uploadLocal.subjects.keys()].filter(key => !cloud.subjects.has(key))), pull:new Set() },
                tasks:{ push:projectOnlyPreview ? new Set() : new Set([...uploadLocal.tasks.keys()].filter(key => !cloud.tasks.has(key))), pull:new Set() },
                settings:{ push:!projectOnlyPreview && uploadLocal.settings !== null && cloud.settings === null, pull:false },
                projectSubjects:projectSubjectsPlan,
                projectTopics:projectTopicsPlan
            };
            const finalLocal = {
                subjects:[...uploadLocal.subjects.values()].map(row => row.original),
                tasks:[...uploadLocal.tasks.values()].map(row => row.original),
                settings:uploadLocal.settings,
                tombstones:uploadLocal.tombstones,
                changedTombstones:Boolean(uploadLocal.changedTombstones),
                projectSubjects:[...uploadLocal.projectSubjects.values()].map(row => row.original),
                projectTopics:[...uploadLocal.projectTopics.values()].map(row => row.original),
                changedSubjects:false,
                changedTasks:false,
                changedSettings:false,
                changedProjectSubjects:false,
                changedProjectTopics:false
            };
            finalLocal.subjects = finalLocal.subjects.map(subject => ({ ...subject }));
            finalLocal.tasks = finalLocal.tasks.map(task => ({ ...task }));
            finalLocal.projectSubjects = finalLocal.projectSubjects.map(subject => ({ ...subject }));
            finalLocal.projectTopics = finalLocal.projectTopics.map(topic => ({ ...topic }));
            if(projectOnlyPreview){
                const pulledProjects = applyProjectPulls(uploadLocal, cloud, plan);
                finalLocal.projectSubjects = pulledProjects.projectSubjects;
                finalLocal.projectTopics = pulledProjects.projectTopics;
                finalLocal.changedProjectSubjects = pulledProjects.changedProjectSubjects;
                finalLocal.changedProjectTopics = pulledProjects.changedProjectTopics;
            }
            const finalSnapshot = makeLocalData(finalLocal.subjects, finalLocal.tasks, finalLocal.settings, finalLocal.projectSubjects, finalLocal.projectTopics);
            await assertLocalUnchanged(preview.fingerprint);
            assertPreviewActive(preview);
            await pushChanges(client, userId, generation, cloud.resetGeneration, finalSnapshot, cloud, plan, operation);
            assertOperationIdentity(userId, generation);
            assertPreviewActive(preview);
            const verifiedCloud = await readCloudData(client, userId);
            assertOperationIdentity(userId, generation);
            assertPreviewActive(preview);
            await assertLocalUnchanged(preview.fingerprint);
            const verified = projectOnlyPreview
                ? await sameProjectData(finalSnapshot, verifiedCloud)
                : await localMatchesCloud(finalSnapshot, verifiedCloud);
            if(!verified){
                throw new SyncConflictError("The uploaded data did not match the confirmed local snapshot. No local records were changed; review the cloud before retrying.");
            }
            const orderedProjectSubjects = orderProjectSubjects(finalLocal.projectSubjects, verifiedCloud.projectSubjects);
            finalLocal.changedProjectSubjects = finalLocal.changedProjectSubjects || projectSubjectOrderChanged(finalLocal.projectSubjects, orderedProjectSubjects);
            finalLocal.projectSubjects = orderedProjectSubjects;
            const state = projectOnlyPreview
                ? await makeProjectState(userId, verifiedCloud, projectPreviousState)
                : await makeState(userId, verifiedCloud);
            assertPreviewActive(preview);
            assertOperationIdentity(userId, generation);
            const latestCheckpoint = readState();
            if(preview.checkpointWasAbsent ? latestCheckpoint !== null :
                !latestCheckpoint || await signature(latestCheckpoint) !== preview.checkpointFingerprint){
                throw new SyncConflictError("The sync checkpoint changed during confirmation. The local Project workspace was not updated; review the cloud before retrying.");
            }
            await assertLocalUnchanged(preview.fingerprint);
            await persistResult(finalLocal, state);
            pendingUpload = null;
            previewPanel.classList.add("hidden");
            const summary = projectOnlyPreview
                ? `${counts.projectSubjectsToUpload} Project subject(s) and ${counts.projectTopicsToUpload} topic(s)/subtopic(s) uploaded; ${projectSubjectsToDownload} subject(s) and ${projectTopicsToDownload} topic(s)/subtopic(s) downloaded`
                : `${counts.subjectsToUpload} task subject(s), ${counts.tasksToUpload} task(s), ${counts.projectSubjectsToUpload} Project subject(s), ${counts.projectTopicsToUpload} topic(s)/subtopic(s), and ${counts.settingsToUpload ? "settings" : "no settings"}`;
            setStatus("synced", `Synced ${summary} at ${new Date(state.syncedAt).toLocaleString()}.`);
        }catch(error){
            reportSyncError(error, operation);
        }finally{
            setBusy(false);
        }
    }

    async function synchronize(){
        if(busy) return;
        if(!canUseAccountWorkspace()){
            setStatus("failed", "Sign in and open that account’s local workspace before syncing.");
            updateControls();
            return;
        }
        if(setOfflineStatus()) return;
        const operation = { writesStarted:false };
        setBusy(true);
        setStatus("syncing", "Checking this account’s cloud data…");
        try{
            const { client, userId, generation } = await getVerifiedClient();
            let local = readLocalData();
            let localFingerprint = await datasetFingerprint(local);
            let cloud = await readCloudData(client, userId);
            assertOperationIdentity(userId, generation);
            local = readLocalData();
            if(await datasetFingerprint(local) !== localFingerprint){
                throw new SyncConflictError("Local data changed while the cloud was being checked. No local values were overwritten; run Sync now again.");
            }
            let state = readState();
            if(state && state.resetGeneration !== cloud.resetGeneration){
                throw new SyncConflictError("This account was cleared on another device. To prevent old offline records from returning, explicitly use Delete All Data on this device to clear its local account workspace before syncing.");
            }
            if(!state && cloud.resetGeneration > 0 && mapHasRecords(local)){
                throw new SyncConflictError("This account has a confirmed clean reset, but this device has no matching checkpoint. Export anything you still need, then explicitly use Delete All Data on this device before syncing.");
            }
            if(state?.requireInitialUploadConfirmation && mapHasRecords(local)){
                showFirstUploadPreview(local, cloud, userId, "all", { checkpoint:state });
                return;
            }

            local = alignTaskSubjectIds(local, cloud);
            if(local.changedSubjects){
                const subjectRows = [...local.subjects.values()].map(row => row.original);
                workspace.storage.setItem("ironMindSubjects", JSON.stringify(subjectRows));
                subjects = subjectRows;
                local = readLocalData();
                localFingerprint = await datasetFingerprint(local);
            }
            remapLegacySubjectTombstones(local, cloud);
            if(!state){
                const emptyState = emptySyncState(userId, cloud.resetGeneration);
                const deletionPlan = await prepareDeletionPlan(local, cloud, emptyState);
                if(deletionPlan.hasChanges){
                    if(deletionPlan.cloudDeletes.length) throw new SyncConflictError("This device has deletion records but no shared sync baseline. The current copies were kept unchanged; reconcile or explicitly clear the workspace before syncing.");
                    await syncTombstonesAndDeleteRows(client, userId, generation, cloud.resetGeneration, cloud, deletionPlan, operation);
                    cloud = await readCloudData(client, userId);
                    assertOperationIdentity(userId, generation);
                    if(!deletionPlanMatchesCloud(deletionPlan, cloud)) throw new SyncConflictError("The deletion records could not be verified in the cloud. No app records were copied.");
                    if(mapHasRecords(local) || mapHasRecords(cloud)){
                        if(deletionPlan.cloudDeletes.length) throw new SyncConflictError("This device has an unresolved deletion without a shared baseline.");
                    }else{
                    const verified = await readCloudData(client, userId);
                    assertOperationIdentity(userId, generation);
                    if(verified.resetGeneration !== cloud.resetGeneration || !deletionPlanMatchesCloud(deletionPlan, verified)){
                        throw new SyncConflictError("The confirmed deletion did not match the latest cloud state. Run Sync now to review the account before retrying.");
                    }
                    const nextState = await makeState(userId, verified);
                    await assertLocalUnchanged(localFingerprint);
                    await persistResult({
                        subjects:[], tasks:[], settings:local.settings, projectSubjects:[], projectTopics:[],
                        tombstones:local.tombstones, changedTombstones:local.changedTombstones,
                        changedSubjects:false, changedTasks:false, changedSettings:false,
                        changedProjectSubjects:false, changedProjectTopics:false
                    }, nextState);
                    setStatus("synced", "Deletion records were saved. The account’s active records remain protected until their changes reconcile.");
                    return;
                    }
                }
                const hasProjectData = mapHasProjectRecords(local) || mapHasProjectRecords(cloud);
                if(hasProjectData && await sameTaskAndSettingsData(local, cloud)){
                    const initialState = await makeProjectStartingState(userId, cloud);
                    await processFirstProjectSync(client, userId, generation, local, localFingerprint, cloud, initialState, true);
                    return;
                }
                await processFirstSync(client, userId, generation, local, localFingerprint, cloud);
                return;
            }
            if(state.userId !== userId){
                throw new SyncConflictError("The local sync checkpoint belongs to a different account. No data was changed.");
            }
            const taskSubjectBaseline = remapLegacyTaskSubjectBaseline(state, local, cloud);
            const syncState = { ...state, baseline:{ ...state.baseline, subjects:taskSubjectBaseline } };
            const deletionPlan = await prepareDeletionPlan(local, cloud, syncState);
            local.deletionChanges = deletionPlan.localChanges;
            if(deletionPlan.hasChanges){
                if(!hasProjectBaseline(state)){
                    await syncTombstonesAndDeleteRows(client, userId, generation, cloud.resetGeneration, cloud, deletionPlan, operation);
                    const verifiedCloud = await readCloudData(client, userId);
                    assertOperationIdentity(userId, generation);
                    if(verifiedCloud.resetGeneration !== cloud.resetGeneration || !deletionPlanMatchesCloud(deletionPlan, verifiedCloud)){
                        throw new SyncConflictError("The deletion state changed during sync. Run Sync now to review the current account state.");
                    }
                    const updatedState = {
                        ...state,
                        resetGeneration:verifiedCloud.resetGeneration,
                        syncedAt:new Date().toISOString(),
                        baseline:{
                            ...state.baseline,
                            tombstones:Object.fromEntries([...verifiedCloud.tombstones].map(([key, row]) => [key, row.deleted]))
                        }
                    };
                    await assertLocalUnchanged(localFingerprint);
                    await persistResult({
                        subjects:[...local.subjects.values()].map(row => row.original),
                        tasks:[...local.tasks.values()].map(row => row.original),
                        settings:local.settings,
                        projectSubjects:[...local.projectSubjects.values()].map(row => row.original),
                        projectTopics:[...local.projectTopics.values()].map(row => row.original),
                        tombstones:local.tombstones, changedTombstones:local.changedTombstones,
                        changedSubjects:local.deletionChanges.subjects, changedTasks:local.deletionChanges.tasks,
                        changedSettings:false, changedProjectSubjects:local.deletionChanges.projectSubjects,
                        changedProjectTopics:local.deletionChanges.projectTopics
                    }, updatedState);
                    setStatus("synced", "Confirmed deletions were synchronized. Run Sync now again to check remaining changes.");
                    return;
                }
            }
            if(!hasProjectBaseline(state)){
                await processFirstProjectSync(client, userId, generation, local, localFingerprint, cloud, state);
                return;
            }
            validateProjectNameCollisions(local, cloud);
            const subjectsPlan = await classifyRecords("subject", local.subjects, cloud.subjects, taskSubjectBaseline);
            const tasksPlan = await classifyRecords("task", local.tasks, cloud.tasks, state.baseline.tasks);
            const settingsPlan = await classifySettings(local.settings, cloud.settings, state.baseline.settings);
            let projectSubjectsPlan, projectTopicsPlan;
            try{
                projectSubjectsPlan = await classifyRecords("Project subject", local.projectSubjects, cloud.projectSubjects, state.baseline.projectSubjects);
                projectTopicsPlan = await classifyProjectTopics(local, cloud, state.baseline.projectTopics, state.baseline.projectTopicOrders);
            }catch(error){
                if(!(error instanceof ProjectDeletionConflict)) throw error;
                if(error.localHasRecord === error.cloudHasRecord){
                    throw new SyncConflictError(`${error.message} The record is absent from both copies, so it cannot be restored automatically. Neither dataset nor the checkpoint was changed.`);
                }
                showFirstUploadPreview(local, cloud, userId, "projects-reconcile", { checkpoint:state, conflict:error });
                return;
            }
            const plan = {
                subjects:subjectsPlan,
                tasks:tasksPlan,
                settings:settingsPlan,
                projectSubjects:projectSubjectsPlan,
                projectTopics:projectTopicsPlan,
                deletionPlan
            };
            const finalLocal = applyPulls(local, cloud, plan);
            const finalSnapshot = makeLocalData(finalLocal.subjects, finalLocal.tasks, finalLocal.settings, finalLocal.projectSubjects, finalLocal.projectTopics);
            await assertLocalUnchanged(localFingerprint);
            await pushChanges(client, userId, generation, cloud.resetGeneration, finalSnapshot, cloud, plan, operation);
            assertOperationIdentity(userId, generation);
            await assertLocalUnchanged(localFingerprint);
            const verifiedCloud = await readCloudData(client, userId);
            assertOperationIdentity(userId, generation);
            if(verifiedCloud.resetGeneration !== cloud.resetGeneration || !deletionPlanMatchesCloud(deletionPlan, verifiedCloud)){
                throw new SyncConflictError("The deletion state changed during sync. Run Sync now to review the current account state.");
            }
            if(!await localMatchesCloud(finalSnapshot, verifiedCloud)){
                throw new SyncConflictError("Data changed during sync and could not be reconciled. Review both copies before retrying.");
            }
            const orderedProjectSubjects = orderProjectSubjects(finalLocal.projectSubjects, verifiedCloud.projectSubjects);
            finalLocal.changedProjectSubjects = finalLocal.changedProjectSubjects || projectSubjectOrderChanged(finalLocal.projectSubjects, orderedProjectSubjects);
            finalLocal.projectSubjects = orderedProjectSubjects;
            const nextState = await makeState(userId, verifiedCloud);
            assertOperationIdentity(userId, generation);
            await assertLocalUnchanged(localFingerprint);
            await persistResult(finalLocal, nextState);
            pendingUpload = null;
            previewPanel.classList.add("hidden");
            setStatus("synced", `Synced at ${new Date(nextState.syncedAt).toLocaleString()}.`);
        }catch(error){
            reportSyncError(error, operation);
        }finally{
            setBusy(false);
        }
    }

    function reportSyncError(error, operation = null){
        if(error instanceof SyncConflictError){
            const followUp = operation?.writesStarted
                ? " Earlier approved writes may have completed; no further writes were sent."
                : " No data was changed.";
            setStatus("conflict", `Conflict: ${error.message}${followUp}`);
            return;
        }
        if(error instanceof SyncAuthError){
            const followUp = operation?.writesStarted
                ? " Earlier requests may have reached the cloud; review the account before retrying."
                : " No cloud data was changed.";
            setStatus("failed", `${error.message} Local data remains available.${followUp}`);
            return;
        }
        if(navigator.onLine === false || error?.message === "Offline"){
            const followUp = operation?.writesStarted ? " Earlier requests may have completed." : " No cloud writes were sent.";
            setStatus("offline", `Offline. Local data remains available.${followUp}`);
            return;
        }
        setStatus("failed", "Sync failed. Local data was preserved. Approved updates or deletions may have reached the cloud; Sync now is safe to retry.");
    }

    async function deleteAllAccountData(){
        if(busy) throw new Error("A cloud operation is already running. Retry Delete All Data afterward.");
        if(!canUseAccountWorkspace() || navigator.onLine === false) throw new SyncAuthError("Verify the signed-in account and reconnect before deleting its cloud data.");
        setBusy(true);
        try{
            const { client, userId, generation } = await getVerifiedClient();
            const result = await client.rpc("delete_my_app_data");
            if(result.error) throw new Error("The account-scoped cloud deletion failed. Local data was not removed.");
            assertOperationIdentity(userId, generation);
            const resetGeneration = Number(result.data);
            if(!Number.isSafeInteger(resetGeneration) || resetGeneration < 1){
                throw new Error("Supabase did not confirm the account reset generation. Retry after checking the account state.");
            }
            return resetGeneration;
        }finally{ setBusy(false); }
    }

    function finishLocalDataReset(resetGeneration){
        const userId = accountId();
        if(!userId || !Number.isSafeInteger(Number(resetGeneration)) || Number(resetGeneration) < 1){
            throw new SyncAuthError("The account changed before the local reset could be recorded.");
        }
        const state = {
            version:1,
            userId,
            resetGeneration:Number(resetGeneration),
            requireInitialUploadConfirmation:true,
            syncedAt:new Date().toISOString(),
            baseline:{ subjects:{}, tasks:{}, settings:null, projectSubjects:{}, projectTopics:{}, projectTopicOrders:{}, tombstones:{} }
        };
        workspace.storage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
        setStatus("idle", "This account workspace is clean. Sign in on each other device and explicitly clear its old local workspace before syncing.");
    }

    window.IRON_MIND_CLOUD_SYNC = Object.freeze({
        deleteAllData:deleteAllAccountData,
        finishLocalDataReset
    });

    function cancelPreview(){
        if(busy) return;
        pendingUpload = null;
        previewPanel.classList.add("hidden");
        setStatus("idle", "Review cancelled. Local and cloud data were not changed.");
    }

    syncButton.addEventListener("click", synchronize);
    confirmButton.addEventListener("click", confirmFirstUpload);
    cancelButton.addEventListener("click", cancelPreview);
    window.addEventListener("online", () => {
        if(workspace.storage.getItem(SYNC_STATE_KEY)) setStatus("synced", "Online. Press Sync now to check for changes.");
        else setStatus("idle", "Online. Press Sync now to check this account’s cloud data.");
    });
    window.addEventListener("offline", setOfflineStatus);
    window.addEventListener("iron-mind-auth-session", event => {
        const eventType = event.detail?.event;
        if(eventType === "SIGNED_IN" || eventType === "SIGNED_OUT"){
            authGeneration++;
            pendingUpload = null;
            previewPanel.classList.add("hidden");
        }
        if(event.detail?.event === "SIGNED_OUT"){
            pendingUpload = null;
            previewPanel.classList.add("hidden");
            setStatus("idle", "Signed out. Cloud sync is unavailable; local data remains available.");
        }
        updateControls();
    });

    updateControls();
    if(!canUseAccountWorkspace()){
        setStatus("idle", "Open the signed-in account’s local workspace to sync.");
    }else if(setOfflineStatus()){
        // The offline workspace remains fully usable.
    }else{
        try{
            const state = readState();
            if(state?.userId === accountId()) setStatus("synced", `Last synced at ${new Date(state.syncedAt).toLocaleString()}. Press Sync now to check for changes.`);
            else setStatus("idle", "Not synced. Press Sync now to check this account’s cloud data.");
        }catch(error){
            reportSyncError(error);
        }
    }
})();
