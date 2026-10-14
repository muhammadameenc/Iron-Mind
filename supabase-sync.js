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
    const VALID_STATUSES = new Set(["Planned", "Halfway", "Completed", "Missed"]);

    if(!workspace || !panel || !statusElement || !syncButton || !previewPanel || !previewDetails || !previewRecords || !confirmButton || !cancelButton) return;

    let busy = false;
    let pendingUpload = null;
    let authGeneration = 0;

    class SyncConflictError extends Error{}
    class SyncAuthError extends Error{}

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

    function makeLocalData(subjectRows, taskRows, settings, projectSubjectRows, projectTopicRows){
        const localSubjects = new Map();
        if(!Array.isArray(subjectRows) || !Array.isArray(taskRows) || !Array.isArray(projectSubjectRows) || !Array.isArray(projectTopicRows)){
            throw new SyncConflictError("Local tasks or subjects are not in the expected format.");
        }
        subjectRows.forEach(subject => {
            if(!subject || typeof subject.name !== "string" || !subject.name.trim()){
                throw new SyncConflictError("A local task subject is invalid; no data was changed.");
            }
            const key = normalizeSubjectName(subject.name);
            if(localSubjects.has(key)) throw new SyncConflictError("Local task subjects contain duplicate names; no data was changed.");
            localSubjects.set(key, {
                key,
                canonical:{ name:subject.name, priority:String(subject.priority || "high") },
                original:subject
            });
        });

        const localTasks = new Map();
        taskRows.forEach(task => {
            if(!task || (typeof task.id !== "number" && typeof task.id !== "string") || String(task.id) === ""){
                throw new SyncConflictError("A local task has no stable ID; no data was changed.");
            }
            const key = String(task.id);
            if(localTasks.has(key)) throw new SyncConflictError("Local tasks contain duplicate IDs; no data was changed.");
            const subject = localSubjects.get(normalizeSubjectName(task.subject));
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
        return makeLocalData(
            localSubjects,
            localTasks,
            parseStoredSettings(),
            localProjectSubjects,
            localProjectTopics
        );
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
        const [subjectRows, taskRows, settingsResult, projectSubjectRows, projectTopicRows] = await Promise.all([
            readAllRows(client, "task_subjects", "id,user_id,name,priority,revision", "id", userId),
            readAllRows(client, "tasks", "id,user_id,subject_id,legacy_id,topic,source,task_date,status,remarks,revision", "id", userId),
            client.from("user_settings")
                .select("user_id,settings,revision")
                .eq("user_id", userId)
                .limit(2),
            readAllRows(client, "project_subjects", "id,user_id,name,priority,revision,created_at", ["created_at", "id"], userId),
            readAllRows(client, "project_topics", "id,user_id,subject_id,parent_id,name,sort_order,revision", "id", userId)
        ]);
        const settingsRows = checkedResult(settingsResult, "Cloud settings could not be read.") || [];
        if(!Array.isArray(subjectRows) || !Array.isArray(taskRows) || !Array.isArray(settingsRows) || settingsRows.length > 1 ||
            !Array.isArray(projectSubjectRows) || !Array.isArray(projectTopicRows)){
            throw new SyncConflictError("The cloud returned an unexpected data shape; no local data was changed.");
        }

        const cloudSubjects = new Map();
        const subjectsById = new Map();
        subjectRows.forEach(subject => {
            if(subject.user_id !== userId || !subject.id || typeof subject.name !== "string"){
                throw new SyncConflictError("Cloud subject ownership or shape could not be verified.");
            }
            const key = normalizeSubjectName(subject.name);
            if(!key || cloudSubjects.has(key)) throw new SyncConflictError("Cloud task subjects contain a name conflict.");
            const record = { key, id:subject.id, revision:Number(subject.revision), canonical:{ name:subject.name, priority:String(subject.priority || "high") } };
            cloudSubjects.set(key, record);
            subjectsById.set(subject.id, record);
        });

        const cloudTasks = new Map();
        taskRows.forEach(task => {
            if(task.user_id !== userId || !task.id) throw new SyncConflictError("Cloud task ownership could not be verified.");
            const subject = subjectsById.get(task.subject_id);
            if(!subject) throw new SyncConflictError("A cloud task refers to a missing subject; no data was changed.");
            const key = String(task.legacy_id || task.id);
            if(cloudTasks.has(key)) throw new SyncConflictError("Cloud tasks contain a duplicate stable ID.");
            if(!VALID_STATUSES.has(task.status)) throw new SyncConflictError("A cloud task has an unsupported status.");
            cloudTasks.set(key, {
                key,
                id:task.id,
                legacyId:task.legacy_id ? String(task.legacy_id) : null,
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

        const settingsRow = settingsRows.length ? settingsRows[0] : null;
        const settings = settingsRow ? settingsRow.settings : null;
        if(settingsRows.length && settingsRows[0].user_id !== userId){
            throw new SyncConflictError("Cloud settings ownership could not be verified.");
        }
        if(settings !== null && (!settings || typeof settings !== "object" || Array.isArray(settings))){
            throw new SyncConflictError("Cloud settings have an unexpected format.");
        }

        const cloudProjectSubjects = new Map();
        projectSubjectRows.forEach(subject => {
            if(subject.user_id !== userId || !isUuid(subject.id) || typeof subject.name !== "string" || !subject.name.trim()){
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
            if(topic.user_id !== userId || !isUuid(topic.id) || !isUuid(topic.subject_id) ||
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
            tasks:cloudTasks,
            settings,
            settingsRevision:settingsRow ? Number(settingsRow.revision) : null,
            projectSubjects:cloudProjectSubjects,
            projectTopics:cloudProjectTopics
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
            projectTopics:projectTopicsList
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
        const cloudProjectSubjectsToDownload = [...cloud.projectSubjects.keys()]
            .filter(key => !local.projectSubjects.has(key)).length;
        const cloudProjectTopicsToDownload = [...cloud.projectTopics.keys()]
            .filter(key => !local.projectTopics.has(key)).length;
        const alreadyPresent = scope === "projects"
            ? local.projectSubjects.size + local.projectTopics.size - counts.projectSubjectsToUpload - counts.projectTopicsToUpload
            : local.subjects.size + local.tasks.size + (local.settings === null ? 0 : 1) -
                counts.subjectsToUpload - counts.tasksToUpload - counts.settingsToUpload +
                local.projectSubjects.size + local.projectTopics.size - counts.projectSubjectsToUpload - counts.projectTopicsToUpload;
        const email = workspace.session?.user?.email || "this verified account";
        const uploadSummary = scope === "projects"
            ? `${counts.projectSubjectsToUpload} Project subjects and ${counts.projectTopicsToUpload} topics/subtopics will be uploaded; ${cloudProjectSubjectsToDownload} cloud subjects and ${cloudProjectTopicsToDownload} cloud topics/subtopics will be added to this workspace.`
            : `${counts.subjectsToUpload} task subjects, ${counts.tasksToUpload} tasks, ${counts.projectSubjectsToUpload} Project subjects, ${counts.projectTopicsToUpload} topics/subtopics, and ${counts.settingsToUpload ? "your settings" : "no settings"} will be uploaded.`;
        previewDetails.textContent =
            `Review first upload to ${email} (${userId}): ${uploadSummary} ` +
            `${alreadyPresent} matching record(s) are already in the cloud and will not be replaced. Local data stays in this account workspace; nothing will be deleted.`;
        previewRecords.replaceChildren();
        const previewItems = [];
        if(scope !== "projects"){
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
        if(scope === "projects"){
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
            projectBaseState:scope === "projects" && options.checkpointWasAbsent ? options.checkpoint || null : null
        };
        pendingUpload = preview;
        previewPanel.classList.remove("hidden");
        setStatus("idle", `Not synced. Review the ${scope === "projects" ? "Project data" : "first-upload"} preview before any local data is uploaded.`);
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
            syncedAt:new Date().toISOString(),
            baseline:{
                subjects:await signatures(cloud.subjects),
                tasks:await signatures(cloud.tasks),
                settings:await settingsSignature(cloud.settings),
                projectSubjects:await signatures(cloud.projectSubjects),
                projectTopics:await signatures(cloud.projectTopics),
                projectTopicOrders:projectTopicOrderSignatures(cloud.projectTopics)
            }
        };
    }

    async function makeProjectState(userId, cloud, previousState){
        return {
            version:1,
            userId,
            syncedAt:new Date().toISOString(),
            baseline:{
                ...previousState.baseline,
                projectSubjects:await signatures(cloud.projectSubjects),
                projectTopics:await signatures(cloud.projectTopics),
                projectTopicOrders:projectTopicOrderSignatures(cloud.projectTopics)
            }
        };
    }

    function emptySyncState(userId){
        return {
            version:1,
            userId,
            baseline:{ subjects:{}, tasks:{}, settings:null }
        };
    }

    async function makeProjectStartingState(userId, cloud){
        return {
            version:1,
            userId,
            baseline:{
                subjects:await signatures(cloud.subjects),
                tasks:await signatures(cloud.tasks),
                settings:await settingsSignature(cloud.settings)
            }
        };
    }

    async function classifyRecords(label, local, cloud, baseline){
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

    async function classifyProjectTopics(local, cloud, baseline, baselineOrders){
        const plan = await classifyRecords("Project topic", local.projectTopics, cloud.projectTopics, baseline);
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
            const index = subjectRows.findIndex(item => normalizeSubjectName(item.name) === key);
            if(index >= 0) subjectRows[index] = { ...subjectRows[index], name:remote.name, priority:remote.priority };
            else subjectRows.push({ name:remote.name, priority:remote.priority });
        }
        const finalSubjects = new Map(subjectRows.map(subject => [normalizeSubjectName(subject.name), subject]));

        const taskRows = [...local.tasks.values()].map(row => row.original);
        for(const key of plan.tasks.pull){
            const remote = cloud.tasks.get(key).canonical;
            const subject = finalSubjects.get(normalizeSubjectName(remote.subject));
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
            changedSubjects:plan.subjects.pull.size > 0,
            changedTasks:plan.tasks.pull.size > 0,
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
            changedProjectSubjects:plan.projectSubjects.pull.size > 0 || projectSubjectOrderChanged(projectSubjectRows, orderedSubjects),
            changedProjectTopics:plan.projectTopics.pull.size > 0
        };
    }

    function ensureCloudSuccess(result, message){
        if(result.error) throw new Error(message);
        return result.data;
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

    async function pushChanges(client, userId, generation, finalLocal, cloud, plan, operation){
        validateProjectNameCollisions(finalLocal, cloud);
        for(const key of plan.projectSubjects.push){
            assertOperationIdentity(userId, generation);
            const localRecord = finalLocal.projectSubjects.get(key);
            const existing = cloud.projectSubjects.get(key);
            if(existing){
                operation.writesStarted = true;
                const result = await client.from("project_subjects")
                    .update({ name:localRecord.canonical.name, priority:localRecord.canonical.priority })
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
                    .insert({ id:localRecord.id, user_id:userId, name:localRecord.canonical.name, priority:localRecord.canonical.priority })
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
            assertOperationIdentity(userId, generation);
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
                sort_order:localRecord.canonical.order
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
            assertOperationIdentity(userId, generation);
            const localRecord = finalLocal.subjects.get(key);
            const existing = cloud.subjects.get(key);
            if(existing){
                operation.writesStarted = true;
                const result = await client.from("task_subjects")
                    .update({ name:localRecord.canonical.name, priority:localRecord.canonical.priority })
                    .eq("user_id", userId)
                    .eq("id", existing.id)
                    .eq("revision", existing.revision)
                    .select("id,revision")
                    .maybeSingle();
                const updated = ensureCloudSuccess(result, "A task subject could not be synchronized.");
                if(!updated) throw new SyncConflictError("A task subject changed in the cloud during sync. No further writes were sent.");
                existing.revision = Number(updated.revision);
                existing.canonical = { ...localRecord.canonical };
            }else{
                assertOperationIdentity(userId, generation);
                operation.writesStarted = true;
                const result = await client.from("task_subjects")
                    .insert({ user_id:userId, name:localRecord.canonical.name, priority:localRecord.canonical.priority })
                    .select("id,user_id,name,priority,revision")
                    .single();
                const inserted = ensureCloudSuccess(result, "A task subject could not be synchronized.");
                cloud.subjects.set(key, {
                    key,
                    id:inserted.id,
                    revision:Number(inserted.revision),
                    canonical:{ name:inserted.name, priority:String(inserted.priority || "high") }
                });
            }
        }

        const taskInserts = [];
        for(const key of plan.tasks.push){
            assertOperationIdentity(userId, generation);
            const localRecord = finalLocal.tasks.get(key);
            const subject = cloud.subjects.get(normalizeSubjectName(localRecord.canonical.subject));
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
                remarks:localRecord.canonical.remarks
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
            assertOperationIdentity(userId, generation);
            operation.writesStarted = true;
            const result = await client.from("tasks").insert(taskInserts.slice(offset, offset + 100));
            ensureCloudSuccess(result, "A task could not be synchronized.");
        }

        if(plan.settings.push){
            assertOperationIdentity(userId, generation);
            if(cloud.settingsRevision !== null){
                operation.writesStarted = true;
                const result = await client.from("user_settings")
                    .update({ settings:finalLocal.settings })
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
                    .insert({ user_id:userId, settings:finalLocal.settings });
                ensureCloudSuccess(result, "Settings could not be synchronized.");
            }
        }
    }

    async function persistResult(local, state){
        const storage = workspace.storage;
        const updates = [[SYNC_STATE_KEY, JSON.stringify(state)]];
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
        setStatus("syncing", preview.scope === "projects"
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
            const cloud = await readCloudData(client, userId);
            assertOperationIdentity(userId, generation);
            assertPreviewActive(preview);
            const latestLocal = readLocalData();
            if(await datasetFingerprint(latestLocal) !== preview.fingerprint){
                discardPreview(preview);
                throw new SyncConflictError("Local data changed while checking the cloud. Run Sync now to review a fresh preview.");
            }
            const uploadLocal = latestLocal;
            const projectOnlyPreview = preview.scope === "projects";
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
            const plan = {
                subjects:{ push:projectOnlyPreview ? new Set() : new Set([...uploadLocal.subjects.keys()].filter(key => !cloud.subjects.has(key))), pull:new Set() },
                tasks:{ push:projectOnlyPreview ? new Set() : new Set([...uploadLocal.tasks.keys()].filter(key => !cloud.tasks.has(key))), pull:new Set() },
                settings:{ push:!projectOnlyPreview && uploadLocal.settings !== null && cloud.settings === null, pull:false },
                projectSubjects:{
                    push:new Set([...uploadLocal.projectSubjects.keys()].filter(key => !cloud.projectSubjects.has(key))),
                    pull:new Set(projectOnlyPreview ? [...cloud.projectSubjects.keys()].filter(key => !uploadLocal.projectSubjects.has(key)) : [])
                },
                projectTopics:{
                    push:new Set([...uploadLocal.projectTopics.keys()].filter(key => !cloud.projectTopics.has(key))),
                    pull:new Set(projectOnlyPreview ? [...cloud.projectTopics.keys()].filter(key => !uploadLocal.projectTopics.has(key)) : [])
                }
            };
            const finalLocal = {
                subjects:[...uploadLocal.subjects.values()].map(row => row.original),
                tasks:[...uploadLocal.tasks.values()].map(row => row.original),
                settings:uploadLocal.settings,
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
            await pushChanges(client, userId, generation, finalSnapshot, cloud, plan, operation);
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
            const localFingerprint = await datasetFingerprint(local);
            const cloud = await readCloudData(client, userId);
            assertOperationIdentity(userId, generation);
            local = readLocalData();
            if(await datasetFingerprint(local) !== localFingerprint){
                throw new SyncConflictError("Local data changed while the cloud was being checked. No local values were overwritten; run Sync now again.");
            }
            const state = readState();
            if(!state){
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
            if(!hasProjectBaseline(state)){
                await processFirstProjectSync(client, userId, generation, local, localFingerprint, cloud, state);
                return;
            }
            validateProjectNameCollisions(local, cloud);
            const plan = {
                subjects:await classifyRecords("subject", local.subjects, cloud.subjects, state.baseline.subjects),
                tasks:await classifyRecords("task", local.tasks, cloud.tasks, state.baseline.tasks),
                settings:await classifySettings(local.settings, cloud.settings, state.baseline.settings),
                projectSubjects:await classifyRecords("Project subject", local.projectSubjects, cloud.projectSubjects, state.baseline.projectSubjects),
                projectTopics:await classifyProjectTopics(local, cloud, state.baseline.projectTopics, state.baseline.projectTopicOrders)
            };
            const finalLocal = applyPulls(local, cloud, plan);
            const finalSnapshot = makeLocalData(finalLocal.subjects, finalLocal.tasks, finalLocal.settings, finalLocal.projectSubjects, finalLocal.projectTopics);
            await assertLocalUnchanged(localFingerprint);
            await pushChanges(client, userId, generation, finalSnapshot, cloud, plan, operation);
            assertOperationIdentity(userId, generation);
            await assertLocalUnchanged(localFingerprint);
            const verifiedCloud = await readCloudData(client, userId);
            assertOperationIdentity(userId, generation);
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
        setStatus("failed", "Sync failed. Local data was preserved and no cloud records were deleted. Some confirmed writes may have reached the cloud; Sync now is safe to retry.");
    }

    function cancelPreview(){
        if(busy) return;
        pendingUpload = null;
        previewPanel.classList.add("hidden");
        setStatus("idle", "Upload cancelled. No local data was uploaded.");
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
