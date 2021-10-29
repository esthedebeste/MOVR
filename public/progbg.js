function setWithExpiry() {
	const now = Date.now() + 3 /* minutes */ * 60 * 1000;
	localStorage.setItem("bgseed", now);
	return now;
}
function getBgSeed() {
	const item = localStorage.getItem("bgseed");
	if (item == null || isNaN(item) || Date.now() > parseInt(item))
		return setWithExpiry();
	return item;
}
const seed = getBgSeed();

const loadImage = src => {
	const img = new Image();
	img.src = src;
	return new Promise(resolve => (img.onload = resolve));
};

function reload() {
	// Set to highest possible resolution, if the highest is already cached then this will remove a bit of blank screen.
	document.body.style.backgroundImage = `url('https://picsum.photos/seed/${seed}/${innerWidth}/${innerHeight}')`;

	const steps = Math.log2(Math.max(innerWidth, innerHeight)) / 2;
	sizes = [];
	for (let i = 0; i < steps; i++)
		sizes.push(
			[innerWidth / Math.pow(4, i), innerHeight / Math.pow(4, i)].map(
				Math.round
			)
		);

	let max = 0;
	for (const [width, height] of sizes) {
		const size = width * height;
		const url = `https://picsum.photos/seed/${seed}/${width}/${height}`;
		loadImage(url).then(event => {
			if (size > max) {
				max = size;
				document.body.style.backgroundImage = `url('${url}')`;
			}
		});
	}
}
reload();

let debouncer;
addEventListener("resize", () => {
	clearTimeout(debouncer);
	debouncer = setTimeout(reload, 250);
});
