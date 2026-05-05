// ═══════════════════════════════════════════════════════
//  BAWO Dashboard Controller — admin.js
//  Manages: Auth, Content CMS, Media Uploads, Activity Feed
// ═══════════════════════════════════════════════════════

// ── Supabase Init (wrapped to prevent script crash) ──
let sb = null;
const supabaseUrl = 'https://tijsephkovqailbrwuzt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpanNlcGhrb3ZxYWlsYnJ3dXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNDA1ODAsImV4cCI6MjA4MzgxNjU4MH0.OUiJIvkMfdTtUvyrgoRKfc4tPZV55F7NTFyNKm8L1rk';

try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        sb = window.supabase.createClient(supabaseUrl, supabaseKey);
    } else {
        console.warn('Supabase library not found. Dashboard will run in offline mode.');
    }
} catch (err) {
    console.warn('Supabase init failed:', err.message, '— Dashboard will run in offline mode.');
}

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
//  6. TAB NAVIGATION  (registered FIRST — no dependencies)
// ═══════════════════════════════════════════════════════

(function initTabs() {
    const tabNav = document.getElementById('tab-nav');
    if (!tabNav) return;

    tabNav.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-tab]');
        if (!btn) return;

        // Update button states
        tabNav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show correct panel
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const targetPanel = document.getElementById(`panel-${btn.dataset.tab}`);
        if (targetPanel) targetPanel.classList.add('active');
    });
})();

// ═══════════════════════════════════════════════════════
//  1. AUTHENTICATION
// ═══════════════════════════════════════════════════════

if (sb) {
    try {
        sb.auth.onAuthStateChange((event, session) => {
            if (session) {
                currentUser = session.user;
                showDashboard();
            } else {
                currentUser = null;
                showLogin();
            }
        });
    } catch (err) {
        console.warn('Auth listener failed:', err.message);
    }
}

function showLogin() {
    if (loginSection) loginSection.style.display = 'flex';
    if (dashSection) dashSection.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userBadge) userBadge.style.display = 'none';
}

function showDashboard() {
    if (loginSection) loginSection.style.display = 'none';
    if (dashSection) {
        dashSection.classList.add('active');
        dashSection.style.display = 'block';
    }
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (userBadge) {
        userBadge.style.display = 'inline-flex';
        if (currentUser) {
            userBadge.innerHTML = `<i class="fas fa-user"></i> ${currentUser.email.split('@')[0]}`;
        }
    }
    loadDashboardData();
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!sb) {
            showToast('Database connection unavailable. Please check configuration.', 'error');
            return;
        }
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = loginForm.querySelector('button');
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Signing in…';
        btn.disabled = true;

        const { error } = await sb.auth.signInWithPassword({ email, password });

        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        btn.disabled = false;

        if (error) {
            showToast('Invalid credentials. Please try again.', 'error');
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (sb) await sb.auth.signOut();
    });
}

// ═══════════════════════════════════════════════════════
//  2. CONTENT & MEDIA HANDLER (handleSiteUpdate)
// ═══════════════════════════════════════════════════════

async function handleSiteUpdate(sectionKey, title, text, file) {
    if (!sb) throw new Error('Database not connected');
    let mediaUrl = null;

    if (file) {
        const extension = file.name.split('.').pop();
        const fileName = `${sectionKey}-${Date.now()}.${extension}`;
        const { data: uploadData, error: uploadErr } = await sb.storage
            .from('site-media')
            .upload(fileName, file);

        if (uploadErr) throw uploadErr;

        const { data } = sb.storage.from('site-media').getPublicUrl(fileName);
        mediaUrl = data.publicUrl;
    }

    // 1. Fetch existing content to handle partial updates properly
    // Use maybeSingle to avoid errors if the row doesn't exist yet
    const { data: existing } = await sb
        .from('site_content')
        .select('*')
        .eq('section_key', sectionKey)
        .maybeSingle();

    // 2. Build update object
    const updateData = {
        section_key: sectionKey,
        published: true, // Ensure it's active
        updated_at: new Date().toISOString()
    };

    // Only set if provided, otherwise fallback to existing if it exists
    if (title !== undefined && title !== null && title !== '') {
        updateData.title = title;
    } else if (existing) {
        updateData.title = existing.title;
    }

    if (text !== undefined && text !== null && text !== '') {
        updateData.body_text = text;
    } else if (existing) {
        updateData.body_text = existing.body_text;
    } else {
        updateData.body_text = '';
    }

    if (mediaUrl) {
        updateData.media_url = mediaUrl;
    } else if (existing) {
        updateData.media_url = existing.media_url;
    }

    const { error } = await sb
        .from('site_content')
        .upsert(updateData, { onConflict: 'section_key' });

    return { error };
}

// ═══════════════════════════════════════════════════════
//  3. ACTIVITY FEED HANDLER (getLiveFeed)
// ═══════════════════════════════════════════════════════

async function getLiveFeed() {
    if (!sb) return { donations: [], signups: [], comments: [] };

    const { data, error } = await sb
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
    try {
        await Promise.all([loadContentGrid(), loadActivityFeed()]);

        // Check for deep-link from live site
        const urlParams = new URLSearchParams(window.location.search);
        const editKey = urlParams.get('edit');
        if (editKey) {
            // Wait a tiny bit for the grid to render before loading into editor
            setTimeout(() => loadIntoEditor(editKey), 300);
        }
    } catch (err) {
        console.warn('Dashboard data load failed:', err.message);
    }
};

// ── Load Content Grid ──
// ── Load Content Grid ──
async function loadContentGrid(filterKey = null) {
    if (!sb || !contentGrid) return;

    let query = sb.from('site_content').select('*');
    if (filterKey) {
        query = query.eq('section_key', filterKey);
    }

    const { data, error } = await query;
    if (error) {
        contentGrid.innerHTML = `<div class="empty-state">Error loading content: ${error.message}</div>`;
        return;
    }

    // Update stat if applicable
    if (document.getElementById('stat-content')) {
        document.getElementById('stat-content').textContent = data ? data.length : 0;
    }

    if (!data || data.length === 0) {
        contentGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-magic"></i>
                <p>${filterKey ? 'This section hasn\'t been published yet. Use the editor above to create it!' : 'No content published yet.'}</p>
                ${filterKey ? '<button class="btn-dash btn-outline" style="margin-top: 1rem" onclick="loadContentGrid()">View All Published</button>' : ''}
            </div>`;
        return;
    }

    contentGrid.innerHTML = (filterKey ? '<div style="grid-column: 1/-1; display:flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;"><small style="color:var(--db-accent); font-weight:700;">FILTERED VIEW</small> <button class="btn-dash btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;" onclick="loadContentGrid()">Show All</button></div>' : '') + data.map(item => `
        <div class="content-card ${filterKey === item.section_key ? 'highlighted' : ''}" onclick="loadIntoEditor('${item.section_key}')">
            <button class="cc-delete-btn" title="Delete this section" onclick="event.stopPropagation(); deleteContent('${item.section_key}')">
                <i class="fas fa-trash"></i>
            </button>
            ${item.media_url ? `
                <div class="cc-media-preview">
                    ${item.media_url.match(/\.(mp4|webm|ogg)$/i)
                ? `<div class="cc-video-placeholder"><i class="fas fa-video"></i></div>`
                : `<img src="${item.media_url}" alt="Preview">`}
                </div>
            ` : ''}
            <div class="cc-info">
                <div class="cc-key">${item.section_key}</div>
                <h4>${item.title || formatKey(item.section_key)}</h4>
                <div class="cc-preview">${stripHtml(item.body_text || item.value || '')}</div>
            </div>
        </div>
    `).join('');
}

// ── Delete item ──
window.deleteContent = async function (sectionKey) {
    if (!sb) return;
    if (!confirm(`Are you sure you want to delete the "${formatKey(sectionKey)}" section? This cannot be undone.`)) return;

    try {
        const { error } = await sb.from('site_content').delete().eq('section_key', sectionKey);
        if (error) throw error;

        showToast(`"${formatKey(sectionKey)}" deleted successfully.`, 'success');
        await loadContentGrid();
    } catch (err) {
        console.error('Delete error:', err);
        showToast('Delete failed: ' + err.message, 'error');
    }
};

// ── Load item into CMS editor ──
window.loadIntoEditor = async function (sectionKey, shouldScroll = true) {
    if (!sb) return;

    // UI Toggle for Date/Status fields
    const isDate = sectionKey && sectionKey.includes('_date');
    const dateGroup = document.getElementById('date-field-group');
    const bodyGroup = document.getElementById('body-field-group');
    const titleField = document.getElementById('cms-title')?.parentElement;

    if (isDate) {
        if (dateGroup) dateGroup.style.display = 'block';
        if (bodyGroup) bodyGroup.style.display = 'none';
        if (titleField) titleField.style.display = 'none';
    } else {
        if (dateGroup) dateGroup.style.display = 'none';
        if (bodyGroup) bodyGroup.style.display = 'block';
        if (titleField) titleField.style.display = 'block';
    }

    // Ensure the key exists in the dropdown (important for custom/dynamic keys)
    const sectionSelect = document.getElementById('cms-section');
    if (sectionKey && sectionSelect && !Array.from(sectionSelect.options).some(o => o.value === sectionKey)) {
        const option = document.createElement('option');
        option.value = sectionKey;
        option.textContent = formatKey(sectionKey);

        // Try to add to Partners group if it looks like a partner
        const optGroup = sectionSelect.querySelector('optgroup[label="Partners & Donate"]');
        if (sectionKey.startsWith('partner_') && optGroup) {
            optGroup.appendChild(option);
        } else {
            sectionSelect.appendChild(option);
        }
    }

    const { data } = await sb.from('site_content').select('*').eq('section_key', sectionKey).single();
    if (data) {
        document.getElementById('cms-section').value = data.section_key;
        document.getElementById('cms-title').value = data.title || '';
        document.getElementById('cms-body').value = data.body_text || data.value || '';
        if (isDate && document.getElementById('cms-date')) {
            document.getElementById('cms-date').value = data.body_text || data.value || '';
        }
        fileNameEl.textContent = data.media_url ? 'Current media attached' : '';

        if (shouldScroll) {
            document.querySelector('.cms-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } else {
        // Clear if not found (new section selected or not in DB)
        if (sectionSelect) sectionSelect.value = sectionKey;
        document.getElementById('cms-title').value = '';
        document.getElementById('cms-body').value = '';
        if (document.getElementById('cms-date')) document.getElementById('cms-date').value = '';
        fileNameEl.textContent = '';
    }
};

// ── Load Activity Feed ──
async function loadActivityFeed() {
    liveFeed = await getLiveFeed();

    // Update stat cards
    if (document.getElementById('stat-donations')) document.getElementById('stat-donations').textContent = liveFeed.donations.length;
    if (document.getElementById('stat-signups')) document.getElementById('stat-signups').textContent = liveFeed.signups.length;
    if (document.getElementById('stat-comments')) document.getElementById('stat-comments').textContent = liveFeed.comments.length;

    // Update tab badges
    if (document.getElementById('donation-count')) document.getElementById('donation-count').textContent = liveFeed.donations.length;
    if (document.getElementById('signup-count')) document.getElementById('signup-count').textContent = liveFeed.signups.length;
    if (document.getElementById('comment-count')) document.getElementById('comment-count').textContent = liveFeed.comments.length;

    // Render each feed
    renderDonations(liveFeed.donations);
    renderSignups(liveFeed.signups);
    renderComments(liveFeed.comments);
}

function renderDonations(items) {
    const el = document.getElementById('donations-feed');
    if (!el) return;
    if (items.length === 0) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-hand-holding-heart"></i><p>No donations logged yet.</p></div>';
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
    if (!el) return;
    if (items.length === 0) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-user-friends"></i><p>No signups yet.</p></div>';
        return;
    }
    el.innerHTML = items.map(s => `
        <div class="feed-item">
            <div class="feed-avatar" style="background: rgba(59, 130, 246, 0.15); color: #3B82F6;">
                ${getInitials(s.name)}
            </div>
            <div class="feed-body">
                <div class="feed-name">${s.name || 'Unknown'}</div>
                <div class="feed-detail"><i class="fas fa-envelope"></i> ${s.email || 'N/A'}</div>
                <div class="feed-time">${timeAgo(s.created_at)}</div>
            </div>
        </div>
    `).join('');
}

function renderComments(items) {
    const el = document.getElementById('comments-feed');
    if (!el) return;
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

window.toggleApprove = async function (id, approved) {
    if (!sb) return;
    const { error } = await sb.from('user_submissions').update({ metadata: { approved } }).eq('id', id);
    if (error) showToast('Update failed: ' + error.message, 'error');
    else showToast(approved ? 'Comment approved!' : 'Comment hidden.', 'success');
};

// ═══════════════════════════════════════════════════════
//  5. CMS FORM HANDLER
// ═══════════════════════════════════════════════════════

if (cmsForm) {
    const sectionSelect = document.getElementById('cms-section');
    if (sectionSelect) {
        sectionSelect.addEventListener('change', async (e) => {
            const key = e.target.value;
            if (key) {
                await loadIntoEditor(key, false);
                await loadContentGrid(key);
                showToast(`Viewing: ${formatKey(key)}`, 'success');
            } else {
                await loadContentGrid();
            }
        });
    }

    cmsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sectionKey = document.getElementById('cms-section').value;
        const title = document.getElementById('cms-title').value;
        let body = document.getElementById('cms-body').value;
        const file = fileInput.files[0];

        // Override body if date field is visible
        const dateInput = document.getElementById('cms-date');
        if (dateInput && sectionKey.includes('_date')) {
            body = dateInput.value;
        }

        if (!sectionKey) {
            showToast('Please select a site section first.', 'error');
            return;
        }

        publishBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Publishing…';
        publishBtn.disabled = true;

        try {
            const { error } = await handleSiteUpdate(sectionKey, title, body, file);
            if (error) {
                console.error('CMS Update Error Object:', error);
                throw error;
            }
            showToast(`"${formatKey(sectionKey)}" is now live!`, 'success');
            // Don't reset everything, just clear file and refresh grid
            fileInput.value = '';
            fileNameEl.textContent = '';
            await loadContentGrid(sectionKey);
        } catch (err) {
            console.error('CMS Publish Catch:', err);
            showToast('Publish failed: ' + (err.message || 'Row Level Security violation'), 'error');
        } finally {
            publishBtn.innerHTML = '<i class="fas fa-rocket"></i> Publish';
            publishBtn.disabled = false;
        }
    });

    fileInput.addEventListener('change', () => {
        fileNameEl.textContent = fileInput.files[0] ? fileInput.files[0].name : '';
    });

    cmsForm.addEventListener('reset', () => {
        setTimeout(() => {
            fileNameEl.textContent = '';
            const dateGroup = document.getElementById('date-field-group');
            const bodyGroup = document.getElementById('body-field-group');
            const titleField = document.getElementById('cms-title')?.parentElement;
            if (dateGroup) dateGroup.style.display = 'none';
            if (bodyGroup) bodyGroup.style.display = 'block';
            if (titleField) titleField.style.display = 'block';
            loadContentGrid(); // Show all on reset
        }, 0);
    });

    // ── Date Picker Helper ──
    const datePickerHelper = document.getElementById('date-picker-helper');
    if (datePickerHelper) {
        datePickerHelper.addEventListener('change', (e) => {
            if (!e.target.value) return;
            const date = new Date(e.target.value);
            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            const formatted = `COMPLETED - ${months[date.getMonth()]} ${date.getFullYear()}`;
            const dateInput = document.getElementById('cms-date');
            if (dateInput) {
                dateInput.value = formatted;
                dateInput.focus();
            }
        });
    }

    // ── Add New Partner Logic ──
    const addPartnerBtn = document.getElementById('add-partner-btn');
    if (addPartnerBtn) {
        addPartnerBtn.addEventListener('click', () => {
            const partnerId = 'partner_' + Math.random().toString(36).substring(2, 9);

            // Set values in editor
            const sectionSelect = document.getElementById('cms-section');

            // Check if we need to add a new option to the dropdown or just use a custom input
            // For now, let's just use the sectionKey directly in the editor
            document.getElementById('cms-section').value = ''; // Clear selection

            // We'll allow "custom" keys by adding an option dynamically if it doesn't exist
            let option = Array.from(sectionSelect.options).find(o => o.value === partnerId);
            if (!option) {
                const optGroup = sectionSelect.querySelector('optgroup[label="Partners & Donate"]');
                option = document.createElement('option');
                option.value = partnerId;
                option.textContent = `New Partner (${partnerId})`;
                if (optGroup) optGroup.appendChild(option);
                else sectionSelect.appendChild(option);
            }

            sectionSelect.value = partnerId;
            document.getElementById('cms-title').value = 'New Partner Name';
            document.getElementById('cms-body').value = 'Description of the new partner...';
            fileNameEl.textContent = '';

            document.querySelector('.cms-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
            showToast('Ready to add new partner. Press Publish when done.', 'success');
        });
    }
}

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
    if (!toastEl) return;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toastEl.className = `toast ${type}`;
    toastEl.innerHTML = `<i class="fas ${icon}"></i><span class="toast-msg">${message}</span>`;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3500);
}
