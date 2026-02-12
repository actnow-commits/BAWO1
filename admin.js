// Supabase Configuration matching script.js
const supabaseUrl = 'https://tijsephkovqailbrwuzt.supabase.co';
const supabaseKey = 'sb_publishable_9RhuiNWEUwWLbg3phWHYoA_F3RilB8k';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const contentList = document.getElementById('content-list');
const submissionsList = document.getElementById('submissions-list');
const editModal = document.getElementById('edit-modal');
const closeModal = document.querySelector('.close-modal');
const editForm = document.getElementById('edit-form');

// State
let currentUser = null;

// Auth Listener
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
    loginSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    logoutBtn.style.display = 'none';
}

function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    logoutBtn.style.display = 'block';
    fetchContent();
    fetchSubmissions();
}

// Login Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert('Error logging in: ' + error.message);
    }
});

// Logout Handler
logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
});

/**
 * Handles uploading media and updating section text
 */
async function saveSectionUpdate(sectionKey, title, body, file) {
    let mediaUrl = null;

    // 1. Upload File if provided
    if (file && file.size > 0) {
        const fileName = `${sectionKey}-${Date.now()}`; // Simplified name as per user code
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('site-media')
            .upload(fileName, file);

        if (uploadError) {
            console.error('Upload Error:', uploadError.message);
            alert('Upload Error: ' + uploadError.message);
            return;
        }

        const { data } = supabase.storage.from('site-media').getPublicUrl(fileName);
        mediaUrl = data.publicUrl;
    }

    // 2. Save everything to 'site_content' table
    const { error } = await supabase
        .from('site_content')
        .upsert({
            section_key: sectionKey,
            title: title,
            body_text: body,
            ...(mediaUrl && { media_url: mediaUrl }), // Only update URL if file was uploaded
            updated_at: new Date()
        }, { onConflict: 'section_key' });

    if (error) {
        alert('Error updating site: ' + error.message);
    } else {
        alert('Section "' + sectionKey + '" is now live!');
        editModal.style.display = 'none';
        fetchContent();
    }
}

/**
 * Fetches activity feed
 */
async function fetchSubmissions() {
    if (!submissionsList) return;

    submissionsList.innerHTML = '<p>Loading activity...</p>';

    const { data, error } = await supabase
        .from('user_submissions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        submissionsList.innerHTML = `<p style="color: red">Error: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        submissionsList.innerHTML = '<p>No activity yet.</p>';
        return;
    }

    // Following user's structure for filtering
    const liveFeed = {
        donations: data.filter(i => i.type === 'donation'),
        signups: data.filter(i => i.type === 'signup'),
        comments: data.filter(i => i.type === 'comment')
    };

    renderSubmissions(data);
}

function renderSubmissions(data) {
    submissionsList.innerHTML = '';
    data.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'content-item';
        div.style.borderLeft = `4px solid ${getTypeColor(sub.type)}`;
        div.innerHTML = `
            <div class="content-item-details">
                <h4>${sub.name || 'Anonymous'} <span style="font-size: 0.8rem; color: #999">(${sub.type})</span></h4>
                <p><strong>Email:</strong> ${sub.email || 'N/A'}</p>
                <p><strong>Message:</strong> ${sub.message || 'No message'}</p>
                <p style="font-size: 0.75rem; color: #bbb">${new Date(sub.created_at).toLocaleString()}</p>
            </div>
        `;
        submissionsList.appendChild(div);
    });
}

function getTypeColor(type) {
    switch (type) {
        case 'signup': return 'var(--accent-teal)';
        case 'donation': return '#4CAF50';
        case 'comment': return '#FF9800';
        default: return '#999';
    }
}

// Fetch Content
async function fetchContent() {
    contentList.innerHTML = '<p>Loading...</p>';
    const { data, error } = await supabase
        .from('site_content')
        .select('*')
        .order('section_key');

    if (error) {
        contentList.innerHTML = `<p style="color: red">Error fetching content: ${error.message}</p>`;
        return;
    }

    renderContentList(data);
}

function renderContentList(items) {
    contentList.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'content-item';
        div.innerHTML = `
            <div class="content-item-details">
                <h4>${formatKey(item.section_key)}</h4>
                <p><strong>Key:</strong> ${item.section_key}</p>
                <p><strong>Value:</strong> ${escapeHtml(item.body_text || item.value)}</p>
                ${item.media_url ? `<p style="color: var(--accent-teal)">Contains Image</p>` : ''}
            </div>
            <button class="btn btn-primary" onclick="openEditModal('${item.section_key}')">Edit</button>
        `;
        contentList.appendChild(div);
    });
}

// Edit Modal
window.openEditModal = async (sectionKey) => {
    const { data } = await supabase.from('site_content').select('*').eq('section_key', sectionKey).single();
    if (data) {
        document.getElementById('edit-key').value = data.section_key;
        document.getElementById('edit-title').value = data.title || '';
        document.getElementById('edit-value').value = data.body_text || data.value || '';
        document.getElementById('modal-title').textContent = `Edit ${formatKey(data.section_key)}`;
        editModal.style.display = 'flex';
    }
};

closeModal.addEventListener('click', () => {
    editModal.style.display = 'none';
});

window.onclick = (e) => {
    if (e.target === editModal) {
        editModal.style.display = 'none';
    }
};

// Save Changes
editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = document.getElementById('edit-key').value;
    const title = document.getElementById('edit-title').value;
    const value = document.getElementById('edit-value').value;
    const file = document.getElementById('edit-image').files[0];
    const submitBtn = editForm.querySelector('button');

    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    await saveSectionUpdate(key, title, value, file);

    submitBtn.textContent = 'Save Changes';
    submitBtn.disabled = false;
});

// Utilities
function formatKey(key) {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function escapeHtml(text) {
    if (!text) return '';
    const plain = text.replace(/<[^>]*>?/gm, '');
    if (plain.length > 80) return plain.substring(0, 80) + '...';
    return plain;
}

