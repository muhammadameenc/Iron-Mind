"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const BUILD_MANIFEST = path.join(ROOT, ".iron-mind-dist-manifest.json");
const STAGE = path.join(ROOT, `.iron-mind-dist-stage-${process.pid}`);
const EXPECTED_SITE_ORIGIN = "https://muhammadameenc.github.io/Iron-Mind/";
const EXPECTED_SUPABASE_HOST = "uwaemurthbgyietvuaes.supabase.co";
const outputFiles = new Map();

function fail(message){
    throw new Error(message);
}

function safeRelativePath(value){
    const normalized = path.posix.normalize(String(value).replaceAll("\\", "/"));
    if(!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)){
        fail("A build asset path escapes the production output directory.");
    }
    return normalized;
}

function sourcePath(relative){
    const normalized = safeRelativePath(relative);
    const resolved = path.resolve(ROOT, ...normalized.split("/"));
    if(path.dirname(resolved) !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)){
        fail("A source asset resolves outside the project directory.");
    }
    return resolved;
}

function addOutput(relative, content){
    const normalized = safeRelativePath(relative);
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    if(outputFiles.has(normalized)){
        if(outputFiles.get(normalized).equals(bytes)) return;
        fail(`Conflicting build output: ${normalized}`);
    }
    outputFiles.set(normalized, bytes);
}

function copySource(relative, destination = relative){
    const input = sourcePath(relative);
    if(!fs.statSync(input).isFile()) fail(`Required runtime asset is not a file: ${relative}`);
    addOutput(destination, fs.readFileSync(input));
}

function replaceExactlyOnce(text, expression, replacement, label){
    const matches = [...text.matchAll(expression)];
    if(matches.length !== 1) fail(`Expected one ${label} in the source, found ${matches.length}.`);
    return text.replace(expression, replacement);
}

function verifyProductionConfiguration(){
    const configSource = fs.readFileSync(sourcePath("supabase-config.production.js"), "utf8");
    const sandbox = { window:{} };
    new vm.Script(configSource, { filename:"supabase-config.production.js" }).runInNewContext(sandbox, { timeout:1000 });
    const config = sandbox.window.IRON_MIND_SUPABASE_CONFIG;
    if(!config || Object.keys(config).sort().join(",") !== "publishableKey,siteOrigin,url"){
        fail("Production Supabase configuration must contain only siteOrigin, url, and publishableKey.");
    }
    let site, endpoint;
    try{
        site = new URL(config.siteOrigin);
        endpoint = new URL(config.url);
    }catch(error){
        fail("Production Supabase configuration contains an invalid URL.");
    }
    const normalizedSite = `${site.origin}${site.pathname.replace(/\/+$/, "")}/`;
    if(normalizedSite !== EXPECTED_SITE_ORIGIN || site.search || site.hash || site.username || site.password){
        fail("Production Supabase site origin does not match the GitHub Pages project path.");
    }
    if(endpoint.protocol !== "https:" || endpoint.hostname !== EXPECTED_SUPABASE_HOST ||
        endpoint.pathname !== "/" || endpoint.search || endpoint.hash || endpoint.username || endpoint.password){
        fail("Production Supabase URL must be the hosted project base URL.");
    }
    if(typeof config.publishableKey !== "string" || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey)){
        fail("Production browser configuration must use a Supabase publishable key.");
    }
    return fs.readFileSync(sourcePath("supabase-config.production.js"));
}

function buildHtml(){
    let html = fs.readFileSync(sourcePath("index.html"), "utf8");
    html = replaceExactlyOnce(
        html,
        /^[\t ]*<script src=["']\.\/supabase-config\.js["']><\/script>[\t ]*\r?\n?/gm,
        "",
        "local Supabase config script tag"
    );
    html = replaceExactlyOnce(
        html,
        /href=["']\.\/iron-mind-icon\.png["']/g,
        'href="./icons/icon-192.png"',
        "favicon path"
    );
    html = replaceExactlyOnce(
        html,
        /window\.MathfieldElement\.fontsDirectory\s*=\s*["']\.\/fonts["'];/g,
        'window.MathfieldElement.fontsDirectory = "./vendor/mathlive/fonts";',
        "MathLive font directory"
    );
    return html;
}

function buildWorkspaceBootstrap(){
    let source = fs.readFileSync(sourcePath("workspace-bootstrap.js"), "utf8");
    source = replaceExactlyOnce(
        source,
        /const LOCAL_APP_ORIGIN = "http:\/\/127\.0\.0\.1:8000";/g,
        'const LOCAL_APP_ORIGIN = "";',
        "local development origin"
    );
    return source;
}

function buildAuthScript(){
    let source = fs.readFileSync(sourcePath("supabase-auth.js"), "utf8");
    source = replaceExactlyOnce(
        source,
        /Add the Supabase Project URL and publishable key to supabase-config\.js first\./g,
        "Configure the hosted Supabase URL and publishable key for this app origin.",
        "local config setup message"
    );
    return source;
}

function buildServiceWorker(nonWorkerFiles){
    let source = fs.readFileSync(sourcePath("service-worker.js"), "utf8");
    source = replaceExactlyOnce(
        source,
        /^[\t ]*["']\.\/supabase-config\.js["'],[\t ]*\r?\n/gm,
        "",
        "local config precache entry"
    );
    const digest = crypto.createHash("sha256");
    for(const [name, content] of [...nonWorkerFiles].sort(([left], [right]) => left.localeCompare(right))){
        digest.update(name);
        digest.update("\0");
        digest.update(content);
        digest.update("\0");
    }
    const cacheId = digest.digest("hex").slice(0, 12);
    source = replaceExactlyOnce(
        source,
        /const CACHE_NAME = "[^"]+";/g,
        `const CACHE_NAME = "iron-mind-prod-${cacheId}";`,
        "service worker cache name"
    );
    return source;
}

function copyManifestIcons(){
    const manifest = JSON.parse(fs.readFileSync(sourcePath("manifest.json"), "utf8"));
    if(manifest.start_url !== "./" || manifest.scope !== "./" || !Array.isArray(manifest.icons) || manifest.icons.length < 1){
        fail("The web manifest must keep relative start_url and scope values for GitHub Pages.");
    }
    for(const icon of manifest.icons){
        if(typeof icon.src !== "string") fail("A web manifest icon path is invalid.");
        copySource(icon.src);
    }
    if(!manifest.icons.some(icon => icon.src === "icons/icon-192.png")){
        fail("The production favicon target must be included in the web manifest.");
    }
    copySource("manifest.json");
}

function copyMathLiveAssets(){
    const cssPaths = ["vendor/mathlive/mathlive-fonts.css", "vendor/mathlive/mathlive-static.css"];
    copySource("vendor/mathlive/mathlive.min.js");
    copySource("vendor/mathlive/LICENSE.txt");
    for(const cssPath of cssPaths){
        const css = fs.readFileSync(sourcePath(cssPath), "utf8");
        copySource(cssPath);
        for(const match of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g)){
            const url = match[2].trim();
            if(!url || /^(?:data:|https?:|\/\/)/i.test(url)) continue;
            const urlPath = decodeURIComponent(url.split(/[?#]/, 1)[0]);
            const asset = path.posix.normalize(path.posix.join(path.posix.dirname(cssPath), urlPath));
            copySource(asset);
        }
    }
}

function resolveOutputReference(reference, basePath = ""){
    if(!reference || reference.startsWith("#") || /^(?:data:|mailto:|tel:|javascript:|https?:|\/\/)/i.test(reference)) return null;
    const base = `https://iron-mind-build.invalid/Iron-Mind/${basePath}`;
    const resolved = new URL(reference, base);
    if(resolved.origin !== "https://iron-mind-build.invalid") return null;
    const prefix = "/Iron-Mind/";
    if(resolved.pathname === prefix || resolved.pathname === prefix.slice(0, -1)) return "index.html";
    if(!resolved.pathname.startsWith(prefix)) fail("A runtime reference escapes the GitHub Pages project path.");
    return safeRelativePath(decodeURIComponent(resolved.pathname.slice(prefix.length)));
}

function assertOutputFile(relative, label){
    const normalized = safeRelativePath(relative);
    if(!outputFiles.has(normalized)) fail(`${label} points to an asset missing from dist: ${normalized}`);
}

function validateOutput(){
    const forbidden = [
        /127\.0\.0\.1/i,
        /localhost/i,
        /supabase\/config\.toml/i,
        /supabase-config\.js/i
    ];
    const textExtensions = new Set([".html", ".js", ".css", ".json", ".txt"]);
    for(const [relative, content] of outputFiles){
        if(forbidden.some(pattern => pattern.test(relative))) fail("A development-only path is present in the production output.");
        if(textExtensions.has(path.posix.extname(relative))){
            const text = content.toString("utf8");
            if(forbidden.some(pattern => pattern.test(text))) fail(`A development-only reference remains in ${relative}.`);
        }
    }
    if(outputFiles.has("supabase-config.js") || [...outputFiles.keys()].some(name => name.startsWith("supabase/"))){
        fail("Local Supabase configuration or project files were included in dist.");
    }

    const html = outputFiles.get("index.html").toString("utf8");
    for(const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)){
        const target = resolveOutputReference(match[1]);
        if(target) assertOutputFile(target, "HTML");
    }

    for(const cssPath of [...outputFiles.keys()].filter(name => name.endsWith(".css"))){
        const css = outputFiles.get(cssPath).toString("utf8");
        for(const match of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g)){
            const target = resolveOutputReference(match[2].trim(), cssPath);
            if(target) assertOutputFile(target, `CSS ${cssPath}`);
        }
    }

    const manifest = JSON.parse(outputFiles.get("manifest.json").toString("utf8"));
    for(const icon of manifest.icons){
        const target = resolveOutputReference(icon.src);
        if(target) assertOutputFile(target, "Web manifest");
    }

    const worker = outputFiles.get("service-worker.js").toString("utf8");
    const cacheList = worker.match(/const urlsToCache\s*=\s*\[([\s\S]*?)\];/);
    if(!cacheList) fail("The production service worker has no readable precache list.");
    for(const match of cacheList[1].matchAll(/["']([^"']+)["']/g)){
        const target = resolveOutputReference(match[1]);
        if(target) assertOutputFile(target, "Service worker precache");
    }

    for(const required of ["script.js", "supabase-auth.js", "supabase-sync.js", "workspace-bootstrap.js", "supabase-config.production.js"]){
        assertOutputFile(required, "Bootstrap runtime");
    }
}

function listFiles(directory, prefix = ""){
    const result = [];
    for(const entry of fs.readdirSync(directory, { withFileTypes:true })){
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if(entry.isSymbolicLink()) fail("Refusing to replace a dist directory containing symbolic links.");
        if(entry.isDirectory()) result.push(...listFiles(path.join(directory, entry.name), relative));
        else if(entry.isFile()) result.push(relative);
        else fail("Refusing to replace a dist directory containing special files.");
    }
    return result.sort();
}

function sha256(content){
    return crypto.createHash("sha256").update(content).digest("hex");
}

function verifyPreviousBuild(){
    if(!fs.existsSync(DIST)) return;
    const distStat = fs.lstatSync(DIST);
    if(!distStat.isDirectory() || distStat.isSymbolicLink() || path.resolve(DIST) !== path.join(ROOT, "dist")){
        fail("Refusing to replace a dist path that is not the project’s generated output directory.");
    }
    if(!fs.existsSync(BUILD_MANIFEST)){
        fail("dist already exists without this build’s ownership manifest; move it aside to preserve its contents.");
    }
    let previous;
    try{ previous = JSON.parse(fs.readFileSync(BUILD_MANIFEST, "utf8")); }
    catch(error){ fail("dist ownership manifest is unreadable; existing files were preserved."); }
    const currentFiles = listFiles(DIST);
    const manifestFiles = previous?.files;
    if(previous?.format !== 1 || !Array.isArray(manifestFiles) ||
        currentFiles.length !== manifestFiles.length ||
        currentFiles.some((name, index) => name !== manifestFiles[index]?.path)){
        fail("dist contents differ from the previous generated build; existing files were preserved.");
    }
    for(const entry of manifestFiles){
        const content = fs.readFileSync(path.join(DIST, ...entry.path.split("/")));
        if(sha256(content) !== entry.sha256) fail("A dist file was edited after build; existing files were preserved.");
    }
}

function build(){
    if(fs.existsSync(STAGE)) fail("A previous staging directory exists; inspect it before rebuilding.");

    const productionConfig = verifyProductionConfiguration();
    outputFiles.clear();
    addOutput("index.html", buildHtml());
    for(const relative of ["style.css", "script.js", "supabase-sync.js"]){
        copySource(relative);
    }
    addOutput("supabase-auth.js", buildAuthScript());
    addOutput("workspace-bootstrap.js", buildWorkspaceBootstrap());
    addOutput("supabase-config.production.js", productionConfig);
    copyManifestIcons();
    copyMathLiveAssets();
    const withoutWorker = new Map(outputFiles);
    addOutput("service-worker.js", buildServiceWorker(withoutWorker));
    validateOutput();

    const stageResolved = path.resolve(STAGE);
    if(path.dirname(stageResolved) !== ROOT || path.basename(stageResolved) !== path.basename(STAGE)){
        fail("The production staging directory is outside the project root.");
    }
    fs.mkdirSync(STAGE, { recursive:false });
    try{
        for(const [relative, content] of outputFiles){
            const destination = path.join(STAGE, ...relative.split("/"));
            fs.mkdirSync(path.dirname(destination), { recursive:true });
            fs.writeFileSync(destination, content);
        }
        validateStagedOutput();
        verifyPreviousBuild();
        if(fs.existsSync(DIST)) fs.rmSync(DIST, { recursive:true, force:false });
        fs.renameSync(STAGE, DIST);
        const files = listFiles(DIST).map(relative => ({
            path:relative,
            sha256:sha256(fs.readFileSync(path.join(DIST, ...relative.split("/"))))
        }));
        const manifestPath = `${BUILD_MANIFEST}.tmp-${process.pid}`;
        fs.writeFileSync(manifestPath, `${JSON.stringify({ format:1, files }, null, 2)}\n`, { flag:"wx" });
        fs.renameSync(manifestPath, BUILD_MANIFEST);
        return files.map(entry => entry.path);
    }catch(error){
        if(fs.existsSync(STAGE)) fs.rmSync(STAGE, { recursive:true, force:true });
        throw error;
    }
}

function validateStagedOutput(){
    for(const [relative, expected] of outputFiles){
        const actual = fs.readFileSync(path.join(STAGE, ...relative.split("/")));
        if(!actual.equals(expected)) fail(`Staged runtime asset did not match its source: ${relative}`);
    }
    const staged = listFiles(STAGE);
    if(staged.length !== outputFiles.size || staged.some(relative => !outputFiles.has(relative))){
        fail("The staged production output contains unexpected files.");
    }
}

try{
    const files = build();
    process.stdout.write(`Production build verified: ${files.length} files in dist/\n`);
    for(const file of files) process.stdout.write(`  ${file}\n`);
}catch(error){
    process.stderr.write(`Production build failed: ${error.message}\n`);
    process.exitCode = 1;
}
