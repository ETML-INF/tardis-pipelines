document.addEventListener('DOMContentLoaded', function () {
    var h1 = document.querySelector('h1');
    if (h1) {
        // Retire le ¶ ajouté par Sphinx comme ancre de lien
        document.title = h1.textContent.replace(/¶/g, '').trim();
    }
});
