document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
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

    // Active Link Highlighting
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const links = document.querySelectorAll('.nav-links a');

    links.forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });

    // Scroll Animations
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

    // Supabase Configuration
    const supabaseUrl = 'https://tijsephkovqailbrwuzt.supabase.co';
    const supabaseKey = 'sb_publishable_9RhuiNWEUwWLbg3phWHYoA_F3RilB8k';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // CMS Content Loading
    async function loadCMSContent() {
        const cmsElements = document.querySelectorAll('[data-cms-key]');
        if (cmsElements.length === 0) return;

        try {
            const { data, error } = await supabase
                .from('site_content')
                .select('*');

            if (error) throw error;

            const contentMap = {};
            data.forEach(item => {
                contentMap[item.key] = item;
            });

            cmsElements.forEach(el => {
                const key = el.getAttribute('data-cms-key');
                const content = contentMap[key];

                if (content) {
                    el.innerHTML = content.value;
                }
            });
        } catch (error) {
            console.error('CMS Error:', error);
        }
    }

    loadCMSContent();

    // Form Submission
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                message: document.getElementById('message').value
            };

            try {
                const { data, error } = await supabase
                    .from('signups')
                    .insert([formData]);

                if (error) throw error;

                alert('Thank you for signing up! Your details have been saved.');
                signupForm.reset();
            } catch (error) {
                console.error('Error:', error);
                alert('There was an error saving your details. Please try again.');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});
