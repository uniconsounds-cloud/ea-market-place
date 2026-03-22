const Jimp = require('jimp');

async function removeBg() {
    const image = await Jimp.read('/Users/suphakorn/.gemini/antigravity/brain/46b8be3e-10eb-4ec6-9960-4829a12f3fc2/media__1773097059642.jpg');
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    const visited = new Set();
    const queue = [];

    // Seed the edges
    for (let x = 0; x < width; x++) {
        queue.push([x, 0], [x, height - 1]);
    }
    for (let y = 0; y < height; y++) {
        queue.push([0, y], [width - 1, y]);
    }

    const tolerance = 40;
    function isBlack(color) {
        const rgba = Jimp.intToRGBA(color);
        return rgba.r < tolerance && rgba.g < tolerance && rgba.b < tolerance;
    }

    const toClear = [];

    while (queue.length > 0) {
        const [x, y] = queue.shift();
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const color = image.getPixelColor(x, y);
        if (isBlack(color)) {
            toClear.push([x, y]);
            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }

    // Remove background
    for (const [x, y] of toClear) {
        image.setPixelColor(0x00000000, x, y);
    }

    await image.writeAsync('/Users/suphakorn/EA Market Place/ea-market-place/public/farm/base_tree_new.png');
    console.log('Saved new base tree transparent PNG.');
}

removeBg().catch(console.error);
