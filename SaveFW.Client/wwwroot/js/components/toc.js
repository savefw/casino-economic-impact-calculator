window.TOC = (function() {
    function init() {
        const sections = document.querySelectorAll('section[id]');
        const tocLinks = document.querySelectorAll('.toc-link');

        const observerOptions = {
            root: null,
            rootMargin: '-45% 0px -45% 0px', 
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Remove active class from all
                    tocLinks.forEach(link => {
                        link.classList.remove('active', 'opacity-100');
                        link.classList.add('opacity-60');
                    });

                    // Add active class to current
                    const activeLink = document.querySelector(`.toc-link[data-target="${entry.target.id}"]`);
                    if (activeLink) {
                        activeLink.classList.add('active', 'opacity-100');
                        activeLink.classList.remove('opacity-60');
                    }
                }
            });
        }, observerOptions);

        sections.forEach(section => {
            observer.observe(section);
        });
    }

    return { init: init };
})();
