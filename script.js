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
                // Only inject if bodyText is present and the element isn't an IMG/VIDEO (which we already handled)
                if (bodyText && el.tagName !== 'IMG' && el.tagName !== 'VIDEO') {
                    el.innerHTML = bodyText;
                }

                if (title) {
                    // Look for title element (usually a peer or nearby element with data-cms-title)
                    const titleEl = el.closest('[data-cms-key]')?.parentElement?.querySelector(`[data-cms-title="${key}"]`)
                        || document.querySelector(`[data-cms-title="${key}"]`);

                    if (titleEl) {
                        titleEl.innerHTML = title;
                    } else if (!bodyText && (el.tagName.startsWith('H') || el.tagName === 'P' || el.tagName === 'SPAN')) {
                        // Fallback: if no dedicated title element exists AND no body text was provided, 
                        // and this is a text element, treat the 'title' field as the main text content.
                        el.innerHTML = title;
                    }
                }
            });

            // ── Dynamic Partners Grid ──
            const partnersGrid = document.getElementById('partners-grid');
            if (partnersGrid && data.length > 0) {
                // Filter for partner keys (excluding header/list text)
                const partnerItems = data.filter(item =>
                    item.section_key &&
                    item.section_key.startsWith('partner_') &&
                    !item.section_key.startsWith('partners_header') &&
                    !item.section_key.startsWith('partners_list')
                );

                // Only override the static HTML if every partner item has a proper title.
                // This prevents half-populated DB rows from wiping out the static fallback.
                const fullyPopulated = partnerItems.every(item => item.title && item.title.trim() !== '' && item.title !== item.section_key);

                if (partnerItems.length > 0 && fullyPopulated) {
                    // Sort items if needed, or just use as is
                    const becomePartnerCard = `
                        <div class="fade-in visible"
                            style="background: white; padding: 2rem; border-radius: var(--border-radius); box-shadow: var(--shadow); text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: space-between; border: 2px dashed var(--accent-teal);">
                            <div>
                                <i class="fas fa-hands-helping" style="font-size: 3rem; color: var(--accent-teal); margin-bottom: 1rem;"></i>
                                <h3 style="margin-bottom: 0.75rem;">Become a Partner</h3>
                                <p style="font-size: 0.9rem; color: #555; margin-bottom: 1.25rem; line-height: 1.6;">
                                    If you are interested in partnering with us, please contact us at:
                                </p>
                            </div>
                            <a href="mailto:contact@bawofoundation.org?subject=Interest%20in%20Becoming%20a%20Partner" class="btn btn-primary" style="font-size: 0.85rem; padding: 0.5rem 1.25rem; color: #000;">
                                <i class="fas fa-envelope" style="margin-right: 0.4rem;"></i>contact@bawofoundation.org
                            </a>
                        </div>
                    `;

                    partnersGrid.innerHTML = partnerItems.map(p => {
                        const hasImage = p.media_url && !p.media_url.match(/\.(mp4|webm|ogg)$/i);
                        return `
                            <div class="fade-in visible"
                                style="background: white; padding: 2rem; border-radius: var(--border-radius); box-shadow: var(--shadow); text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: space-between;">
                                <div>
                                    ${hasImage
                                ? `<img src="${p.media_url}" style="height: 60px; margin-bottom: 1.5rem; object-fit: contain; max-width: 100%;">`
                                : `<i class="fas fa-handshake" style="font-size: 3rem; color: var(--accent-teal); margin-bottom: 1rem;"></i>`}
                                    <h3 ${isAdmin ? `data-cms-title="${p.section_key}" style="cursor:pointer;" title="Click to edit"` : ''}>${p.title || p.section_key}</h3>
                                    <div style="font-size: 0.9rem; color: #555; margin-bottom: 1rem;" ${isAdmin ? `data-cms-key="${p.section_key}" style="cursor:pointer;" title="Click to edit"` : ''}>
                                        ${p.body_text || ''}
                                    </div>
                                </div>
                                ${isAdmin ? `<button onclick="window.location.href='dashboard.html?edit=${p.section_key}'" class="btn btn-secondary" style="font-size: 0.7rem; padding: 0.3rem 0.6rem; margin-top: 0.5rem; background: #f0f0f0; color: #666; border: 1px solid #ddd;">Edit Content</button>` : ''}
                            </div>
                        `;
                    }).join('') + becomePartnerCard;

                    // Re-attach admin click listeners if we just replaced the HTML
                    if (isAdmin) {
                        partnersGrid.querySelectorAll('[data-cms-key], [data-cms-title]').forEach(el => {
                            el.addEventListener('click', (e) => {
                                const key = el.getAttribute('data-cms-key') || el.getAttribute('data-cms-title');
                                window.location.href = `dashboard.html?edit=${key}`;
                            });
                        });
                    }
                }
            }

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
