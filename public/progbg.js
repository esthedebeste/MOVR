function setWithExpiry() {
    const now = Date.now() + 180000; // 3 minutes
    localStorage.setItem("bgseed", now);
    return now;
}

function getBgSeed() {
    const item = localStorage.getItem("bgseed");
    if (isNaN(item) || Date.now() > parseInt(item))
        return setWithExpiry();
    return item;
}
const steps = Math.round(Math.log(Math.max(screen.width, screen.height)) / Math.log(4));
const seed = getBgSeed();
let prefix = "";
for (var i = 0; i <= steps; i++) {
    prefix += `<div class="progbg" style="background-image: url('https://picsum.photos/seed/${seed}/${Math.pow(4, i)}')">`;
}
document.body.innerHTML = prefix + document.body.innerHTML + "</div>".repeat(steps);