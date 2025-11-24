// Feuille Javascript

$( document ).ready(function() {
    $('footer').append('<span>This website uses cookies only to store your favorite theme.</span><a style="float:right;" id="toggleCSS" data-theme="dark">Theme dark</a>');

    if(document.cookie != ""){

        var color = document.cookie.split('=')[1];

        if(color == 'dark') {
            toggleStyleSheet('customLight','customDark', 'light', 'Theme Light', $('#toggleCSS'));
        } else {
            toggleStyleSheet('customDark','customLight', 'dark', 'Theme Dark', $('#toggleCSS'));

        }
    }

    $('#toggleCSS').click(function(){

        if($(this).attr('data-theme') == 'dark') {
            toggleStyleSheet('customLight','customDark', 'light', 'Theme Light', this);
            document.cookie = "style=dark; path=/; expires=Thu, 18 Dec 2099 12:00:00 UTC; secure";
        } else {
            toggleStyleSheet('customDark','customLight', 'dark', 'Theme Dark', this);
            document.cookie = "style=light; path=/; expires=Thu, 18 Dec 2099 12:00:00 UTC; secure";
        }  
    });


    function toggleStyleSheet(oldCSS, newCSS, thema, text, footer){
        $('link').each(function(index, element){
            if($(element).attr('href').indexOf('custom') != -1){
                $(this).attr('href', $(this).attr('href').replace(oldCSS, newCSS));
            }
        });
        $(footer).attr('data-theme', thema);
        $(footer).text(text);
    }

});
