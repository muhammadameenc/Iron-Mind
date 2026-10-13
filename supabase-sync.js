/* Manual, local-first sync for task subjects, tasks, and user settings. */
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
        confirmButton.disabled = busy || !ready || !pendingUpload?.fingerprint;
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
            setStatus("offline", "Offline. Tasks, subjects, and settings remain available locally.");
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

    function makeLocalData(subjectRows, taskRows, settings){
        const localSubjects = new Map();
        if(!Array.isArray(subjectRows) || !Array.isArray(taskRows)){
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
        return { subjects:localSubjects, tasks:localTasks, settings };
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
        return makeLocalData(
            localSubjects,
            localTasks,
            parseStoredSettings()
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
        for(let offset = 0; ; ){
            const result = await client.from(table)
                .select(columns)
                .eq("user_id", userId)
                .order(orderColumn, { ascending:true })
                .range(offset, offset + pageSize - 1);
            const page = checkedResult(result, `Cloud ${table === "tasks" ? "tasks" : "task subjects"} could not be read.`) || [];
            if(!Array.isArray(page)) throw new SyncConflictError("The cloud returned an unexpected page of records.");
            if(page.length === 0) return rows;
            rows.push(...page);
            offset += page.length;
        }
    }

    async function readCloudData(client, userId){
        const [subjectRows, taskRows, settingsResult] = await Promise.all([
            readAllRows(client, "task_subjects", "id,user_id,name,priority,revision", "id", userId),
            readAllRows(client, "tasks", "id,user_id,subject_id,legacy_id,topic,source,task_date,status,remarks,revision", "id", userId),
            client.from("user_settings")
                .select("user_id,settings,revision")
                .eq("user_id", userId)
                .limit(2)
        ]);
        const settingsRows = checkedResult(settingsResult, "Cloud settings could not be read.") || [];
        if(!Array.isArray(subjectRows) || !Array.isArray(taskRows) || !Array.isArray(settingsRows) || settingsRows.length > 1){
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
        return { subjects:cloudSubjects, tasks:cloudTasks, settings, settingsRevision:settingsRow ? Number(settingsRow.revision) : null };
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
        return data.subjects.size > 0 || data.tasks.size > 0 || data.settings !== null;
    }

    async function mapsEqual(left, right){
        if(left.size !== right.size) return false;
        const leftSigs = await signatures(left);
        const rightSigs = await signatures(right);
        return [...left.keys()].every(key => leftSigs[key] === rightSigs[key]);
    }

    async function sameData(local, cloud){
        const [subjectsMatch, tasksMatch, localSettings, cloudSettings] = await Promise.all([
            mapsEqual(local.subjects, cloud.subjects),
            mapsEqual(local.tasks, cloud.tasks),
            settingsSignature(local.settings),
            settingsSignature(cloud.settings)
        ]);
        return subjectsMatch && tasksMatch && localSettings === cloudSettings;
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
        return true;
    }

    async function datasetFingerprint(local){
        const subjectsList = [...local.subjects].sort(([a], [b]) => a.localeCompare(b)).map(([key, row]) => [key, row.canonical]);
        const tasksList = [...local.tasks].sort(([a], [b]) => a.localeCompare(b)).map(([key, row]) => [key, row.canonical]);
        return signature({ subjects:subjectsList, tasks:tasksList, settings:local.settings });
    }

    async function assertLocalUnchanged(expectedFingerprint){
        if(await datasetFingerprint(readLocalData()) !== expectedFingerprint){
            throw new SyncConflictError("Local data changed while sync was running. No local values were overwritten; run Sync now again.");
        }
    }

    function countForPreview(local, cloud){
        let subjectsToUpload = 0, tasksToUpload = 0, settingsToUpload = 0;
        for(const key of local.subjects.keys()) if(!cloud.subjects.has(key)) subjectsToUpload++;
        for(const key of local.tasks.keys()) if(!cloud.tasks.has(key)) tasksToUpload++;
        if(local.settings !== null && cloud.settings === null) settingsToUpload = 1;
        return { subjectsToUpload, tasksToUpload, settingsToUpload };
    }

    function showFirstUploadPreview(local, cloud, userId){
        const counts = countForPreview(local, cloud);
        const alreadyPresent = local.subjects.size + local.tasks.size + (local.settings === null ? 0 : 1) -
            counts.subjectsToUpload - counts.tasksToUpload - counts.settingsToUpload;
        const email = workspace.session?.user?.email || "this verified account";
        previewDetails.textContent =
            `Review first upload to ${email} (${userId}): ${counts.subjectsToUpload} task subjects, ${counts.tasksToUpload} tasks, and ${counts.settingsToUpload ? "your settings" : "no settings"} will be uploaded. ` +
            `${alreadyPresent} matching record(s) are already in the cloud and will not be replaced. Local data stays in this account workspace; nothing will be deleted.`;
        previewRecords.replaceChildren();
        const previewItems = [];
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
        const preview = { userId, fingerprint:null };
        pendingUpload = preview;
        previewPanel.classList.remove("hidden");
        setStatus("idle", "Not synced. Review the first-upload preview before any local data is uploaded.");
        updateControls();
        datasetFingerprint(local).then(fingerprint => {
            if(pendingUpload === preview){
                preview.fingerprint = fingerprint;
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

    async function makeState(userId, cloud){
        return {
            version:1,
            userId,
            syncedAt:new Date().toISOString(),
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
        return {
            subjects:subjectRows,
            tasks:taskRows,
            settings,
            changedSubjects:plan.subjects.pull.size > 0,
            changedTasks:plan.tasks.pull.size > 0,
            changedSettings:plan.settings.pull
        };
    }

    function ensureCloudSuccess(result, message){
        if(result.error) throw new Error(message);
        return result.data;
    }

    async function pushChanges(client, userId, generation, finalLocal, cloud, plan, operation){
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
        refreshApplicationAfterPull(local);
    }

    function refreshApplicationAfterPull(local){
        if(!local.changedSubjects && !local.changedTasks && !local.changedSettings) return;
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
        }catch(error){ /* Local records are already saved; the next app render will read them. */ }
    }

    async function persistBaselineOnly(userId, cloud){
        const state = await makeState(userId, cloud);
        workspace.storage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
        setStatus("synced", `Synced at ${new Date(state.syncedAt).toLocaleString()}.`);
    }

    async function localMatchesCloud(local, cloud){
        return sameData(local, cloud);
    }

    async function processFirstSync(client, userId, generation, local, localFingerprint, cloud){
        assertOperationIdentity(userId, generation);
        await assertLocalUnchanged(localFingerprint);
        const localHas = mapHasRecords(local), cloudHas = mapHasRecords(cloud);
        if(!localHas && !cloudHas){
            pendingUpload = null;
            previewPanel.classList.add("hidden");
            setStatus("idle", "Not synced. There are no tasks, subjects, or saved settings to sync yet.");
            return;
        }
        if(!localHas && cloudHas){
            const plan = {
                subjects:{ push:new Set(), pull:new Set(cloud.subjects.keys()) },
                tasks:{ push:new Set(), pull:new Set(cloud.tasks.keys()) },
                settings:{ push:false, pull:cloud.settings !== null }
            };
            const pulled = applyPulls(local, cloud, plan);
            const verifiedLocal = makeLocalData(pulled.subjects, pulled.tasks, pulled.settings);
            if(!await localMatchesCloud(verifiedLocal, cloud)) throw new SyncConflictError("Cloud data could not be verified before it was copied locally.");
            const state = await makeState(userId, cloud);
            assertOperationIdentity(userId, generation);
            await assertLocalUnchanged(localFingerprint);
            await persistResult({ ...pulled, changedSubjects:cloud.subjects.size > 0, changedTasks:cloud.tasks.size > 0, changedSettings:cloud.settings !== null }, state);
            pendingUpload = null;
            previewPanel.classList.add("hidden");
            setStatus("synced", `Downloaded cloud tasks and settings at ${new Date(state.syncedAt).toLocaleString()}.`);
            return;
        }
        if(localHas && cloudHas && await localMatchesCloud(local, cloud)){
            pendingUpload = null;
            previewPanel.classList.add("hidden");
            assertOperationIdentity(userId, generation);
            await assertLocalUnchanged(localFingerprint);
            await persistBaselineOnly(userId, cloud);
            return;
        }
        if(localHas && (!cloudHas || await cloudIsMatchingSubset(local, cloud))){
            showFirstUploadPreview(local, cloud, userId);
            return;
        }
        throw new SyncConflictError("This account and this device both contain different task or settings data, and there is no prior sync checkpoint. No data was changed. Resolve or back up the two datasets before syncing.");
    }

    async function confirmFirstUpload(){
        if(busy || !pendingUpload) return;
        if(setOfflineStatus()) return;
        const operation = { writesStarted:false };
        setBusy(true);
        setStatus("syncing", "Verifying the preview and uploading the confirmed records…");
        try{
            const { client, userId, generation } = await getVerifiedClient();
            if(userId !== pendingUpload.userId) throw new SyncConflictError("The signed-in account changed. Review the upload for the current account.");
            const local = readLocalData();
            if(await datasetFingerprint(local) !== pendingUpload.fingerprint){
                pendingUpload = null;
                previewPanel.classList.add("hidden");
                throw new SyncConflictError("Local data changed after the preview. Run Sync now to review a fresh preview.");
            }
            const cloud = await readCloudData(client, userId);
            assertOperationIdentity(userId, generation);
            const latestLocal = readLocalData();
            if(await datasetFingerprint(latestLocal) !== pendingUpload.fingerprint){
                pendingUpload = null;
                previewPanel.classList.add("hidden");
                throw new SyncConflictError("Local data changed while checking the cloud. Run Sync now to review a fresh preview.");
            }
            const uploadLocal = latestLocal;
            if(!await cloudIsMatchingSubset(uploadLocal, cloud)){
                pendingUpload = null;
                previewPanel.classList.add("hidden");
                throw new SyncConflictError("Cloud data changed after the preview. Neither dataset was replaced; run Sync now to review the conflict.");
            }
            const counts = countForPreview(uploadLocal, cloud);
            const plan = {
                subjects:{ push:new Set([...uploadLocal.subjects.keys()].filter(key => !cloud.subjects.has(key))), pull:new Set() },
                tasks:{ push:new Set([...uploadLocal.tasks.keys()].filter(key => !cloud.tasks.has(key))), pull:new Set() },
                settings:{ push:uploadLocal.settings !== null && cloud.settings === null, pull:false }
            };
            const finalLocal = {
                subjects:[...uploadLocal.subjects.values()].map(row => row.original),
                tasks:[...uploadLocal.tasks.values()].map(row => row.original),
                settings:uploadLocal.settings,
                changedSubjects:false,
                changedTasks:false,
                changedSettings:false
            };
            finalLocal.subjects = finalLocal.subjects.map(subject => ({ ...subject }));
            finalLocal.tasks = finalLocal.tasks.map(task => ({ ...task }));
            const finalSnapshot = makeLocalData(finalLocal.subjects, finalLocal.tasks, finalLocal.settings);
            await assertLocalUnchanged(pendingUpload.fingerprint);
            await pushChanges(client, userId, generation, finalSnapshot, cloud, plan, operation);
            assertOperationIdentity(userId, generation);
            const verifiedCloud = await readCloudData(client, userId);
            assertOperationIdentity(userId, generation);
            await assertLocalUnchanged(pendingUpload.fingerprint);
            if(!await localMatchesCloud(finalSnapshot, verifiedCloud)){
                throw new SyncConflictError("The uploaded data did not match the confirmed local snapshot. No local records were changed; review the cloud before retrying.");
            }
            const state = await makeState(userId, verifiedCloud);
            await workspace.storage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
            pendingUpload = null;
            previewPanel.classList.add("hidden");
            setStatus("synced", `Synced ${counts.subjectsToUpload} subject(s), ${counts.tasksToUpload} task(s), and ${counts.settingsToUpload ? "settings" : "no settings"} at ${new Date(state.syncedAt).toLocaleString()}.`);
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
                await processFirstSync(client, userId, generation, local, localFingerprint, cloud);
                return;
            }
            if(state.userId !== userId){
                throw new SyncConflictError("The local sync checkpoint belongs to a different account. No data was changed.");
            }
            const plan = {
                subjects:await classifyRecords("subject", local.subjects, cloud.subjects, state.baseline.subjects),
                tasks:await classifyRecords("task", local.tasks, cloud.tasks, state.baseline.tasks),
                settings:await classifySettings(local.settings, cloud.settings, state.baseline.settings)
            };
            const finalLocal = applyPulls(local, cloud, plan);
            const finalSnapshot = makeLocalData(finalLocal.subjects, finalLocal.tasks, finalLocal.settings);
            await assertLocalUnchanged(localFingerprint);
            await pushChanges(client, userId, generation, finalSnapshot, cloud, plan, operation);
            assertOperationIdentity(userId, generation);
            await assertLocalUnchanged(localFingerprint);
            const verifiedCloud = await readCloudData(client, userId);
            assertOperationIdentity(userId, generation);
            if(!await localMatchesCloud(finalSnapshot, verifiedCloud)){
                throw new SyncConflictError("Data changed during sync and could not be reconciled. Review both copies before retrying.");
            }
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
