/* Select the local workspace before script.js reads or writes application data. */
(function bootstrapIronMindWorkspace(){
    "use strict";

    const CLIENT_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";
    const LOCAL_APP_ORIGIN = "http://127.0.0.1:8000";
    const APP_KEY_PREFIX = "ironMind";
    const WORKSPACE_PREFIX = "im-workspace:v1:";
    const RESOURCE_DB_PREFIX = "ironMindProjectResources:user:";
    const RESOURCE_DB_BASE = "ironMindProjectResources";
    const RESOURCE_STORE = "resources";
    const RESOURCE_DB_VERSION = 1;
    const LAST_USER_KEY = "im-workspace:last-user:v1";
    const WORKSPACE_OVERRIDE_KEY = "im-workspace:override:v1";
    const BOOT_TIMEOUT_MS = 4500;
    const nativeStorage = window.localStorage;
    let authStorageKey = null;
    function setAuthStorageKey(config){
        authStorageKey = null;
        try{
            const projectRef = new URL(config?.url).hostname.split(".")[0];
            if(projectRef) authStorageKey = `sb-${projectRef}-auth-token`;
        }catch(error){ /* A missing or invalid config simply leaves the device workspace active. */ }
    }
    setAuthStorageKey(window.IRON_MIND_SUPABASE_CONFIG || {});
    let activeUserId = null;
    let activeStorage = null;
    let authClientPromise = null;
    let authClient = null;
    let currentSession = null;
    let authAvailable = false;
    let authError = null;
    let authListenerAttached = false;
    let startupAuthVerified = false;
    let applicationReady = false;
    let authBootFailed = false;
    let pendingPasswordRecoveryEvent = false;
    let switchInProgress = false;
    let pendingCopySnapshot = null;

    function isUserId(value){
        return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    }

    function withBootTimeout(promise, message){
        let timeoutId;
        const timeout = new Promise((resolve, reject) => {
            timeoutId = setTimeout(() => reject(new Error(message)), BOOT_TIMEOUT_MS);
        });
        return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
    }

    function isRejectedAuthSession(error){
        return [400, 401, 403].includes(Number(error?.status));
    }

    function isDeviceWorkspaceOverride(){
        try{ return sessionStorage.getItem(WORKSPACE_OVERRIDE_KEY) === "device"; }
        catch(error){ return false; }
    }

    function accountPrefix(userId){ return `${WORKSPACE_PREFIX}${userId}:`; }
    function resourceDatabaseName(userId = activeUserId){
        return userId ? `${RESOURCE_DB_PREFIX}${userId}` : RESOURCE_DB_BASE;
    }

    function workspaceKeys(userId = activeUserId){
        const prefix = userId ? accountPrefix(userId) : "";
        const keys = [];
        for(let index = 0; index < nativeStorage.length; index++){
            const physicalKey = nativeStorage.key(index);
            if(!physicalKey) continue;
            if(userId){
                if(physicalKey.startsWith(prefix)) keys.push(physicalKey.slice(prefix.length));
            }else if(physicalKey.startsWith(APP_KEY_PREFIX)) keys.push(physicalKey);
        }
        return keys;
    }

    function physicalKey(key, userId = activeUserId){
        const value = String(key);
        if(!value.startsWith(APP_KEY_PREFIX)) throw new Error("Invalid IRON MIND storage key.");
        return userId ? `${accountPrefix(userId)}${value}` : value;
    }

    class WorkspaceStorage{
        get length(){ return workspaceKeys().length; }
        key(index){ return workspaceKeys()[Number(index)] ?? null; }
        getItem(key){ return nativeStorage.getItem(physicalKey(key)); }
        setItem(key, value){
            if(activeUserId && nativeStorage.getItem(copyStateKey(activeUserId)) === "copying"){
                throw new Error("This account workspace is being initialized from the device workspace. Retry after it finishes.");
            }
            nativeStorage.setItem(physicalKey(key), String(value));
        }
        removeItem(key){
            if(activeUserId && nativeStorage.getItem(copyStateKey(activeUserId)) === "copying"){
                throw new Error("This account workspace is being initialized from the device workspace. Retry after it finishes.");
            }
            nativeStorage.removeItem(physicalKey(key));
        }
        clear(){ workspaceKeys().forEach(key => this.removeItem(key)); }
        entries(){ return workspaceKeys().map(key => [key, this.getItem(key)]); }
    }

    function copyStateKey(userId){ return `im-workspace:copy-state:v1:${userId}`; }

    function jsonOrNull(raw){
        try{ return JSON.parse(raw); }catch(error){ return null; }
    }

    function isEmptyWorkspace(userId){
        const entries = workspaceKeys(userId).map(key => [key, nativeStorage.getItem(physicalKey(key, userId))]);
        const allowedArrayKeys = new Set([
            "ironMindSubjects", "ironMindTasks", "ironMindProjectTopics",
            "ironMindProjectSubjects", "ironMindProjectNotes", "ironMindRecycleBin"
        ]);
        const allowedObjectKeys = new Set(["ironMindProjectSubjectIds", "ironMindProjectExpandedTopics"]);
        const defaults = { autoDelete:"never", customDeleteDays:"", recycleBinRetentionDays:30, theme:"dark" };
        for(const [key, raw] of entries){
            const value = jsonOrNull(raw);
            if(allowedArrayKeys.has(key)){ if(!Array.isArray(value) || value.length) return false; }
            else if(allowedObjectKeys.has(key)){ if(!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length) return false; }
            else if(key === "ironMindSettings"){
                if(!value || typeof value !== "object" || Array.isArray(value)) return false;
                if(Object.keys(value).some(name => !(name in defaults) || value[name] !== defaults[name])) return false;
            }else return false;
        }
        return true;
    }

    function listDatabases(){
        if(!window.indexedDB || typeof window.indexedDB.databases !== "function"){
            return Promise.reject(new Error("This browser cannot safely inspect saved resource databases, so the device workspace cannot be copied."));
        }
        return window.indexedDB.databases();
    }

    function openExistingDatabase(name){
        return new Promise((resolve, reject) => {
            let refusedUpgrade = false;
            const request = window.indexedDB.open(name);
            request.onupgradeneeded = () => {
                refusedUpgrade = true;
                try{ request.transaction.abort(); }catch(error){ /* The empty database must not be created by a read. */ }
            };
            request.onsuccess = () => {
                const database = request.result;
                if(refusedUpgrade){ database.close(); reject(new Error("A resource database changed while it was being inspected.")); return; }
                database.onversionchange = () => database.close();
                resolve(database);
            };
            request.onerror = () => reject(request.error || new Error("A saved resource database could not be opened."));
        });
    }

    async function readResourceDatabase(name){
        const databases = await listDatabases();
        if(!databases.some(database => database.name === name)) return { exists:false, records:[] };
        const database = await openExistingDatabase(name);
        try{
            if(!database.objectStoreNames.contains(RESOURCE_STORE)) throw new Error("A saved resource database is missing its resources store.");
            const records = await new Promise((resolve, reject) => {
                const transaction = database.transaction(RESOURCE_STORE, "readonly");
                const request = transaction.objectStore(RESOURCE_STORE).getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error || new Error("Saved resource files could not be read."));
                transaction.onabort = () => reject(transaction.error || new Error("Saved resource files could not be read."));
            });
            return { exists:true, records };
        }finally{ database.close(); }
    }

    function openOrCreateDatabase(name){
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(name, RESOURCE_DB_VERSION);
            request.onupgradeneeded = () => {
                const database = request.result;
                let store;
                if(!database.objectStoreNames.contains(RESOURCE_STORE)) store = database.createObjectStore(RESOURCE_STORE, { keyPath:"id" });
                else store = request.transaction.objectStore(RESOURCE_STORE);
                if(!store.indexNames.contains("byOwner")) store.createIndex("byOwner", ["subjectId", "ownerType", "ownerId"], { unique:false });
            };
            request.onsuccess = () => {
                const database = request.result;
                database.onversionchange = () => database.close();
                resolve(database);
            };
            request.onerror = () => reject(request.error || new Error("The account resource database could not be opened."));
            request.onblocked = () => reject(new Error("The account resource database is open in another tab. Close other IRON MIND tabs and retry."));
        });
    }

    function replaceResourceRecords(database, records){
        return new Promise((resolve, reject) => {
            let transaction;
            try{
                if(!database.objectStoreNames.contains(RESOURCE_STORE)) throw new Error("The account resource database is missing its resources store.");
                transaction = database.transaction(RESOURCE_STORE, "readwrite");
                const store = transaction.objectStore(RESOURCE_STORE);
                store.clear();
                records.forEach(record => store.add(record));
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error || new Error("Resource files could not be copied."));
                transaction.onabort = () => reject(transaction.error || new Error("Resource file copy was rolled back."));
            }catch(error){
                try{ transaction?.abort(); }catch(abortError){ /* It may already be inactive. */ }
                reject(error);
            }
        });
    }

    function deleteDatabase(name){
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error || new Error("A temporary account resource database could not be removed."));
            request.onblocked = () => reject(new Error("A temporary account resource database is open in another tab. Close other IRON MIND tabs and retry."));
        });
    }

    function removeWorkspaceKeys(userId){
        workspaceKeys(userId).forEach(key => nativeStorage.removeItem(physicalKey(key, userId)));
    }

    async function recoverInterruptedCopy(userId){
        if(nativeStorage.getItem(copyStateKey(userId)) !== "copying") return;
        removeWorkspaceKeys(userId);
        const dbName = resourceDatabaseName(userId);
        const databases = await listDatabases();
        if(databases.some(database => database.name === dbName)) await deleteDatabase(dbName);
        nativeStorage.removeItem(copyStateKey(userId));
    }

    function createWorkspace(userId){
        activeUserId = userId;
        activeStorage = new WorkspaceStorage();
        const authenticatedUserId = isUserId(currentSession?.user?.id) ? currentSession.user.id : null;
        return {
            userId,
            authenticatedUserId,
            isDeviceWorkspace:!userId,
            storage:activeStorage,
            resourceDatabaseName:resourceDatabaseName(userId),
            authConfigured:Boolean(window.IRON_MIND_SUPABASE_CONFIG?.url && window.IRON_MIND_SUPABASE_CONFIG?.publishableKey),
            authAvailable,
            authError,
            session:currentSession,
            getClient(){
                if(!authClientPromise) return Promise.reject(authError || new Error("Cloud accounts are not configured."));
                return authClientPromise;
            },
            async previewDeviceCopy(){
                const targetUserId = isUserId(currentSession?.user?.id) ? currentSession.user.id : activeUserId;
                if(!targetUserId) throw new Error("Sign in before copying device data into an account.");
                if(!isEmptyWorkspace(targetUserId)) throw new Error("This account workspace already has data. Export it first; copying is only available into an empty account workspace.");
                const entries = workspaceKeys(null).map(key => [key, nativeStorage.getItem(key)]);
                const deviceResources = await readResourceDatabase(RESOURCE_DB_BASE);
                const targetResources = await readResourceDatabase(resourceDatabaseName(targetUserId));
                if(targetResources.records.length) throw new Error("This account already has saved resource files. Export it before copying device data.");
                const resourceBytes = deviceResources.records.reduce((sum, record) => {
                    if(!(record.file instanceof Blob) || record.fileSize !== record.file.size) throw new Error("A device resource is incomplete, so no data was copied.");
                    return sum + record.file.size;
                }, 0);
                const preview = { localStorageKeys:entries.length, resourceRecords:deviceResources.records.length, resourceBytes };
                const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
                pendingCopySnapshot = { userId:targetUserId, token, entries, records:deviceResources.records, preview };
                return { ...preview, token };
            },
            async copyDeviceToAccount(token){
                const userId = isUserId(currentSession?.user?.id) ? currentSession.user.id : activeUserId;
                if(!userId) throw new Error("Sign in before copying device data into an account.");
                const snapshot = pendingCopySnapshot;
                if(!snapshot || snapshot.token !== token || snapshot.userId !== userId) throw new Error("The device data preview expired. Review it again before copying.");
                pendingCopySnapshot = null;
                const { entries, records, preview } = snapshot;
                const dbName = resourceDatabaseName(userId);
                const targetBefore = await readResourceDatabase(dbName);
                if(!isEmptyWorkspace(userId) || targetBefore.records.length){
                    throw new Error("This account workspace changed after the preview. Nothing was copied; review the device data again.");
                }
                const stateKey = copyStateKey(userId);
                if(nativeStorage.getItem(stateKey) === "copying"){
                    throw new Error("Another device copy is already initializing this account workspace. Retry after it finishes.");
                }
                let database = null;
                let createdDatabase = false;
                const destinationSnapshots = entries.map(([key]) => {
                    const targetKey = physicalKey(key, userId);
                    return [targetKey, nativeStorage.getItem(targetKey)];
                });
                nativeStorage.setItem(stateKey, "copying");
                try{
                    for(const [key, value] of entries){
                        const targetKey = physicalKey(key, userId);
                        nativeStorage.setItem(targetKey, value);
                    }
                    if(records.length){
                        database = await openOrCreateDatabase(dbName);
                        createdDatabase = !targetBefore.exists;
                        await replaceResourceRecords(database, records);
                    }
                    nativeStorage.setItem(stateKey, "complete");
                    return { ...preview };
                }catch(error){
                    if(database) database.close();
                    destinationSnapshots.forEach(([key, value]) => {
                        try{
                            if(value === null) nativeStorage.removeItem(key);
                            else nativeStorage.setItem(key, value);
                        }catch(cleanupError){ /* The copying marker keeps this workspace locked for recovery. */ }
                    });
                    if(createdDatabase){
                        try{ await deleteDatabase(dbName); }catch(cleanupError){ /* Startup recovery will retry after the database is closed. */ }
                    }
                    if(nativeStorage.getItem(stateKey) === "copying" && destinationSnapshots.every(([key, value]) => nativeStorage.getItem(key) === value)){
                        try{ nativeStorage.removeItem(stateKey); }catch(cleanupError){ /* Startup recovery will finish cleanup. */ }
                    }
                    throw error;
                }finally{ database?.close(); }
            },
            openDeviceWorkspace(){
                sessionStorage.setItem(WORKSPACE_OVERRIDE_KEY, "device");
                lockAndReload("Opening the device workspace…");
            },
            openAccountWorkspace(){
                const targetUserId = isUserId(currentSession?.user?.id) ? currentSession.user.id : activeUserId;
                if(!targetUserId) throw new Error("Sign in before opening an account workspace.");
                sessionStorage.removeItem(WORKSPACE_OVERRIDE_KEY);
                lockAndReload("Opening this account’s local workspace…");
            }
        };
    }

    function lockAndReload(message){
        if(switchInProgress) return;
        switchInProgress = true;
        showStatus(message, false, false);
        document.documentElement.inert = true;
        setTimeout(() => window.location.reload(), 0);
    }

    window.addEventListener("storage", event => {
        if(event.key !== LAST_USER_KEY && (!authStorageKey || event.key !== authStorageKey)) return;
        const hintedUserId = nativeStorage.getItem(LAST_USER_KEY);
        const sessionUserId = isUserId(currentSession?.user?.id) ? currentSession.user.id : null;
        if(activeUserId && hintedUserId !== activeUserId){
            lockAndReload(hintedUserId ? "Another tab changed accounts. Switching local workspaces…" : "Another tab signed out. Opening the device workspace…");
        }else if(!activeUserId && hintedUserId && hintedUserId !== sessionUserId){
            lockAndReload("Another tab changed accounts. Opening the matching local workspace…");
        }else if(activeUserId && event.key === authStorageKey && hintedUserId !== activeUserId){
            lockAndReload("Another tab changed accounts. Switching local workspaces…");
        }
    });

    function showStatus(message, showButton = false, error = false){
        let panel = document.getElementById("ironMindWorkspaceBootStatus");
        if(!panel){
            panel = document.createElement("div");
            panel.id = "ironMindWorkspaceBootStatus";
            panel.setAttribute("role", "status");
            panel.innerHTML = '<div class="workspace-boot-card"><strong>IRON MIND</strong><p></p><button type="button" class="hidden">Continue in device workspace</button></div>';
            document.body.appendChild(panel);
            const style = document.createElement("style");
            style.textContent = "#ironMindWorkspaceBootStatus{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:rgba(10,15,30,.96);color:#f8fafc;font:16px system-ui}#ironMindWorkspaceBootStatus .workspace-boot-card{max-width:460px;margin:24px;padding:28px;border:1px solid #334155;border-radius:16px;background:#172033;box-shadow:0 20px 70px #0008}#ironMindWorkspaceBootStatus p{line-height:1.5;color:#cbd5e1}#ironMindWorkspaceBootStatus button{padding:10px 14px;border:0;border-radius:9px;background:#6d5dfc;color:white;font-weight:700;cursor:pointer}#ironMindWorkspaceBootStatus .hidden{display:none}";
            document.head.appendChild(style);
        }
        panel.querySelector("p").textContent = message;
        panel.style.color = error ? "#fecaca" : "#f8fafc";
        const button = panel.querySelector("button");
        button.classList.toggle("hidden", !showButton);
        if(showButton){
            button.onclick = () => {
                try{ sessionStorage.setItem(WORKSPACE_OVERRIDE_KEY, "device"); }
                catch(error){ /* The current page can still open the device workspace. */ }
                if(!authAvailable){
                    authBootFailed = true;
                    currentSession = null;
                    pendingPasswordRecoveryEvent = false;
                }
                loadApplication(null, authAvailable ? currentSession : null, authAvailable);
            };
        }
    }

    function loadClassicScript(src){
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`The app file ${src} could not be loaded.`));
            document.body.appendChild(script);
        });
    }

    function matchesConfiguredSite(siteUrl){
        try{
            const configuredUrl = new URL(siteUrl);
            const currentUrl = new URL(window.location.href);
            if(!["http:", "https:"].includes(configuredUrl.protocol) || configuredUrl.origin !== currentUrl.origin ||
                configuredUrl.username || configuredUrl.password || configuredUrl.search || configuredUrl.hash) return false;
            const configuredPath = configuredUrl.pathname.replace(/\/+$/, "") || "/";
            const currentPath = currentUrl.pathname.replace(/\/+$/, "") || "/";
            return configuredPath === "/" || currentPath === configuredPath || currentPath.startsWith(`${configuredPath}/`);
        }catch(error){
            return false;
        }
    }

    async function loadApplication(userId, session, authWasAvailable){
        activeUserId = userId;
        currentSession = session || null;
        authAvailable = Boolean(authWasAvailable);
        activeStorage = new WorkspaceStorage();
        if(userId) await recoverInterruptedCopy(userId);
        const workspace = createWorkspace(userId);
        window.IRON_MIND_WORKSPACE = workspace;
        try{
            await loadClassicScript("./script.js?v=iron-mind-safe-sync-deletions-v1");
            try{
                await loadClassicScript("./supabase-sync.js?v=iron-mind-safe-sync-deletions-v1");
            }catch(error){
                // Cloud sync is optional; the local-first app must still start if this asset is unavailable offline.
            }
            await loadClassicScript("./supabase-auth.js");
            applicationReady = true;
            if(pendingPasswordRecoveryEvent && currentSession?.user?.id){
                window.dispatchEvent(new CustomEvent("iron-mind-auth-session", {
                    detail:{ event:"PASSWORD_RECOVERY", session:currentSession }
                }));
            }
            pendingPasswordRecoveryEvent = false;
            const panel = document.getElementById("ironMindWorkspaceBootStatus");
            panel?.remove();
            document.documentElement.inert = false;
        }catch(error){
            showStatus(error?.message || "IRON MIND could not be started.", true, true);
        }
    }

    function attachAuthListener(client){
        if(authListenerAttached) return;
        authListenerAttached = true;
        client.auth.onAuthStateChange((event, session) => {
            if(authBootFailed) return;
            if(!startupAuthVerified || !applicationReady){
                if(event === "PASSWORD_RECOVERY") pendingPasswordRecoveryEvent = true;
                return;
            }
            if(event === "INITIAL_SESSION") return;
            if(event === "PASSWORD_RECOVERY" && session?.user?.id !== currentSession?.user?.id) return;
            const previousUserId = isUserId(currentSession?.user?.id) ? currentSession.user.id : null;
            currentSession = session || null;
            if(event === "SIGNED_OUT") nativeStorage.removeItem(LAST_USER_KEY);
            else if(isUserId(session?.user?.id)) nativeStorage.setItem(LAST_USER_KEY, session.user.id);
            if(event !== "INITIAL_SESSION"){
                try{ sessionStorage.removeItem(WORKSPACE_OVERRIDE_KEY); }catch(error){ /* Ignore unavailable session storage. */ }
            }
            const nextUserId = isUserId(session?.user?.id) ? session.user.id : null;
            if(window.IRON_MIND_WORKSPACE){
                window.IRON_MIND_WORKSPACE.session = currentSession;
                window.IRON_MIND_WORKSPACE.authenticatedUserId = isUserId(session?.user?.id) ? session.user.id : null;
                window.IRON_MIND_WORKSPACE.authAvailable = true;
                window.IRON_MIND_WORKSPACE.authError = null;
            }
            window.dispatchEvent(new CustomEvent("iron-mind-auth-session", { detail:{ event, session:currentSession } }));
            if(event !== "INITIAL_SESSION" && nextUserId !== previousUserId && nextUserId !== activeUserId){
                lockAndReload(nextUserId ? "Switching to this account’s local workspace…" : "Signed out. Opening the device workspace…");
            }
        });
    }

    async function initialize(){
        showStatus("Selecting the correct local workspace…");

        if(window.location.origin !== LOCAL_APP_ORIGIN){
            // Never let the local development endpoint/config leak into another origin.
            window.IRON_MIND_SUPABASE_CONFIG = null;
            try{
                await loadClassicScript("./supabase-config.production.js");
                const candidate = window.IRON_MIND_SUPABASE_CONFIG;
                const siteOrigin = typeof candidate?.siteOrigin === "string" ? candidate.siteOrigin.trim() : "";
                const url = typeof candidate?.url === "string" ? candidate.url.trim() : "";
                const publishableKey = typeof candidate?.publishableKey === "string" ? candidate.publishableKey.trim() : "";
                if(matchesConfiguredSite(siteOrigin) && url && publishableKey){
                    window.IRON_MIND_SUPABASE_CONFIG = Object.freeze({ siteOrigin, url, publishableKey });
                }else{
                    window.IRON_MIND_SUPABASE_CONFIG = null;
                }
            }catch(error){
                window.IRON_MIND_SUPABASE_CONFIG = null;
            }
        }
        setAuthStorageKey(window.IRON_MIND_SUPABASE_CONFIG || {});
        const config = window.IRON_MIND_SUPABASE_CONFIG || {};
        const configured = typeof config.url === "string" && config.url.trim() &&
            typeof config.publishableKey === "string" && config.publishableKey.trim();
        let session = null;
        if(configured){
            authClientPromise = import(CLIENT_URL).then(module => {
                if(typeof module.createClient !== "function") throw new Error("The Supabase client could not be loaded.");
                authClient = module.createClient(config.url.trim(), config.publishableKey.trim(), {
                    auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, skipAutoInitialize:true }
                });
                attachAuthListener(authClient);
                return authClient;
            });
            const startupStatePromise = authClientPromise.then(async client => {
                const initialization = await client.auth.initialize();
                if(initialization?.error){
                    if(isRejectedAuthSession(initialization.error)) return { session:null, authAvailable:true };
                    throw initialization.error;
                }

                const stored = await client.auth.getSession();
                if(stored.error){
                    if(isRejectedAuthSession(stored.error)) return { session:null, authAvailable:true };
                    throw stored.error;
                }

                const candidate = stored.data?.session || null;
                const candidateUserId = candidate?.user?.id;
                if(!candidate || !isUserId(candidateUserId)) return { session:null, authAvailable:true };

                const verification = await client.auth.getUser();
                if(verification.error){
                    if(isRejectedAuthSession(verification.error)) return { session:null, authAvailable:true };
                    throw verification.error;
                }
                const verifiedUser = verification.data?.user;
                if(!isUserId(verifiedUser?.id) || verifiedUser.id !== candidateUserId){
                    throw new Error("The saved account could not be verified. Its account workspace remains locked.");
                }
                return { session:{ ...candidate, user:verifiedUser }, authAvailable:true };
            });
            try{
                const startupState = await withBootTimeout(startupStatePromise, "Account state could not be verified yet.");
                session = startupState.session;
                authAvailable = startupState.authAvailable;
                startupAuthVerified = true;
                authError = null;
                if(isUserId(session?.user?.id)) nativeStorage.setItem(LAST_USER_KEY, session.user.id);
                else nativeStorage.removeItem(LAST_USER_KEY);
                currentSession = session;
            }catch(error){
                authError = error;
                authAvailable = false;
                currentSession = null;
                authBootFailed = true;
                pendingPasswordRecoveryEvent = false;
                if(!isDeviceWorkspaceOverride()){
                    showStatus("Supabase could not verify the saved account. Its account workspace is locked. Continue in the device workspace to use local data.", true, true);
                    return;
                }
            }
        }else{
            authError = new Error("Cloud accounts are not configured.");
        }

        let userId = isUserId(session?.user?.id) ? session.user.id : null;
        if(isDeviceWorkspaceOverride()) userId = null;
        if(userId) await loadApplication(userId, session, authAvailable);
        else await loadApplication(null, session, authAvailable);
    }

    initialize().catch(error => showStatus(error?.message || "The local workspace could not be opened.", true, true));
})();
