const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'workspace-bootstrap.js'), 'utf8');
const userId = '11111111-1111-4111-8111-111111111111';
const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

class Storage {
    constructor(){ this.values = new Map(); }
    get length(){ return this.values.size; }
    key(index){ return [...this.values.keys()][index] || null; }
    getItem(key){ return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value){ this.values.set(String(key), String(value)); }
    removeItem(key){ this.values.delete(String(key)); }
}

function element(){
    const classes = new Set();
    const children = new Map();
    return {
        classList:{ toggle:(name, force) => force ? classes.add(name) : classes.delete(name), add:name => classes.add(name), remove:name => classes.delete(name) },
        style:{}, textContent:'', onload:null, onerror:null, onclick:null,
        setAttribute(){},
        querySelector(selector){
            if(!children.has(selector)) children.set(selector, element());
            return children.get(selector);
        }
    };
}

async function boot({ session = null, getUser }){
    const listeners = new Map();
    const elements = new Map();
    const localStorage = new Storage();
    const sessionStorage = new Storage();
    let authListener = null;
    let reloads = 0;
    const client = {
        auth:{
            initialize:async () => ({ error:null }),
            getSession:async () => ({ data:{ session }, error:null }),
            getUser:async () => getUser(),
            onAuthStateChange:callback => { authListener = callback; }
        }
    };
    const document = {
        body:{ appendChild:child => { if(child.id) elements.set(child.id, child); if(child.onload) child.onload(); } },
        head:{ appendChild(){} },
        documentElement:{ inert:false },
        createElement:() => element(),
        getElementById:id => elements.get(id) || null
    };
    const window = {
        localStorage, sessionStorage, document,
        location:{ origin:'http://127.0.0.1:8000', href:'http://127.0.0.1:8000/', reload:() => { reloads += 1; } },
        IRON_MIND_SUPABASE_CONFIG:{ url:'https://example.supabase.co', publishableKey:'sb_publishable_test' },
        addEventListener:(name, callback) => listeners.set(name, callback),
        dispatchEvent:event => listeners.get(event.type)?.(event),
        __loadSupabase:async () => ({ createClient:() => client })
    };
    class CustomEvent { constructor(type, init = {}){ this.type = type; this.detail = init.detail; } }
    const transformed = source
        .replace('import(CLIENT_URL)', 'window.__loadSupabase(CLIENT_URL)')
        .replace('initialize().catch(error => showStatus(error?.message || "The local workspace could not be opened.", true, true));', 'window.__bootstrap = { initialize };');
    vm.runInNewContext(transformed, { window, document, CustomEvent, URL, setTimeout, clearTimeout, Promise, Error, Map, Set, Blob }, { filename:'workspace-bootstrap.js' });
    await window.__bootstrap.initialize();
    return { window, client, get authListener(){ return authListener; }, get reloads(){ return reloads; } };
}

test('a verified saved session opens only its matching account workspace', async () => {
    const session = { user:{ id:userId, email:'person@example.test' } };
    const harness = await boot({ session, getUser:async () => ({ data:{ user:session.user }, error:null }) });
    assert.equal(harness.window.IRON_MIND_WORKSPACE.userId, userId);
    assert.equal(harness.window.IRON_MIND_WORKSPACE.authVerificationState, 'verified');
    assert.equal(harness.window.IRON_MIND_WORKSPACE.authenticatedUserId, userId);
});

test('a temporary verification failure keeps account data locked and exposes a retry path', async () => {
    const session = { user:{ id:userId } };
    let available = false;
    const harness = await boot({ session, getUser:async () => available
        ? ({ data:{ user:session.user }, error:null })
        : ({ data:{ user:null }, error:{ message:'temporary network failure' } }) });
    assert.equal(harness.window.IRON_MIND_WORKSPACE.userId, null);
    assert.equal(harness.window.IRON_MIND_WORKSPACE.authVerificationState, 'unavailable');
    assert.equal(typeof harness.window.IRON_MIND_WORKSPACE.retryAuthentication, 'function');
    available = true;
    assert.equal(await harness.window.IRON_MIND_WORKSPACE.retryAuthentication(), 'verified');
    assert.equal(harness.window.IRON_MIND_WORKSPACE.authVerificationState, 'verified');
    await nextTick();
    assert.equal(harness.reloads, 1);
});

test('a rejected saved session remains signed out and does not unlock an account workspace', async () => {
    const session = { user:{ id:userId } };
    const harness = await boot({ session, getUser:async () => ({ data:{ user:null }, error:{ status:401, message:'expired' } }) });
    assert.equal(harness.window.IRON_MIND_WORKSPACE.userId, null);
    assert.equal(harness.window.IRON_MIND_WORKSPACE.authVerificationState, 'signed-out');
    assert.equal(harness.window.IRON_MIND_WORKSPACE.authenticatedUserId, null);
});

test('a later valid Auth event is handled after a temporary startup failure', async () => {
    const session = { user:{ id:userId } };
    const harness = await boot({ session, getUser:async () => ({ data:{ user:null }, error:{ message:'temporary service error' } }) });
    assert.equal(harness.window.IRON_MIND_WORKSPACE.authVerificationState, 'unavailable');
    harness.authListener('SIGNED_IN', session);
    assert.equal(harness.window.IRON_MIND_WORKSPACE.authVerificationState, 'verified');
    assert.equal(harness.window.IRON_MIND_WORKSPACE.authenticatedUserId, userId);
    await nextTick();
    assert.equal(harness.reloads, 1);
});
