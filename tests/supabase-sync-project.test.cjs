const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { TextEncoder } = require('node:util');
const crypto = require('node:crypto').webcrypto;

const syncSource = fs.readFileSync(path.join(__dirname, '..', 'supabase-sync.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

function extractFunction(source, name, nextFunction){
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf(`\nfunction ${nextFunction}(`, start);
    assert.notEqual(start, -1, `missing ${name} in app source`);
    assert.notEqual(end, -1, `missing boundary after ${name}`);
    return source.slice(start, end);
}

class TestElement {
    constructor(){
        this.dataset = {};
        this.textContent = '';
        this.disabled = false;
        this.children = [];
        this.listeners = {};
        const classes = new Set();
        this.classList = {
            add:name => classes.add(name),
            remove:name => classes.delete(name),
            contains:name => classes.has(name),
            toggle:(name, force) => {
                if(force === undefined) force = !classes.has(name);
                force ? classes.add(name) : classes.delete(name);
                return force;
            }
        };
    }
    addEventListener(type, callback){ this.listeners[type] = callback; }
    replaceChildren(){ this.children = []; }
    appendChild(child){ this.children.push(child); }
}

class MockQuery {
    constructor(database, table){
        this.database = database;
        this.table = table;
        this.mode = 'select';
        this.payload = null;
        this.filters = [];
        this.orders = [];
        this.offset = 0;
        this.end = Infinity;
        this.max = Infinity;
    }
    select(){ return this; }
    eq(key, value){ this.filters.push([key, value]); return this; }
    order(key, options = {}){ this.orders.push([key, options.ascending !== false]); return this; }
    range(start, end){ this.offset = start; this.end = end; return this.execute(false); }
    limit(max){ this.max = max; return this; }
    insert(payload){ this.mode = 'insert'; this.payload = payload; return this; }
    update(payload){ this.mode = 'update'; this.payload = payload; return this; }
    delete(){ this.mode = 'delete'; return this; }
    single(){ return this.execute(true); }
    maybeSingle(){ return this.execute(true); }
    then(resolve, reject){ return this.execute(false).then(resolve, reject); }
    async execute(single){
        const rows = this.database[this.table] || (this.database[this.table] = []);
        if(this.mode === 'insert'){
            const inputs = Array.isArray(this.payload) ? this.payload : [this.payload];
            const inserted = inputs.map(input => {
                if(input.id && rows.some(row => row.id === input.id)) return null;
                const row = { sync_generation:0, ...input, revision:1 };
                if(this.table === 'project_subjects') row.created_at = new Date(Date.now() + rows.length * 1000).toISOString();
                if(this.table === 'tasks' && !row.id) row.id = rows.length + 1;
                if(this.table === 'task_subjects' && !row.id) row.id = `cccccccc-cccc-4ccc-8ccc-${String(rows.length + 1).padStart(12, '0')}`;
                rows.push(row);
                return row;
            });
            if(inserted.includes(null)) return { data:null, error:{ message:'duplicate ID' } };
            return { data:single ? inserted[0] : inserted, error:null };
        }
        let selected = rows.filter(row => this.filters.every(([key, value]) => row[key] === value));
        if(this.mode === 'update'){
            selected.forEach(row => { Object.assign(row, this.payload); row.revision = Number(row.revision || 0) + 1; });
            return { data:single ? (selected[0] || null) : selected, error:null };
        }
        if(this.mode === 'delete'){
            const removed = new Set(selected);
            this.database[this.table] = rows.filter(row => !removed.has(row));
            return { data:single ? (selected[0] || null) : selected, error:null };
        }
        for(const [key, ascending] of this.orders.slice().reverse()){
            selected.sort((left, right) => {
                const a = left[key] ?? '', b = right[key] ?? '';
                const compared = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
                return ascending ? compared : -compared;
            });
        }
        selected = single ? selected.slice(0, 1) : selected.slice(this.offset, Math.min(this.end + 1, this.offset + this.max));
        return { data:single ? (selected[0] || null) : selected, error:null };
    }
}

function createSyncHarness({ database, projectSubjects = [], projectTopics = [], subjects = [], tasks = [], settings = null, state = null, storageData:initialStorage = null }){
    const elements = new Map();
    const document = {
        getElementById(id){
            if(!elements.has(id)) elements.set(id, new TestElement());
            return elements.get(id);
        },
        createElement(){ return new TestElement(); }
    };
    const storageData = initialStorage ? new Map(initialStorage) : new Map([
        ['ironMindSubjects', JSON.stringify(subjects)],
        ['ironMindTasks', JSON.stringify(tasks)],
        ['ironMindProjectSubjects', JSON.stringify(projectSubjects)],
        ['ironMindProjectTopics', JSON.stringify(projectTopics)]
    ]);
    if(settings !== null && !storageData.has('ironMindSettings')) storageData.set('ironMindSettings', JSON.stringify(settings));
    if(state !== null) storageData.set('ironMindCloudSyncState', JSON.stringify(state));
    const storedArray = (key, fallback) => JSON.parse(storageData.get(key) || JSON.stringify(fallback));
    const localSubjects = storedArray('ironMindSubjects', subjects);
    const localTasks = storedArray('ironMindTasks', tasks);
    const localProjectSubjects = storedArray('ironMindProjectSubjects', projectSubjects);
    const localProjectTopics = storedArray('ironMindProjectTopics', projectTopics);
    const storage = {
        getItem:key => storageData.has(key) ? storageData.get(key) : null,
        setItem:(key, value) => storageData.set(key, String(value)),
        removeItem:key => storageData.delete(key),
        clear:() => storageData.clear(),
        entries:() => [...storageData.entries()]
    };
    const client = {
        auth:{ getUser:async () => ({ data:{ user:{ id:'test-user' } }, error:null }) },
        from:table => new MockQuery(database, table),
        rpc:async name => {
            assert.equal(name, 'delete_my_app_data');
            const userId = 'test-user';
            const tableNames = ['notes','resource_metadata','recycle_bin_entries','tasks','project_topics','project_subjects','task_subjects','user_settings','sync_tombstones'];
            const hadData = tableNames.some(table => (database[table] || []).some(row => row.user_id === userId));
            let stateRow = (database.user_sync_state || []).find(row => row.user_id === userId);
            let generation = stateRow?.reset_generation || 0;
            if(!stateRow || hadData || generation === 0){
                generation = stateRow ? generation + 1 : 1;
                if(stateRow) stateRow.reset_generation = generation;
                else (database.user_sync_state ||= []).push({ user_id:userId, reset_generation:generation, revision:1 });
            }
            for(const table of tableNames) database[table] = (database[table] || []).filter(row => row.user_id !== userId);
            return { data:generation, error:null };
        }
    };
    const workspace = {
        userId:'test-user',
        authenticatedUserId:'test-user',
        authAvailable:true,
        session:{ user:{ email:'sync-test@example.invalid' } },
        storage,
        getClient:async () => client
    };
    const window = { IRON_MIND_WORKSPACE:workspace, crypto, addEventListener(){} };
    const context = {
        window, document, navigator:{ onLine:true }, TextEncoder, crypto,
        subjects:localSubjects.map(row => ({ ...row })), tasks:localTasks.map(row => ({ ...row })), projectSubjectRecords:localProjectSubjects, projectTopicRecords:localProjectTopics,
        appSettings:{}, defaultSettings:{}, Date, Map, Set, Promise, JSON, Number, String, Array, Object, Error, Uint8Array, Intl
    };
    vm.createContext(context);
    vm.runInContext(syncSource, context, { filename:'supabase-sync.js' });

    async function click(id){
        const callback = elements.get(id)?.listeners.click;
        assert.equal(typeof callback, 'function', `missing ${id} handler`);
        await callback();
        if(id === 'cloudSyncNowButton'){
            for(let attempt = 0; attempt < 100 && elements.get('cloudSyncPreview').classList.contains('hidden') === false && elements.get('cloudSyncConfirmButton').disabled; attempt++){
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }
    }
    function setLocalProjectData(subjects, topics){
        context.projectSubjectRecords = subjects;
        context.projectTopicRecords = topics;
        storage.setItem('ironMindProjectSubjects', JSON.stringify(subjects));
        storage.setItem('ironMindProjectTopics', JSON.stringify(topics));
    }
    function setLocalTaskData(nextSubjects, nextTasks){
        context.subjects = nextSubjects;
        context.tasks = nextTasks;
        storage.setItem('ironMindSubjects', JSON.stringify(nextSubjects));
        storage.setItem('ironMindTasks', JSON.stringify(nextTasks));
    }
    return { click, context, elements, storage, setLocalProjectData, setLocalTaskData };
}

const ids = {
    laptopSubject:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    laptopRoot:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
    laptopChild:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
    phoneSubject:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    phoneRoot:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    phoneChild:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
};

function emptyDatabase(){
    return { project_subjects:[], project_topics:[], task_subjects:[], tasks:[], user_settings:[], sync_tombstones:[], user_sync_state:[], notes:[], resource_metadata:[], recycle_bin_entries:[] };
}

test('no-checkpoint tombstones are saved and checkpointed without active records', async () => {
    const database = emptyDatabase();
    const device = createSyncHarness({
        database,
        storageData:new Map([
            ['ironMindSubjects', '[]'],
            ['ironMindTasks', '[]'],
            ['ironMindProjectSubjects', '[]'],
            ['ironMindProjectTopics', '[]'],
            ['ironMindCloudTombstones', JSON.stringify({ 'task:orphaned-task':true })]
        ])
    });

    await device.click('cloudSyncNowButton');

    assert.deepEqual(database.sync_tombstones.map(row => [row.entity_type, row.entity_key, row.is_deleted]), [
        ['task', 'orphaned-task', true]
    ]);
    assert.match(device.elements.get('cloudSyncStatus').textContent, /Deletion records were saved/i);
    const checkpoint = JSON.parse(device.storage.getItem('ironMindCloudSyncState'));
    assert.equal(checkpoint.userId, 'test-user');
});

test('no-baseline Project datasets merge only after review and stay deduplicated', async () => {
    const database = emptyDatabase();
    const laptop = createSyncHarness({
        database,
        projectSubjects:[{ id:ids.laptopSubject, name:'Laptop Project', priority:'high' }],
        projectTopics:[
            { id:ids.laptopRoot, subjectId:ids.laptopSubject, parentId:null, name:'Root', order:0 },
            { id:ids.laptopChild, subjectId:ids.laptopSubject, parentId:ids.laptopRoot, name:'Nested', order:0 }
        ]
    });
    await laptop.click('cloudSyncNowButton');
    await laptop.click('cloudSyncConfirmButton');

    const phone = createSyncHarness({
        database,
        projectSubjects:[{ id:ids.phoneSubject, name:'Phone Project', priority:'medium' }],
        projectTopics:[
            { id:ids.phoneRoot, subjectId:ids.phoneSubject, parentId:null, name:'Phone root', order:0 },
            { id:ids.phoneChild, subjectId:ids.phoneSubject, parentId:ids.phoneRoot, name:'Phone nested', order:0 }
        ]
    });
    await phone.click('cloudSyncNowButton');
    assert.match(phone.elements.get('cloudSyncPreviewDetails').textContent, /1 cloud subjects and 2 cloud topics\/subtopics will be added/);
    assert.equal(database.project_subjects.length, 1, 'the preview alone must not upload local records');
    await phone.click('cloudSyncConfirmButton');

    assert.deepEqual([...phone.context.projectSubjectRecords].map(row => row.id).sort(), [ids.laptopSubject, ids.phoneSubject].sort());
    assert.equal(phone.context.projectTopicRecords.find(row => row.id === ids.laptopChild).parentId, ids.laptopRoot);
    assert.equal(phone.context.projectTopicRecords.find(row => row.id === ids.phoneChild).parentId, ids.phoneRoot);
    assert.equal(JSON.parse(phone.storage.getItem('ironMindProjectTopics')).length, 4, 'downloaded hierarchy is persisted in the active workspace');

    await laptop.click('cloudSyncNowButton');
    assert.equal(laptop.context.projectSubjectRecords.length, 2, 'the laptop downloads the subject created on the phone');
    assert.equal(laptop.context.projectTopicRecords.find(row => row.id === ids.phoneChild).parentId, ids.phoneRoot, 'the phone hierarchy remains intact when downloaded back');
    const counts = [database.project_subjects.length, database.project_topics.length];
    await phone.click('cloudSyncNowButton');
    assert.deepEqual([database.project_subjects.length, database.project_topics.length], counts, 'repeated sync creates no duplicate rows');
});

test('established-baseline deletion previews its ID and restores only after confirmation', async () => {
    const database = emptyDatabase();
    const subject = { id:ids.laptopSubject, name:'Laptop Project', priority:'high' };
    const topics = [
        { id:ids.laptopRoot, subjectId:ids.laptopSubject, parentId:null, name:'Root', order:0 },
        { id:ids.laptopChild, subjectId:ids.laptopSubject, parentId:ids.laptopRoot, name:'Nested', order:0 }
    ];
    const laptop = createSyncHarness({ database, projectSubjects:[subject], projectTopics:topics });
    await laptop.click('cloudSyncNowButton');
    await laptop.click('cloudSyncConfirmButton');
    const checkpointBefore = laptop.storage.getItem('ironMindCloudSyncState');

    laptop.setLocalProjectData([], []);
    await laptop.click('cloudSyncNowButton');
    assert.match(laptop.elements.get('cloudSyncPreviewDetails').textContent, new RegExp(`saved baseline includes Project subject ID ${ids.laptopSubject}.*missing from this local workspace`));
    assert.equal(laptop.context.projectSubjectRecords.length, 0, 'local deletion remains until confirmation');
    assert.equal(database.project_subjects.length, 1, 'cloud row is retained');
    assert.equal(laptop.storage.getItem('ironMindCloudSyncState'), checkpointBefore, 'preview leaves the checkpoint intact');

    await laptop.click('cloudSyncConfirmButton');
    assert.deepEqual([...laptop.context.projectSubjectRecords].map(row => row.id), [ids.laptopSubject]);
    assert.equal(laptop.context.projectTopicRecords.length, 2, 'subject and nested topic tree are restored together');
    assert.equal(database.project_subjects.length, 1, 'recovery neither deletes nor duplicates cloud data');
    assert.notEqual(laptop.storage.getItem('ironMindCloudSyncState'), checkpointBefore, 'checkpoint advances only after confirmation and verification');
});

test('recovery preview distinguishes a surviving record changed since baseline', async () => {
    const database = emptyDatabase();
    const subject = { id:ids.laptopSubject, name:'Original Project', priority:'high' };
    const laptop = createSyncHarness({ database, projectSubjects:[subject] });
    await laptop.click('cloudSyncNowButton');
    await laptop.click('cloudSyncConfirmButton');
    laptop.setLocalProjectData([], []);
    database.project_subjects[0].name = 'Cloud-edited Project';

    await laptop.click('cloudSyncNowButton');
    assert.match(laptop.elements.get('cloudSyncPreviewDetails').textContent, /surviving copy differs from the saved baseline/);
    assert.equal(laptop.context.projectSubjectRecords.length, 0, 'changed surviving copy is not adopted before confirmation');
    await laptop.click('cloudSyncConfirmButton');
    assert.equal(laptop.context.projectSubjectRecords[0].name, 'Cloud-edited Project', 'confirmation restores the current surviving copy');
});
test('established-baseline cloud deletion previews before restoring local rows', async () => {
    const database = emptyDatabase();
    const subject = { id:ids.phoneSubject, name:'Phone Project', priority:'high' };
    const topics = [{ id:ids.phoneRoot, subjectId:ids.phoneSubject, parentId:null, name:'Phone root', order:0 }];
    const phone = createSyncHarness({ database, projectSubjects:[subject], projectTopics:topics });
    await phone.click('cloudSyncNowButton');
    await phone.click('cloudSyncConfirmButton');
    const checkpointBefore = phone.storage.getItem('ironMindCloudSyncState');
    database.project_subjects = [];
    database.project_topics = [];

    await phone.click('cloudSyncNowButton');
    assert.match(phone.elements.get('cloudSyncPreviewDetails').textContent, /missing from the cloud/);
    assert.match(phone.elements.get('cloudSyncPreviewDetails').textContent, /1 Project subjects and 1 topics\/subtopics will be uploaded/);
    assert.equal(database.project_subjects.length, 0, 'local record is not uploaded before confirmation');
    assert.equal(phone.storage.getItem('ironMindCloudSyncState'), checkpointBefore, 'preview does not erase or replace the checkpoint');

    await phone.click('cloudSyncConfirmButton');
    assert.equal(database.project_subjects.length, 1, 'the surviving local subject is restored to cloud only after confirmation');
    assert.equal(database.project_topics.length, 1, 'the associated topic is restored after confirmation');
});
test('established-baseline records missing from both copies remain blocked', async () => {
    const database = emptyDatabase();
    const subject = { id:ids.laptopSubject, name:'Laptop Project', priority:'high' };
    const laptop = createSyncHarness({ database, projectSubjects:[subject] });
    await laptop.click('cloudSyncNowButton');
    await laptop.click('cloudSyncConfirmButton');
    const checkpointBefore = laptop.storage.getItem('ironMindCloudSyncState');

    laptop.setLocalProjectData([], []);
    database.project_subjects = [];
    await laptop.click('cloudSyncNowButton');
    assert.match(laptop.elements.get('cloudSyncStatus').textContent, /missing from both local and cloud data/);
    assert.equal(laptop.storage.getItem('ironMindCloudSyncState'), checkpointBefore, 'an unrecoverable deletion does not silently adopt a new baseline');
});

const taskSubjectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const projectTaskIds = ['41'];
const projectIds = {
    subject:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    root:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
    child:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02'
};

function initialTaskData(){
    return {
        subjects:[{ id:taskSubjectId, name:'Physics', priority:'high' }],
        tasks:[{ id:41, subject:'Physics', topic:'Mechanics', source:'Book A', task_date:'14-10-2026', status:'Planned', remarks:'first' }]
    };
}

async function uploadFirstSync(harness){
    await harness.click('cloudSyncNowButton');
    if(!harness.elements.get('cloudSyncPreview').classList.contains('hidden')) await harness.click('cloudSyncConfirmButton');
}

test('task IDs and subject IDs remain stable through two-way edits and subject rename', async () => {
    const database = emptyDatabase();
    const initial = initialTaskData();
    const laptop = createSyncHarness({ database, ...initial });
    await uploadFirstSync(laptop);
    assert.equal(database.task_subjects.length, 1);
    assert.equal(database.task_subjects[0].id, taskSubjectId, 'the cloud uses the stable local task-subject ID');
    assert.equal(database.tasks.length, 1);
    assert.equal(database.tasks[0].legacy_id, '41', 'the local task ID remains the cloud deduplication key');

    const phone = createSyncHarness({ database });
    await phone.click('cloudSyncNowButton');
    assert.equal(phone.context.tasks[0].id, 41, 'the local numeric task ID is restored on the second device');

    const renamedSubjects = phone.context.subjects.map(row => ({ ...row, name:'Physics II', priority:'medium' }));
    const updatedTasks = phone.context.tasks.map(row => ({ ...row, subject:'Physics II', task_date:'15-10-2026', status:'Halfway', remarks:'edited on phone' }));
    phone.setLocalTaskData(renamedSubjects, updatedTasks);
    await phone.click('cloudSyncNowButton');
    assert.equal(database.task_subjects.length, 1, 'a subject rename updates its UUID row instead of inserting a duplicate');
    assert.equal(database.task_subjects[0].id, taskSubjectId);
    assert.equal(database.task_subjects[0].name, 'Physics II');
    assert.equal(database.tasks.length, 1, 'repeated sync retains one cloud task');
    assert.equal(database.tasks[0].subject_id, taskSubjectId, 'the task retains its subject association');
    assert.equal(database.tasks[0].status, 'Halfway');
    assert.equal(database.tasks[0].task_date, '2026-10-15');
    assert.equal(database.tasks[0].remarks, 'edited on phone');

    await laptop.click('cloudSyncNowButton');
    assert.equal(laptop.context.subjects[0].id, taskSubjectId);
    assert.equal(laptop.context.subjects[0].name, 'Physics II');
    assert.equal(laptop.context.tasks[0].status, 'Halfway');
    assert.equal(laptop.context.tasks[0].remarks, 'edited on phone');
    const counts = [database.task_subjects.length, database.tasks.length];
    await laptop.click('cloudSyncNowButton');
    assert.deepEqual([database.task_subjects.length, database.tasks.length], counts, 'retrying sync is idempotent');
});

test('Recycle Bin deletion tombstones remove tasks and nested Project records across logout/login', async () => {
    const database = emptyDatabase();
    const taskData = initialTaskData();
    const laptop = createSyncHarness({
        database,
        ...taskData,
        projectSubjects:[{ id:projectIds.subject, name:'Project A', priority:'high' }],
        projectTopics:[
            { id:projectIds.root, subjectId:projectIds.subject, parentId:null, name:'Root', order:0 },
            { id:projectIds.child, subjectId:projectIds.subject, parentId:projectIds.root, name:'Nested', order:0 }
        ]
    });
    await uploadFirstSync(laptop);
    const phone = createSyncHarness({ database });
    await phone.click('cloudSyncNowButton');
    assert.equal(phone.context.projectTopicRecords.length, 2);
    assert.equal(phone.context.projectTopicRecords.find(row => row.id === projectIds.child).parentId, projectIds.root);

    laptop.setLocalTaskData([], []);
    laptop.setLocalProjectData([], []);
    laptop.storage.setItem('ironMindRecycleBin', '[]'); // the user permanently purged the local Recycle Bin entry
    laptop.storage.setItem('ironMindCloudTombstones', JSON.stringify({
        [`task:41`]:true,
        [`task_subject:${taskSubjectId}`]:true,
        [`project_subject:${projectIds.subject}`]:true,
        [`project_topic:${projectIds.root}`]:true,
        [`project_topic:${projectIds.child}`]:true
    }));
    await laptop.click('cloudSyncNowButton');
    assert.equal(database.tasks.length, 0);
    assert.equal(database.task_subjects.length, 0);
    assert.equal(database.project_topics.length, 0);
    assert.equal(database.project_subjects.length, 0);
    assert.equal(database.sync_tombstones.filter(row => row.is_deleted).length, 5, 'durable deletion evidence remains in the cloud');

    // A reload after sign-out/sign-in reuses the same account workspace and checkpoint.
    const reloadedPhone = createSyncHarness({ database, storageData:phone.storage.entries() });
    await reloadedPhone.click('cloudSyncNowButton');
    assert.equal(reloadedPhone.context.tasks.length, 0, 'old task data is removed instead of uploaded or restored');
    assert.equal(reloadedPhone.context.projectSubjectRecords.length, 0);
    assert.equal(reloadedPhone.context.projectTopicRecords.length, 0);
    assert.match(reloadedPhone.elements.get('cloudSyncStatus').textContent, /Synced/);
});

test('Recycle Bin tombstone survives permanent purge and is cleared only by restore', () => {
    const start = appSource.indexOf('function normalizeTaskSubjectTombstoneName(');
    const end = appSource.indexOf('\nfunction getRecycleRetentionDays(', start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const stored = new Map([['ironMindTasks', JSON.stringify([{ id:42, subject:'Physics', topic:'Task' }])]]);
    const context = {
        workspaceStorage:{
            getItem:key => stored.has(key) ? stored.get(key) : null,
            setItem:(key,value) => stored.set(key,String(value)),
            removeItem:key => stored.delete(key)
        },
        RECYCLE_BIN_KEY:'ironMindRecycleBin',
        CLOUD_TOMBSTONES_KEY:'ironMindCloudTombstones',
        recycleBinEntries:[],
        recycleBinStorageReady:true,
        updateRecycleBinCount(){},
        showToast(){},
        Map, Set, JSON, String, Boolean, Error
    };
    vm.createContext(context);
    vm.runInContext(appSource.slice(start,end),context);
    const task = { id:42, subject:'Physics', topic:'Task' };
    const entry = { id:'trash-1', type:'task', name:'Task', payload:{ task } };
    context.entry = entry;
    assert.equal(vm.runInContext("persistRecycleBinAndStorage([entry], [['ironMindTasks', []]])", context), true);
    const markers = JSON.parse(stored.get('ironMindCloudTombstones'));
    assert.equal(markers['task:42'], true, 'moving the task to Recycle Bin persists deletion intent');

    // The permanent-purge path removes the Recycle Bin snapshot without removing its durable sync marker.
    context.recycleBinEntries = [entry];
    vm.runInContext("persistRecycleBinAndStorage([])", context);
    assert.equal(JSON.parse(stored.get('ironMindCloudTombstones'))['task:42'], true);

    // An explicit restore reactivates the stable task ID for the sync protocol.
    context.recycleBinEntries = [entry];
    vm.runInContext("persistRecycleBinAndStorage([], [['ironMindTasks', [entry.payload.task]]])", context);
    assert.equal(JSON.parse(stored.get('ironMindCloudTombstones'))['task:42'], false);
});

test('a deletion marker cannot erase a concurrent cloud edit', async () => {
    const database = emptyDatabase();
    const initial = initialTaskData();
    const laptop = createSyncHarness({ database, ...initial });
    await uploadFirstSync(laptop);
    laptop.setLocalTaskData([], []);
    laptop.storage.setItem('ironMindCloudTombstones', JSON.stringify({ 'task:41':true }));
    database.tasks[0].remarks = 'newer cloud edit';
    database.tasks[0].revision += 1;

    await laptop.click('cloudSyncNowButton');
    assert.match(laptop.elements.get('cloudSyncStatus').textContent, /deletion of task 41 conflicts with a newer cloud edit/i);
    assert.equal(database.tasks.length, 1, 'the newer cloud row remains intact');
    assert.equal(database.tasks[0].remarks, 'newer cloud edit');
    assert.equal(laptop.context.tasks.length, 0, 'the pending local deletion does not silently replace either copy');
});

test('confirmed Delete All Data clears only this account and leaves a reset checkpoint', async () => {
    const database = emptyDatabase();
    const taskData = initialTaskData();
    const laptop = createSyncHarness({ database, ...taskData });
    await uploadFirstSync(laptop);
    database.task_subjects.push({ id:'ffffffff-ffff-4fff-8fff-ffffffffffff', user_id:'other-user', name:'Other account', revision:1 });
    database.tasks.push({ id:'other-task', user_id:'other-user', subject_id:'ffffffff-ffff-4fff-8fff-ffffffffffff', legacy_id:'other-task', status:'Planned', task_date:null, topic:'', source:'', remarks:'', revision:1 });
    const generation = await laptop.context.window.IRON_MIND_CLOUD_SYNC.deleteAllData();
    assert.equal(generation, 1);
    assert.equal(database.tasks.filter(row => row.user_id === 'test-user').length, 0);
    assert.equal(database.task_subjects.filter(row => row.user_id === 'test-user').length, 0);
    assert.equal(database.tasks.filter(row => row.user_id === 'other-user').length, 1, 'other users’ data is retained');
    assert.equal(database.task_subjects.filter(row => row.user_id === 'other-user').length, 1);

    laptop.storage.clear();
    laptop.context.window.IRON_MIND_CLOUD_SYNC.finishLocalDataReset(generation);
    const checkpoint = JSON.parse(laptop.storage.getItem('ironMindCloudSyncState'));
    assert.equal(checkpoint.resetGeneration, 1);
    assert.equal(checkpoint.userId, 'test-user');
    assert.equal(laptop.storage.entries().length, 1, 'only the authenticated account checkpoint is restored after local app-data clearing');
});

test('Delete All Data UI waits for the account wipe, deletes active IndexedDB, and clears only the active workspace', async () => {
    const confirm = new TestElement();
    const cancel = new TestElement();
    const accountItems = new Map([['ironMindTasks','account task'],['ironMindProjectNotes','account note']]);
    const deviceItems = new Map([['ironMindTasks','device task']]);
    const calls = [];
    let confirmHandler = null;
    confirm.addEventListener = (event, callback) => { if(event === 'click') confirmHandler = callback; };
    confirm.removeEventListener = (event, callback) => { if(event === 'click' && confirmHandler === callback) confirmHandler = null; };
    cancel.addEventListener = () => {};
    cancel.removeEventListener = () => {};
    const title = { textContent:'' };
    const message = { textContent:'' };
    const context = {
        window:{
            IRON_MIND_WORKSPACE:{ isDeviceWorkspace:false, userId:'test-user', authenticatedUserId:'test-user', session:{ user:{ email:'sync-test@example.invalid' } } },
            IRON_MIND_CLOUD_SYNC:{
                deleteAllData:async () => { calls.push('cloud'); return 4; },
                finishLocalDataReset:generation => calls.push(`checkpoint:${generation}`)
            },
            indexedDB:{},
        },
        deleteConfirmTitle:title,
        deleteConfirmMessage:message,
        deleteConfirmModal:{ classList:{ remove(){} } },
        confirmDeleteBtn:confirm,
        cancelDeleteBtn:cancel,
        closeDeleteConfirmModal(){},
        projectResourcesDbPromise:null,
        deleteResourceDatabaseSafely:async () => { calls.push('indexeddb'); },
        workspaceStorage:{ clear:() => { calls.push('local'); accountItems.clear(); } },
        location:{ reload:() => calls.push('reload') },
        setTimeout:callback => { callback(); },
        showToast:message => calls.push(`toast:${message}`)
    };
    vm.createContext(context);
    vm.runInContext(`${extractFunction(appSource, 'deleteAllData', 'showToast')}\ndeleteAllData();`, context);
    const firstConfirm = confirmHandler;
    assert.equal(typeof firstConfirm, 'function');
    firstConfirm();
    assert.match(message.textContent, /Final confirmation.*old offline copies/i);
    const finalConfirm = confirmHandler;
    assert.equal(typeof finalConfirm, 'function');
    await finalConfirm();
    assert.deepEqual(calls.slice(0, 4), ['cloud','indexeddb','local','checkpoint:4']);
    assert.equal(accountItems.size, 0, 'all IRON MIND keys in the active account workspace are cleared');
    assert.equal(deviceItems.get('ironMindTasks'), 'device task', 'the separate device workspace is untouched');
    assert.equal(calls.at(-1), 'reload');
});

test('stale account workspace is blocked after reset until explicitly cleared', async () => {
    const database = emptyDatabase();
    const initial = initialTaskData();
    const laptop = createSyncHarness({ database, ...initial });
    await uploadFirstSync(laptop);
    const staleStorage = laptop.storage.entries();
    const generation = await laptop.context.window.IRON_MIND_CLOUD_SYNC.deleteAllData();
    const resetter = createSyncHarness({ database, storageData:staleStorage });
    await resetter.click('cloudSyncNowButton');
    assert.match(resetter.elements.get('cloudSyncStatus').textContent, /cleared on another device/i);
    assert.equal(resetter.context.tasks.length, 1, 'the stale local copy is preserved until the user explicitly clears it');
    assert.equal(database.tasks.length, 0);

    const retryGeneration = await resetter.context.window.IRON_MIND_CLOUD_SYNC.deleteAllData();
    assert.equal(retryGeneration, generation, 'clearing a stale local copy does not advance an already-empty cloud reset');
    resetter.storage.clear();
    resetter.context.window.IRON_MIND_CLOUD_SYNC.finishLocalDataReset(retryGeneration);
    const cleanReload = createSyncHarness({ database, storageData:resetter.storage.entries() });
    await cleanReload.click('cloudSyncNowButton');
    assert.equal(database.tasks.length, 0, 'sync after explicit cleanup does not resurrect old data');
    assert.equal(cleanReload.context.tasks.length, 0);
});

test('a clean account workspace writes records with the confirmed reset generation', async () => {
    const database = emptyDatabase();
    const firstDevice = createSyncHarness({ database });
    const generation = await firstDevice.context.window.IRON_MIND_CLOUD_SYNC.deleteAllData();
    firstDevice.storage.clear();
    firstDevice.context.window.IRON_MIND_CLOUD_SYNC.finishLocalDataReset(generation);

    const freshDevice = createSyncHarness({ database, storageData:firstDevice.storage.entries() });
    freshDevice.setLocalTaskData(
        [{ id:taskSubjectId, name:'Fresh', priority:'high' }],
        [{ id:99, subject:'Fresh', topic:'Clean test', source:'', task_date:'14-10-2026', status:'Planned', remarks:'' }]
    );
    await freshDevice.click('cloudSyncNowButton');
    assert.equal(freshDevice.elements.get('cloudSyncPreview').classList.contains('hidden'), false, 'post-reset data requires a fresh upload confirmation');
    assert.equal(database.task_subjects.length, 0, 'the preview does not upload records');
    await freshDevice.click('cloudSyncConfirmButton');

    assert.match(freshDevice.elements.get('cloudSyncStatus').textContent, /Synced/, `${freshDevice.elements.get('cloudSyncStatus').textContent} ${JSON.stringify(database)}`);
    assert.equal(database.task_subjects.length, 1);
    assert.equal(database.task_subjects[0].sync_generation, generation, 'task subjects use the server-confirmed generation');
    assert.equal(database.tasks.length, 1);
    assert.equal(database.tasks[0].sync_generation, generation, 'tasks use the server-confirmed generation');
    assert.equal(database.tasks[0].subject_id, taskSubjectId);
});

test('independent task edits remain a conflict instead of last-write-wins', async () => {
    const database = emptyDatabase();
    const initial = initialTaskData();
    const laptop = createSyncHarness({ database, ...initial });
    await uploadFirstSync(laptop);
    const phone = createSyncHarness({ database });
    await phone.click('cloudSyncNowButton');

    laptop.setLocalTaskData(laptop.context.subjects.map(row => ({ ...row })), laptop.context.tasks.map(row => ({ ...row, status:'Completed' })));
    phone.setLocalTaskData(phone.context.subjects.map(row => ({ ...row })), phone.context.tasks.map(row => ({ ...row, remarks:'independent phone edit' })));
    await laptop.click('cloudSyncNowButton');
    await phone.click('cloudSyncNowButton');
    const conflictStatus = phone.elements.get('cloudSyncStatus').textContent;
    assert.match(conflictStatus, /task changed differently/i);
    assert.match(conflictStatus, /record 41/);
    assert.match(conflictStatus, /fields: remarks, status/);
    assert.doesNotMatch(conflictStatus, /independent phone edit/);
    assert.doesNotMatch(conflictStatus, /Completed/);
    assert.doesNotMatch(conflictStatus, /Mechanics/);
    assert.doesNotMatch(conflictStatus, /Book A/);
    assert.equal(conflictStatus.includes('first'), false, 'remark contents must not appear in the diagnostic');
    assert.match(laptop.elements.get('cloudSyncStatus').textContent, /Synced at/i);
    assert.equal(database.tasks[0].status, 'Completed');
    assert.equal(database.tasks[0].remarks, 'first', 'conflicting phone edit was not silently written');
    assert.equal(phone.context.tasks[0].remarks, 'independent phone edit', 'the local conflicting copy is retained');
    assert.equal(phone.context.tasks[0].status, 'Planned', 'the phone copy is not overwritten by the cloud edit');
});



