/* Local account UI. Workspace selection happens before script.js starts; this file never syncs records. */
(function setupSupabaseAccountUi(){
    const workspace = window.IRON_MIND_WORKSPACE;
    const accountSection = document.getElementById("supabaseAccountContent");
    const configNotice = document.getElementById("supabaseAccountConfigNotice");
    const authForm = document.getElementById("supabaseAuthForm");
    const signupVerificationForm = document.getElementById("supabaseSignupVerificationForm");
    const passwordUpdateForm = document.getElementById("supabasePasswordUpdateForm");
    const signedInPanel = document.getElementById("supabaseSignedInPanel");
    const accountStatus = document.getElementById("supabaseAccountStatus");
    const emailInput = document.getElementById("supabaseAccountEmail");
    const passwordInput = document.getElementById("supabaseAccountPassword");
    const verificationCodeInput = document.getElementById("supabaseSignupVerificationCode");
    const verificationEmail = document.getElementById("supabaseSignupVerificationEmail");
    const resendCodeButton = document.getElementById("supabaseSignupResendCodeButton");
    const resendCooldownNotice = document.getElementById("supabaseSignupResendCooldown");
    const signupBackButton = document.getElementById("supabaseSignupBackButton");
    const newPasswordInput = document.getElementById("supabaseNewPassword");
    const signedInIdentity = document.getElementById("supabaseSignedInIdentity");
    const workspaceLabel = document.getElementById("supabaseWorkspaceLabel");
    const signOutButton = document.getElementById("supabaseSignOutButton");
    const passwordResetButton = document.getElementById("supabasePasswordResetButton");
    const copyDeviceButton = document.getElementById("copyDeviceWorkspaceButton");
    const openDeviceButton = document.getElementById("openDeviceWorkspaceButton");
    const openAccountButton = document.getElementById("openAccountWorkspaceButton");
    if(!workspace || !accountSection || !configNotice || !authForm || !accountStatus) return;

    const configured = workspace.authConfigured;
    let session = workspace.session || null;
    let recoveryMode = false;
    let busy = false;
    let pendingSignupEmail = "";
    let resendCooldownUntil = 0;
    let resendCooldownTimer = null;
    const RESEND_COOLDOWN_SECONDS = 60;

    function setStatus(message, isError = false){
        accountStatus.textContent = message;
        accountStatus.classList.toggle("is-error", isError);
    }

    function remainingResendSeconds(){
        return Math.max(0, Math.ceil((resendCooldownUntil - Date.now()) / 1000));
    }

    function updateResendCodeButton(){
        if(!resendCodeButton) return;
        const remaining = remainingResendSeconds();
        resendCodeButton.textContent = remaining ? `Resend Code (${remaining}s)` : "Resend Code";
        resendCodeButton.disabled = busy || remaining > 0 || !pendingSignupEmail;
        if(resendCooldownNotice){
            resendCooldownNotice.textContent = remaining
                ? `You can request another code in ${remaining} seconds.`
                : "You can request another code now.";
        }
    }

    function startResendCooldown(seconds = RESEND_COOLDOWN_SECONDS){
        const duration = Math.max(1, Math.ceil(Number(seconds) || RESEND_COOLDOWN_SECONDS));
        resendCooldownUntil = Date.now() + duration * 1000;
        if(resendCooldownTimer !== null) clearInterval(resendCooldownTimer);
        updateResendCodeButton();
        resendCooldownTimer = setInterval(() => {
            updateResendCodeButton();
            if(!remainingResendSeconds()){
                clearInterval(resendCooldownTimer);
                resendCooldownTimer = null;
            }
        }, 1000);
    }

    function clearResendCooldown(){
        if(resendCooldownTimer !== null) clearInterval(resendCooldownTimer);
        resendCooldownTimer = null;
        resendCooldownUntil = 0;
        updateResendCodeButton();
    }

    function isRateLimitError(error){
        const details = `${error?.code || ""} ${error?.message || error?.msg || ""}`.toLowerCase();
        return Number(error?.status) === 429 || /rate.?limit|too many requests|only request this after|email.{0,24}limit/.test(details);
    }

    function isInvalidOrExpiredOtp(error){
        const details = `${error?.code || ""} ${error?.message || error?.msg || ""}`.toLowerCase();
        return Number(error?.status) === 400 || /\b(?:invalid|expired)\b/.test(details);
    }

    function rateLimitWaitSeconds(error){
        const details = `${error?.message || error?.msg || ""}`;
        const match = details.match(/(?:after|in|wait(?:\s+for)?|retry(?:\s+in)?)\s+(\d{1,4})\s*(?:seconds?|secs?|s)\b/i);
        return match ? Math.max(1, Number(match[1])) : RESEND_COOLDOWN_SECONDS;
    }

    function reportAuthError(error, fallback){
        if(isRateLimitError(error)){
            const waitSeconds = rateLimitWaitSeconds(error);
            if(pendingSignupEmail) startResendCooldown(waitSeconds);
            setStatus(`Supabase is limiting authentication requests. Wait ${waitSeconds} seconds before trying again.`, true);
            return;
        }
        setStatus(error?.message || fallback, true);
    }

    function setBusy(value){
        busy = value;
        accountSection.querySelectorAll("button").forEach(button => { button.disabled = value || (button === signOutButton && !workspace.authAvailable); });
        updateResendCodeButton();
    }

    function renderSession(nextSession = session){
        session = nextSession || null;
        const user = session?.user || (workspace.authenticatedUserId ? { id:workspace.authenticatedUserId } : null);
        const signedIn = Boolean(user?.id);
        configNotice.classList.toggle("hidden", !configured || workspace.authAvailable);
        if(configured && !workspace.authAvailable){
            configNotice.textContent = "Not signed in. Supabase could not verify an account session, so only the device workspace is open and account workspaces are locked.";
        }
        authForm.classList.toggle("hidden", !configured || signedIn || recoveryMode || Boolean(pendingSignupEmail) || !workspace.authAvailable);
        signupVerificationForm?.classList.toggle("hidden", !configured || signedIn || recoveryMode || !pendingSignupEmail || !workspace.authAvailable);
        signedInPanel?.classList.toggle("hidden", !configured || !signedIn || recoveryMode);
        passwordUpdateForm?.classList.toggle("hidden", !configured || !recoveryMode || !workspace.authAvailable);
        if(signedInIdentity) signedInIdentity.textContent = user?.email || user?.id || "Account";
        if(workspaceLabel){
            workspaceLabel.textContent = workspace.userId
                ? `Current local workspace: this account (${workspace.userId}).`
                : "Current local workspace: device data shared by this browser profile.";
        }
        copyDeviceButton?.classList.toggle("hidden", !signedIn);
        openDeviceButton?.classList.toggle("hidden", !signedIn || !workspace.userId);
        openAccountButton?.classList.toggle("hidden", !signedIn || Boolean(workspace.userId));
        if(signOutButton) signOutButton.disabled = busy || !workspace.authAvailable;
        updateResendCodeButton();
    }

    function showSignupVerification(email){
        pendingSignupEmail = email;
        if(verificationEmail) verificationEmail.textContent = email;
        if(verificationCodeInput) verificationCodeInput.value = "";
        passwordInput.value = "";
        startResendCooldown();
        renderSession(null);
    }

    async function getClient(){
        if(!configured) throw new Error("Add the Supabase Project URL and publishable key to supabase-config.js first.");
        if(!workspace.authAvailable) throw new Error("The account service is unavailable. The local workspace remains available offline.");
        return workspace.getClient();
    }

    window.addEventListener("iron-mind-auth-session", event => {
        session = event.detail?.session || null;
        if(event.detail?.event === "SIGNED_IN"){
            pendingSignupEmail = "";
            if(verificationCodeInput) verificationCodeInput.value = "";
            clearResendCooldown();
        }
        renderSession(session);
        if(event.detail?.event === "SIGNED_OUT") setStatus("Signed out. The device workspace is separate from account data.");
    });

    authForm.addEventListener("submit", async event => {
        event.preventDefault();
        if(busy) return;
        const action = event.submitter?.dataset.cloudAuthAction || "signin";
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if(!email || !password){ setStatus("Enter your email and password.", true); return; }
        setBusy(true);
        setStatus(action === "signup" ? "Creating your account…" : "Signing in…");
        try{
            const client = await getClient();
            const result = action === "signup"
                ? await client.auth.signUp({ email, password })
                : await client.auth.signInWithPassword({ email, password });
            if(result.error) throw result.error;
            if(action === "signup" && !result.data?.session){
                showSignupVerification(email);
                setStatus("If this address can be registered, a verification code has been sent. Enter it to continue.");
            }else{
                session = result.data?.session || null;
                if(action === "signup") passwordInput.value = "";
                setStatus("Account ready. Its local workspace is separate. Cloud sync is manual and available in Account settings.");
                renderSession(session);
            }
        }catch(error){
            reportAuthError(error, "Supabase authentication could not be completed.");
        }finally{
            setBusy(false);
        }
    });

    signupVerificationForm?.addEventListener("submit", async event => {
        event.preventDefault();
        if(busy) return;
        const token = verificationCodeInput.value.trim();
        if(!pendingSignupEmail){ setStatus("Start account registration again to request a verification code.", true); return; }
        if(!/^\d+$/.test(token)){ setStatus("Enter the numeric verification code from the latest email.", true); verificationCodeInput.focus(); return; }
        setBusy(true);
        setStatus("Verifying your email…");
        try{
            const client = await getClient();
            const { data, error } = await client.auth.verifyOtp({ email:pendingSignupEmail, token, type:"email" });
            if(error) throw error;
            session = data?.session || null;
            pendingSignupEmail = "";
            verificationCodeInput.value = "";
            clearResendCooldown();
            if(session){
                setStatus("Email verified. Opening your account’s local workspace…");
                renderSession(session);
            }else{
                renderSession(null);
                setStatus("Email verified. Sign in to continue.");
            }
        }catch(error){
            verificationCodeInput.value = "";
            verificationCodeInput.focus();
            if(isRateLimitError(error)) reportAuthError(error, "Too many verification attempts.");
            else if(isInvalidOrExpiredOtp(error)) setStatus("That code is invalid or expired. Try the latest code or request another one.", true);
            else setStatus(error?.message || "Email verification could not be completed. Check your connection and try again.", true);
        }finally{
            setBusy(false);
        }
    });

    resendCodeButton?.addEventListener("click", async () => {
        if(busy || !pendingSignupEmail) return;
        const remaining = remainingResendSeconds();
        if(remaining){
            setStatus(`Please wait ${remaining} seconds before requesting another code.`, true);
            return;
        }
        setBusy(true);
        setStatus("Requesting another verification code…");
        try{
            const client = await getClient();
            const { error } = await client.auth.resend({ type:"signup", email:pendingSignupEmail });
            if(error) throw error;
            startResendCooldown();
            setStatus("If this address has a pending registration, a new verification code is on its way.");
        }catch(error){
            if(isRateLimitError(error)) reportAuthError(error, "The verification code could not be resent.");
            else setStatus(error?.message || "The verification code could not be resent.", true);
        }finally{
            setBusy(false);
        }
    });

    signupBackButton?.addEventListener("click", () => {
        if(busy) return;
        pendingSignupEmail = "";
        if(verificationCodeInput) verificationCodeInput.value = "";
        clearResendCooldown();
        renderSession(null);
        setStatus("Verification closed. Sign in or create an account to continue.");
        emailInput.focus();
    });

    passwordResetButton?.addEventListener("click", async () => {
        if(busy) return;
        const email = emailInput.value.trim();
        if(!email){ setStatus("Enter your account email first.", true); emailInput.focus(); return; }
        setBusy(true);
        setStatus("Requesting a password reset…");
        try{
            const client = await getClient();
            const redirectTo = `${window.location.origin}${window.location.pathname}`;
            const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
            if(error) throw error;
            setStatus("If an account matches that address, a password reset email will arrive. Check your inbox.");
        }catch(error){
            setStatus(error?.message || "The password reset request could not be sent.", true);
        }finally{
            setBusy(false);
        }
    });

    passwordUpdateForm?.addEventListener("submit", async event => {
        event.preventDefault();
        if(busy) return;
        const password = newPasswordInput.value;
        if(!password){ setStatus("Enter a new password.", true); return; }
        setBusy(true);
        setStatus("Updating your password…");
        try{
            const client = await getClient();
            const { error } = await client.auth.updateUser({ password });
            if(error) throw error;
            recoveryMode = false;
            newPasswordInput.value = "";
            setStatus("Password updated successfully.");
            const { data } = await client.auth.getSession();
            renderSession(data?.session || null);
        }catch(error){
            setStatus(error?.message || "The password could not be updated.", true);
        }finally{
            setBusy(false);
        }
    });

    signOutButton?.addEventListener("click", async () => {
        if(busy) return;
        setBusy(true);
        setStatus("Signing out…");
        try{
            const client = await getClient();
            const { error } = await client.auth.signOut();
            if(error) throw error;
            recoveryMode = false;
            renderSession(null);
            setStatus("Signed out. Account data remains saved in that account’s local workspace.");
        }catch(error){
            setStatus(error?.message || "Sign out could not be completed.", true);
        }finally{
            setBusy(false);
        }
    });

    copyDeviceButton?.addEventListener("click", async () => {
        if(busy) return;
        setBusy(true);
        try{
            const preview = await workspace.previewDeviceCopy();
            const size = preview.resourceBytes < 1024 * 1024
                ? `${preview.resourceBytes} bytes`
                : `${(preview.resourceBytes / (1024 * 1024)).toFixed(1)} MB`;
            const accepted = window.confirm(
                `Copy ${preview.localStorageKeys} device data entries and ${preview.resourceRecords} resource files (${size}) into the local workspace for ${workspace.authenticatedUserId}?\n\nThe account workspace must be empty. The device workspace will remain unchanged. Nothing will be uploaded or synchronized.`
            );
            if(!accepted){ setStatus("Copy cancelled. Device data was not changed."); return; }
            await workspace.copyDeviceToAccount(preview.token);
            setStatus("Device data was copied locally. The original device workspace is unchanged. Opening the account workspace…");
            workspace.openAccountWorkspace();
        }catch(error){
            setStatus(error?.message || "Device data could not be copied.", true);
        }finally{
            setBusy(false);
        }
    });

    openDeviceButton?.addEventListener("click", () => {
        if(busy || !window.confirm("Open the browser-local device workspace? It is separate from this account and may be shared by people using this device.")) return;
        workspace.openDeviceWorkspace();
    });

    openAccountButton?.addEventListener("click", () => {
        if(busy) return;
        try{ workspace.openAccountWorkspace(); }
        catch(error){ setStatus(error?.message || "The account workspace could not be opened.", true); }
    });

    window.addEventListener("iron-mind-auth-session", event => {
        if(event.detail?.event === "PASSWORD_RECOVERY"){
            recoveryMode = true;
            setStatus("Choose a new password to finish resetting your account.");
            renderSession(event.detail.session);
        }
    });

    if(!configured){
        renderSession(null);
        configNotice.textContent = "Cloud accounts are not configured. Local app features remain available.";
        configNotice.classList.remove("hidden");
        setStatus("Cloud accounts are not configured. The device workspace remains available.");
        return;
    }

    renderSession(session);
    if(!workspace.authAvailable){
        configNotice.classList.remove("hidden");
        setStatus("Not signed in. Supabase could not verify the saved session; the account workspace is locked. The device workspace remains available offline.", true);
    }else if(!session){
        setStatus("Sign in or create an account. Device data will remain in its separate workspace.");
    }
})();
