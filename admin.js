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
        // Try sign up if login fails (Simplified flow for this task)
        if (error.message.includes('Invalid login')) {
            const confirmSignUp = confirm("Login failed. Do you want to create a new account with these credentials?");
            if (confirmSignUp) {
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password
                });
                if (signUpError) {
                    alert('Error signing up: ' + signUpError.message);
                } else {
                    alert('Account created! Please check your email to confirm your account before logging in.');
                }
            } else {
                alert('Error logging in: ' + error.message);
            }
        } else {
            alert('Error logging in: ' + error.message);
        }
    }
});

// Logout Handler
logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
});

// Fetch Content
async function fetchContent() {
    contentList.innerHTML = '<p>Loading...</p>';
    const { data, error } = await supabase
        .from('site_content')
        .select('*')
        .order('key');

    if (error) {
        contentList.innerHTML = `<p style="color: red">Error fetching content: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        contentList.innerHTML = '<p>No content items found.</p>';
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
                <h4>${formatKey(item.key)}</h4>
                <p><strong>Key:</strong> ${item.key}</p>
                <p><strong>Type:</strong> ${item.type}</p>
                <p><strong>Value:</strong> ${escapeHtml(item.value)}</p>
            </div>
            <button class="btn btn-primary" onclick="openEditModal('${item.key}')">Edit</button>
        `;
        contentList.appendChild(div);
    });
}

// Edit Modal
window.openEditModal = async (key) => {
    // Fetch latest value for this key
    const { data } = await supabase.from('site_content').select('*').eq('key', key).single();
    if (data) {
        document.getElementById('edit-key').value = data.key;
        document.getElementById('edit-value').value = data.value;
        document.getElementById('modal-title').textContent = `Edit ${formatKey(data.key)}`;
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
    const value = document.getElementById('edit-value').value;
    const submitBtn = editForm.querySelector('button');

    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    const { error } = await supabase
        .from('site_content')
        .update({ value })
        .eq('key', key);

    submitBtn.textContent = 'Save Changes';
    submitBtn.disabled = false;

    if (error) {
        alert('Error saving changes: ' + error.message);
    } else {
        editModal.style.display = 'none';
        fetchContent();
        alert('Content updated successfully!');
    }
});

// Utilities
function formatKey(key) {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function escapeHtml(text) {
    if (!text) return '';
    if (text.length > 50) return text.substring(0, 50) + '...';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
