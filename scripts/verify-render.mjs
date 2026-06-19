import { chromium } from 'playwright-core';

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173/';
const executablePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

const browser = await chromium.launch({
  executablePath,
  headless: true
});

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.name === 'mobile' ? 2 : 1,
      isMobile: viewport.name === 'mobile'
    });

    await page.goto(appUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('#art-canvas');
    await page.waitForFunction(() => document.querySelectorAll('#algorithm-control option').length > 0);
    await page.waitForTimeout(800);

    const algorithmIds = await page.$$eval('#algorithm-control option', (options) =>
      options.map((option) => option.value)
    );

    for (const algorithmId of algorithmIds) {
      await page.selectOption('#algorithm-control', algorithmId);
      await page.waitForTimeout(650);

      const result = await page.evaluate(() => {
        const canvas = document.querySelector('#art-canvas');
        const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
        const width = canvas.width;
        const height = canvas.height;
        const sampleWidth = Math.min(96, width);
        const sampleHeight = Math.min(96, height);
        const pixels = new Uint8Array(sampleWidth * sampleHeight * 4);
        const sampleCenters = [
          [0.5, 0.5],
          [0.5, 0.28],
          [0.34, 0.64],
          [0.66, 0.64],
          [0.5, 0.78]
        ];

        let litPixels = 0;
        let totalLuma = 0;
        const colors = new Set();

        for (const [centerX, centerY] of sampleCenters) {
          const x = Math.floor(width * centerX - sampleWidth / 2);
          const y = Math.floor(height * centerY - sampleHeight / 2);
          const clampedX = Math.max(0, Math.min(width - sampleWidth, x));
          const clampedY = Math.max(0, Math.min(height - sampleHeight, y));

          gl.readPixels(
            clampedX,
            clampedY,
            sampleWidth,
            sampleHeight,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels
          );

          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const luma = r + g + b;
            totalLuma += luma;

            if (luma > 22) {
              litPixels += 1;
            }

            if (luma > 8) {
              colors.add(`${r >> 4}-${g >> 4}-${b >> 4}`);
            }
          }
        }

        return {
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          drawingWidth: width,
          drawingHeight: height,
          litPixels,
          averageLuma: totalLuma / (sampleWidth * sampleHeight * sampleCenters.length),
          colorBuckets: colors.size
        };
      });

      if (result.clientWidth < viewport.width * 0.95 || result.clientHeight < viewport.height * 0.95) {
        throw new Error(`${viewport.name}/${algorithmId}: canvas is not filling the viewport`);
      }

      if (result.litPixels < 120 || result.averageLuma < 8 || result.colorBuckets < 3) {
        throw new Error(`${viewport.name}/${algorithmId}: canvas looks blank or under-rendered`);
      }

      const screenshotPath = `/tmp/generative-three-art-${viewport.name}-${algorithmId}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });

      console.log(
        `${viewport.name}/${algorithmId}: ${result.drawingWidth}x${result.drawingHeight}, lit=${result.litPixels}, avg=${result.averageLuma.toFixed(
          1
        )}, colors=${result.colorBuckets}, screenshot=${screenshotPath}`
      );
    }

    await page.close();
  }
} finally {
  await browser.close();
}
