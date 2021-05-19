function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

let steps = Math.round(Math.log(Math.max(screen.width, screen.height)) / Math.log(4));
let seed;
if (getCookie("bgseed") == "") {
    seed = Math.random();
    setCookie("bgseed", seed, 3 / 24 / 60);
} else
    seed = getCookie("bgseed");

let prefix = "";
for (var i = 0; i <= steps; i++) {
    prefix += `<div class="progbg" style="background-image: url('https://picsum.photos/seed/${seed}/${Math.pow(4,i)}')">`;
}
document.body.innerHTML = prefix + document.body.innerHTML + "</div>".repeat(steps);