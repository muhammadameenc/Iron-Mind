const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { TextEncoder } = require('node:util');
const crypto = require('node:crypto').webcrypto;

const syncSource = fs.readFileSync(path.join(__dirname, '..', 'supabase-sync.js'), 'utf8');

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
    single(){ return this.execute(true); }
    maybeSingle(){ return this.execute(true); }
    then(resolve, reject){ return this.execute(false).then(resolve, reject); }
    async execute(single){
        const rows = this.database[this.table] || (this.database[this.table] = []);
        if(this.mode === 'insert'){
            const inputs = Array.isArray(this.payload) ? this.payload : [this.payload];
            const inserted = inputs.map(input => {
                if(input.id && rows.some(row => row.id === input.id)) return null;
                const row = { ...input, revision:1 };
                if(this.table === 'project_subjects') row.created_at = new Date(Date.now() + rows.length * 1000).toISOString();
                if(this.table === 'tasks' && !row.id) row.id = rows.length + 1;
                if(this.table === 'task_subjects' && !row.id) row.id = `task-subject-${rows.length + 1}`;
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

function createSyncHarness({ database, projectSubjects = [], projectTopics = [], state = null }){
    const elements = new Map();
    const document = {
        getElementById(id){
            if(!elements.has(id)) elements.set(id, new TestElement());
            return elements.get(id);
        },
        createElement(){ return new TestElement(); }
    };
    const storageData = new Map([
        ['ironMindSubjects', '[]'],
        ['ironMindTasks', '[]'],
        ['ironMindProjectSubjects', JSON.stringify(projectSubjects)],
        ['ironMindProjectTopics', JSON.stringify(projectTopics)]
    ]);
    if(state !== null) storageData.set('ironMindCloudSyncState', JSON.stringify(state));
    const storage = {
        getItem:key => storageData.has(key) ? storageData.get(key) : null,
        setItem:(key, value) => storageData.set(key, String(value)),
        removeItem:key => storageData.delete(key)
    };
    const client = {
        auth:{ getUser:async () => ({ data:{ user:{ id:'test-user' } }, error:null }) },
        from:table => new MockQuery(database, table)
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
        subjects:[], tasks:[], projectSubjectRecords:projectSubjects, projectTopicRecords:projectTopics,
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
    return { click, context, elements, storage, setLocalProjectData };
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
    return { project_subjects:[], project_topics:[], task_subjects:[], tasks:[], user_settings:[] };
}

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



