function replacePart(original, index, replacement) {
    return replacement.slice(0, index) + original.slice(index);
}

function animate(element, text, time) {
    if (typeof text === "undefined")
        text = "Try again later.";
    let progress = 0;
    let orig = element.innerText;
    let max = Math.max(orig.length, text.length);
    let handle = setInterval(() => {
        if (progress > max) {
            clearInterval(handle);
            element.innerText += " ";
            element.innerText.length = text.length;
        } else
            element.innerText = replacePart(orig, progress++, text);
    }, time);
}