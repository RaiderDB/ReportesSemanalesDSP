/**
 * Sidebar JavaScript - Manejo de interacciones
 */

document.addEventListener('DOMContentLoaded', function () {
    const navbar = document.querySelector('.navbar');
    const navbarToggle = document.getElementById('navbarToggle');
    const navbarMenu = document.getElementById('navbarMenu');
    const sidebarCollapseToggle = document.getElementById('sidebarCollapseToggle');
    const dropdowns = document.querySelectorAll('.navbar-dropdown');

    // Crear overlay para móvil
    const overlay = document.createElement('div');
    overlay.className = 'navbar-overlay';
    document.body.appendChild(overlay);

    // Colapsar sidebar automáticamente al cargar página (siempre colapsado por defecto)
    // Solo mantener expandido si el usuario lo dejó expandido explícitamente
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    const wasExplicitlyExpanded = localStorage.getItem('sidebarExplicitlyExpanded') === 'true';
    
    // Si no fue explícitamente expandido, colapsar siempre
    if (!wasExplicitlyExpanded) {
        navbar.classList.add('collapsed');
        localStorage.setItem('sidebarCollapsed', 'true');
    } else if (isCollapsed && window.innerWidth > 768) {
        navbar.classList.add('collapsed');
    }

    // Toggle sidebar collapse (Desktop)
    if (sidebarCollapseToggle) {
        sidebarCollapseToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            navbar.classList.toggle('collapsed');

            // Save state to localStorage
            const collapsed = navbar.classList.contains('collapsed');
            localStorage.setItem('sidebarCollapsed', collapsed);
            // Marcar que fue expandido explícitamente por el usuario
            if (!collapsed) {
                localStorage.setItem('sidebarExplicitlyExpanded', 'true');
            } else {
                localStorage.setItem('sidebarExplicitlyExpanded', 'false');
            }

            // Close all dropdowns when collapsing
            if (collapsed) {
                dropdowns.forEach(dropdown => {
                    dropdown.classList.remove('active');
                });
            }
        });
    }

    // Toggle mobile sidebar
    if (navbarToggle) {
        navbarToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            navbarToggle.classList.toggle('active');
            navbar.classList.toggle('active');
            overlay.classList.toggle('active');
            document.body.style.overflow = navbar.classList.contains('active') ? 'hidden' : '';
        });
    }

    // Close sidebar when clicking overlay
    overlay.addEventListener('click', function () {
        navbarToggle.classList.remove('active');
        navbar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';

        // Close all dropdowns
        dropdowns.forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    });

    // Handle dropdowns - Always use click for sidebar
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.dropdown-toggle');

        if (toggle) {
            toggle.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                // Close other dropdowns
                dropdowns.forEach(otherDropdown => {
                    if (otherDropdown !== dropdown) {
                        otherDropdown.classList.remove('active');
                    }
                });

                // Toggle current dropdown
                dropdown.classList.toggle('active');
            });
        }
    });

    // Colapsar sidebar cuando se hace clic en cualquier enlace (móvil y desktop)
    const navLinks = navbarMenu.querySelectorAll('a:not(.dropdown-toggle)');
    navLinks.forEach(link => {
        link.addEventListener('click', function () {
            // En móvil: cerrar menú completo
            if (window.innerWidth <= 768) {
                navbarToggle.classList.remove('active');
                navbar.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
            
            // En desktop: colapsar sidebar automáticamente
            if (window.innerWidth > 768) {
                navbar.classList.add('collapsed');
                localStorage.setItem('sidebarCollapsed', 'true');
                localStorage.setItem('sidebarExplicitlyExpanded', 'false');
                
                // Cerrar todos los dropdowns
                dropdowns.forEach(dropdown => {
                    dropdown.classList.remove('active');
                });
            }
        });
    });
    
    // También colapsar cuando se hace clic en enlaces dentro de dropdowns
    const dropdownLinks = document.querySelectorAll('.navbar-dropdown-menu a');
    dropdownLinks.forEach(link => {
        link.addEventListener('click', function () {
            // En móvil: cerrar menú completo
            if (window.innerWidth <= 768) {
                navbarToggle.classList.remove('active');
                navbar.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
            
            // En desktop: colapsar sidebar automáticamente
            if (window.innerWidth > 768) {
                navbar.classList.add('collapsed');
                localStorage.setItem('sidebarCollapsed', 'true');
                localStorage.setItem('sidebarExplicitlyExpanded', 'false');
                
                // Cerrar todos los dropdowns
                dropdowns.forEach(dropdown => {
                    dropdown.classList.remove('active');
                });
            }
        });
    });

    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (window.innerWidth > 768) {
                navbarToggle.classList.remove('active');
                navbar.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        }, 250);
    });

    // Prevent dropdown links from closing menu immediately on mobile
    const dropdownMenus = document.querySelectorAll('.navbar-dropdown-menu');
    dropdownMenus.forEach(menu => {
        menu.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.navbar-dropdown')) {
            dropdowns.forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });

    // Active page highlighting
    const currentPath = window.location.pathname;
    const allLinks = document.querySelectorAll('.navbar-link, .navbar-dropdown-menu a');

    allLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href !== '#' && href !== '/' && currentPath.includes(href)) {
            link.style.background = 'rgba(255, 255, 255, 0.2)';
            link.style.borderColor = 'rgba(255, 255, 255, 0.4)';
        }
    });
});
