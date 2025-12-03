$(document).ready(function () {

    /* ----------------------------------------------------------
       1) Initialisation DOM
    ---------------------------------------------------------- */

    $('footer').append(`
        <span>Ce site utilise un cookie uniquement pour mémoriser vos préférences de thème.</span>
        <a style="float:right; margin-left:10px;" id="toggleComfort">Confort désactivé</a>
        <a style="float:right;" id="toggleTheme" data-theme="dark">Thème sombre</a>
    `);

    /* ----------------------------------------------------------
       2) Lecture cookies
    ---------------------------------------------------------- */

    const cookies = Object.fromEntries(
        document.cookie.split('; ').map(v => v.split('='))
    );

    let theme   = cookies.theme   || 'light';      // light | dark
    let comfort = cookies.confort || 'standard';   // standard | confort

    applyCSS(theme, comfort);
    updateButtons(theme, comfort);

    /* ----------------------------------------------------------
       3) Bouton : toggle thème
    ---------------------------------------------------------- */

    $('#toggleTheme').on('click', function () {
        theme = (theme === 'light') ? 'dark' : 'light';
        savePref('theme', theme);
        applyCSS(theme, comfort);
        updateButtons(theme, comfort);
    });

    /* ----------------------------------------------------------
       4) Bouton : toggle confort
    ---------------------------------------------------------- */

    $('#toggleComfort').on('click', function () {
        comfort = (comfort === 'standard') ? 'confort' : 'standard';
        savePref('confort', comfort);
        applyCSS(theme, comfort);
        updateButtons(theme, comfort);
    });

    /* ----------------------------------------------------------
       5) Fonctions utilitaires
    ---------------------------------------------------------- */

    function savePref(name, value) {
        document.cookie = `${name}=${value}; path=/; expires=Thu, 18 Dec 2099 12:00:00 UTC; secure`;
    }

    function applyCSS(theme, comfort) {
        const base = 'custom';
        const file =
            comfort === 'confort'
                ? `${base}Confort${capitalize(theme)}.css`
                : `${base}${capitalize(theme)}.css`;

        $('link').each(function () {
            const href = $(this).attr('href');
            if (href && href.includes('custom')) {
                $(this).attr('href', href.replace(/custom.*\.css/, file));
            }
        });
    }

    function updateButtons(theme, comfort) {
        $('#toggleTheme').text(theme === 'light' ? 'Thème sombre' : 'Thème clair');
        $('#toggleComfort').text(comfort === 'standard' ? 'Activer confort' : 'Confort activé');
    }

    function capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
});
