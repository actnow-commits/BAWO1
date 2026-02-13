document.addEventListener('DOMContentLoaded', () => {
    // ── Mobile Menu Toggle ──
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileBtn.innerHTML = navLinks.classList.contains('active')
                ? '<i class="fas fa-times"></i>'
                : '<i class="fas fa-bars"></i>';
        });
    }

    // ── Active Link Highlighting ──
    const path = window.location.pathname;
    const links = document.querySelectorAll('.nav-links a');

    links.forEach(link => {
        const href = link.getAttribute('href');
        if ((path === '/' || path === '/index.html' || path === '') && href === '/') {
            link.classList.add('active');
        } else if (href !== '/' && (path === '/' + href || path === href)) {
            link.classList.add('active');
        }
    });

    // ── Scroll Animations ──
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });

    // ── Supabase Configuration ──
    const supabaseUrl = 'https://tijsephkovqailbrwuzt.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpanNlcGhrb3ZxYWlsYnJ3dXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNDA1ODAsImV4cCI6MjA4MzgxNjU4MH0.OUiJIvkMfdTtUvyrgoRKfc4tPZV55F7NTFyNKm8L1rk';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // ═══════════════════════════════════════════════════════
    //  DYNAMIC FRONTEND HOOK
    //  Fetches latest content from site_content and replaces
    //  all [data-cms-key] placeholders on load.
    // ═══════════════════════════════════════════════════════

    async function loadCMSContent() {
        const cmsElements = document.querySelectorAll('[data-cms-key]');
        if (cmsElements.length === 0) return;

        try {
            // Check for admin session to enable "Edit Mode"
            const { data: { session } } = await supabase.auth.getSession();
            const isAdmin = !!session;

            const { data, error } = await supabase
                .from('site_content')
                .select('*');

            if (error) throw error;
            if (!data) return;

            const contentMap = {};
            data.forEach(item => {
                contentMap[item.section_key] = item;
            });

            cmsElements.forEach(el => {
                const key = el.getAttribute('data-cms-key');
                const content = contentMap[key];

                // ── Admin UI Overlay ──
                if (isAdmin) {
                    el.style.cursor = 'pointer';
                    el.title = `Click to edit: ${key}`;
                    el.classList.add('cms-admin-editable');
                    el.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.location.href = `dashboard.html?edit=${key}`;
                    });
                }

                if (!content) return;

                const bodyText = content.body_text || content.value;
                const title = content.title;
                const mediaUrl = content.media_url;

                // ── Image elements: swap src ──
                if (el.tagName === 'IMG' && mediaUrl) {
                    el.src = mediaUrl;
                    if (title) el.alt = title;
                    return;
                }

                // ── Video elements: swap src ──
                if (el.tagName === 'VIDEO' && mediaUrl) {
                    let sourceEl = el.querySelector('source');
                    if (sourceEl) {
                        sourceEl.src = mediaUrl;
                    } else {
                        el.src = mediaUrl;
                    }
                    el.load();
                    return;
                }

                // ── Background images (divs/sections) ──
                if (mediaUrl && (el.tagName === 'SECTION' || el.tagName === 'DIV')) {
                    const currentBg = window.getComputedStyle(el).backgroundImage;
                    if (currentBg !== 'none') {
                        // Preserve gradients if they exist
                        if (currentBg.includes('gradient')) {
                            const gradients = currentBg.split(', url')[0];
                            el.style.backgroundImage = `${gradients}, url('${mediaUrl}')`;
                        } else {
                            el.style.backgroundImage = `url('${mediaUrl}')`;
                        }
                    }
                }

                // ── Text elements: inject body text ──
                if (bodyText) {
                    el.innerHTML = bodyText;
                }

                if (title) {
                    const titleEl = el.closest('[data-cms-key]')?.parentElement?.querySelector(`[data-cms-title="${key}"]`)
                        || document.querySelector(`[data-cms-title="${key}"]`);
                    if (titleEl) {
                        titleEl.innerHTML = title;
                    }
                }
            });

        } catch (error) {
            console.error('CMS Load Error:', error.message || error);
        }
    }

    loadCMSContent();

    // ═══════════════════════════════════════════════════════
    //  FORM SUBMISSION → user_submissions
    // ═══════════════════════════════════════════════════════

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            const formData = {
                type: 'signup',
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                message: document.getElementById('message').value
            };

            try {
                const { error } = await supabase
                    .from('user_submissions')
                    .insert([formData]);

                if (error) throw error;

                alert('Thank you for signing up! Your details have been saved.');
                signupForm.reset();
            } catch (error) {
                console.error('Form Error:', error);
                alert('There was an error saving your details. Please try again.');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});
