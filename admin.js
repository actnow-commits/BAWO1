// ═══════════════════════════════════════════════════════
//  BAWO Dashboard Controller — admin.js
//  Manages: Auth, Content CMS, Media Uploads, Activity Feed
// ═══════════════════════════════════════════════════════

const supabaseUrl = 'https://tijsephkovqailbrwuzt.supabase.co';
const supabaseKey = 'sb_publishable_9RhuiNWEUwWLbg3phWHYoA_F3RilB8k';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ── DOM References ──
const loginSection = document.getElementById('login-section');
const dashSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const userBadge = document.getElementById('user-badge');
const cmsForm = document.getElementById('cms-form');
const contentGrid = document.getElementById('content-grid');
const publishBtn = document.getElementById('publish-btn');
const fileInput = document.getElementById('cms-file');
const fileNameEl = document.getElementById('file-name');
const toastEl = document.getElementById('toast');

// ── State ──
let currentUser = null;
let liveFeed = { donations: [], signups: [], comments: [] };

// ═══════════════════════════════════════════════════════
//  1. AUTHENTICATION
// ═══════════════════════════════════════════════════════

supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
        showDashboard();
    } else {
        currentUser = null;
        showLogin();
    }
});

function showLogin() {
    loginSection.style.display = 'flex';
    dashSection.style.display = 'none';
    logoutBtn.style.display = 'none';
    userBadge.style.display = 'none';
}

function showDashboard() {
    loginSection.style.display = 'none';
    dashSection.classList.add('active');
    dashSection.style.display = 'block';
    logoutBtn.style.display = 'inline-flex';
    userBadge.style.display = 'inline-flex';
    if (currentUser) {
        userBadge.innerHTML = `<i class="fas fa-user"></i> ${currentUser.email.split('@')[0]}`;
    }
    loadDashboardData();
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = loginForm.querySelector('button');
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Signing in…';
    btn.disabled = true;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    btn.disabled = false;

    if (error) {
        showToast('Invalid credentials. Please try again.', 'error');
    }
});

logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
});

// ═══════════════════════════════════════════════════════
//  2. CONTENT & MEDIA HANDLER (handleSiteUpdate)
// ═══════════════════════════════════════════════════════

async function handleSiteUpdate(sectionKey, title, text, file) {
    let mediaUrl = null;

    if (file) {
        const fileName = `${sectionKey}-${Date.now()}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('site-media')
            .upload(fileName, file);

        if (uploadErr) throw uploadErr;

        const { data } = supabase.storage.from('site-media').getPublicUrl(fileName);
        mediaUrl = data.publicUrl;
    }

    const { error } = await supabase
        .from('site_content')
        .upsert({
            section_key: sectionKey,
            title: title,
            body_text: text,
            ...(mediaUrl && { media_url: mediaUrl }),
            updated_at: new Date().toISOString()
        }, { onConflict: 'section_key' });

    return { error };
}

// ═══════════════════════════════════════════════════════
//  3. ACTIVITY FEED HANDLER (getLiveFeed)
// ═══════════════════════════════════════════════════════

async function getLiveFeed() {
    const { data, error } = await supabase
        .from('user_submissions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Feed error:', error.message);
        return { donations: [], signups: [], comments: [] };
    }

    return {
        donations: data?.filter(i => i.type === 'donation') || [],
        signups: data?.filter(i => i.type === 'signup') || [],
        comments: data?.filter(i => i.type === 'comment') || []
    };
}

// ═══════════════════════════════════════════════════════
//  4. DASHBOARD ORCHESTRATOR
// ═══════════════════════════════════════════════════════

window.loadDashboardData = async function () {
    await Promise.all([loadContentGrid(), loadActivityFeed()]);
};

// ── Load Content Grid ──
async function loadContentGrid() {
    contentGrid.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading content…</p></div>';

    const { data, error } = await supabase
        .from('site_content')
        .select('*')
        .order('section_key');

    if (error) {
        contentGrid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error: ${error.message}</p></div>`;
        return;
    }

    document.getElementById('stat-content').textContent = data ? data.length : 0;

    if (!data || data.length === 0) {
        contentGrid.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No content published yet. Use the form above to add your first section.</p></div>';
        return;
    }

    contentGrid.innerHTML = data.map(item => `
        <div class="content-card" onclick="loadIntoEditor('${item.section_key}')">
            <div class="cc-key">${item.section_key}</div>
            <h4>${item.title || formatKey(item.section_key)}</h4>
            <div class="cc-preview">${stripHtml(item.body_text || item.value || '')}</div>
            ${item.media_url ? '<div class="cc-media-tag"><i class="fas fa-image"></i> Has Media</div>' : ''}
        </div>
    `).join('');
}

// ── Load item into CMS editor on click ──
window.loadIntoEditor = async function (sectionKey) {
    const { data } = await supabase.from('site_content').select('*').eq('section_key', sectionKey).single();
    if (data) {
        document.getElementById('cms-section').value = data.section_key;
        document.getElementById('cms-title').value = data.title || '';
        document.getElementById('cms-body').value = data.body_text || data.value || '';
        fileNameEl.textContent = data.media_url ? 'Current media attached' : '';
        // Scroll to form
        document.querySelector('.cms-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast('Content loaded into editor. Make changes and hit Publish.', 'success');
    }
};

// ── Load Activity Feed ──
async function loadActivityFeed() {
    liveFeed = await getLiveFeed();

    // Update stat cards
    document.getElementById('stat-donations').textContent = liveFeed.donations.length;
    document.getElementById('stat-signups').textContent = liveFeed.signups.length;
    document.getElementById('stat-comments').textContent = liveFeed.comments.length;

    // Update tab badges
    document.getElementById('donation-count').textContent = liveFeed.donations.length;
    document.getElementById('signup-count').textContent = liveFeed.signups.length;
    document.getElementById('comment-count').textContent = liveFeed.comments.length;

    // Render each feed
    renderDonations(liveFeed.donations);
    renderSignups(liveFeed.signups);
    renderComments(liveFeed.comments);
}

function renderDonations(items) {
    const el = document.getElementById('donations-feed');
    if (items.length === 0) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-hand-holding-heart"></i><p>No donations logged yet. Donorbox handles primary processing.</p></div>';
        return;
    }
    el.innerHTML = items.map(d => `
        <div class="feed-item">
            <div class="feed-avatar" style="background: rgba(34, 197, 94, 0.15); color: var(--db-green);">
                ${getInitials(d.name)}
            </div>
            <div class="feed-body">
                <div class="feed-name">${d.name || 'Anonymous Donor'}</div>
                <div class="feed-detail">${d.email || 'No email provided'}</div>
                <div class="feed-time">${timeAgo(d.created_at)}</div>
            </div>
            ${d.amount ? `<div class="feed-amount">$${parseFloat(d.amount).toFixed(2)}</div>` : ''}
        </div>
    `).join('');
}

function renderSignups(items) {
    const el = document.getElementById('signups-feed');
    if (items.length === 0) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-user-friends"></i><p>No signups yet. They\'ll appear here when someone fills out the form.</p></div>';
        return;
    }
    el.innerHTML = items.map(s => `
        <div class="feed-item">
            <div class="feed-avatar" style="background: rgba(59, 130, 246, 0.15); color: #3B82F6;">
                ${getInitials(s.name)}
            </div>
            <div class="feed-body">
                <div class="feed-name">${s.name || 'Unknown'}</div>
                <div class="feed-detail"><i class="fas fa-envelope" style="margin-right:0.3rem;"></i> ${s.email || 'N/A'}${s.phone ? ` · <i class="fas fa-phone" style="margin-left:0.5rem;margin-right:0.3rem;"></i>${s.phone}` : ''}</div>
                ${s.message ? `<div class="feed-detail" style="margin-top:0.3rem; font-style:italic;">"${truncate(s.message, 100)}"</div>` : ''}
                <div class="feed-time">${timeAgo(s.created_at)}</div>
            </div>
        </div>
    `).join('');
}

function renderComments(items) {
    const el = document.getElementById('comments-feed');
    if (items.length === 0) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-comment-slash"></i><p>No community feedback yet.</p></div>';
        return;
    }
    el.innerHTML = items.map(c => `
        <div class="feed-item">
            <div class="feed-avatar" style="background: rgba(245, 158, 11, 0.15); color: var(--db-amber);">
                ${getInitials(c.name)}
            </div>
            <div class="feed-body">
                <div class="feed-name">${c.name || 'Anonymous'}</div>
                <div class="feed-detail">${c.message || 'No message'}</div>
                <div class="feed-time">${timeAgo(c.created_at)}</div>
            </div>
            <div class="approve-toggle">
                <input type="checkbox" id="approve-${c.id}" ${c.metadata?.approved ? 'checked' : ''} onchange="toggleApprove(${c.id}, this.checked)">
                <label for="approve-${c.id}">Approve</label>
            </div>
        </div>
    `).join('');
}

// ── Toggle comment approval ──
window.toggleApprove = async function (id, approved) {
    const { error } = await supabase
        .from('user_submissions')
        .update({ metadata: { approved } })
        .eq('id', id);

    if (error) {
        showToast('Could not update approval: ' + error.message, 'error');
    } else {
        showToast(approved ? 'Comment approved!' : 'Comment unapproved.', 'success');
    }
};

// ═══════════════════════════════════════════════════════
//  5. CMS FORM HANDLER
// ═══════════════════════════════════════════════════════

cmsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sectionKey = document.getElementById('cms-section').value;
    const title = document.getElementById('cms-title').value;
    const body = document.getElementById('cms-body').value;
    const file = fileInput.files[0];

    if (!sectionKey) {
        showToast('Please select a site section first.', 'error');
        return;
    }
    if (!body.trim()) {
        showToast('Body text cannot be empty.', 'error');
        return;
    }

    publishBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Publishing…';
    publishBtn.disabled = true;

    try {
        const { error } = await handleSiteUpdate(sectionKey, title, body, file);
        if (error) throw error;

        showToast(`"${formatKey(sectionKey)}" is now live!`, 'success');
        cmsForm.reset();
        fileNameEl.textContent = '';
        await loadContentGrid();
    } catch (err) {
        showToast('Publish failed: ' + err.message, 'error');
    } finally {
        publishBtn.innerHTML = '<i class="fas fa-rocket"></i> Publish';
        publishBtn.disabled = false;
    }
});

// File name preview
fileInput.addEventListener('change', () => {
    fileNameEl.textContent = fileInput.files[0] ? fileInput.files[0].name : '';
});

// CMS form reset clears file name
cmsForm.addEventListener('reset', () => {
    setTimeout(() => { fileNameEl.textContent = ''; }, 0);
});

// ═══════════════════════════════════════════════════════
//  6. TAB NAVIGATION
// ═══════════════════════════════════════════════════════

document.getElementById('tab-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;

    // Update button states
    document.querySelectorAll('#tab-nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Show correct panel
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
});

// ═══════════════════════════════════════════════════════
//  7. UTILITIES
// ═══════════════════════════════════════════════════════

function formatKey(key) {
    if (!key) return '';
    return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function stripHtml(text) {
    if (!text) return '';
    const clean = text.replace(/<[^>]*>?/gm, '');
    return clean.length > 120 ? clean.substring(0, 120) + '…' : clean;
}

function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '…' : str;
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
}

function timeAgo(dateStr) {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 }
    ];
    for (const i of intervals) {
        const count = Math.floor(seconds / i.seconds);
        if (count >= 1) return `${count} ${i.label}${count > 1 ? 's' : ''} ago`;
    }
    return 'Just now';
}

function showToast(message, type = 'success') {
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toastEl.className = `toast ${type}`;
    toastEl.innerHTML = `<i class="fas ${icon}" style="color: ${type === 'success' ? 'var(--db-green)' : 'var(--db-red)'}"></i><span class="toast-msg">${message}</span>`;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3500);
}
