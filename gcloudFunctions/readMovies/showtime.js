//showtime.js

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../../.env' });

async function scrapeCinepolis(zoneValue) {
    // Preprocess and reformat zoneValue
    let value = zoneValue;
    if (zoneValue.includes('zona-')) {
        value = `area/${zoneValue.replace('zona-', '')}`;
    } else if (zoneValue.includes('estado-')) {
        value = `state/${zoneValue.replace('estado-', '')}`;
    }

    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: false,
        slowMo: 250
    });
    const page = await browser.newPage();

    await page.setRequestInterception(true);

    page.on('request', request => {
        if (request.resourceType() === 'fetch') {
            console.log('Fetch Request:', request.url());
        }
        request.continue();
    });

    page.on('response', async response => {
        const url = response.url();
        const status = response.status();
        const contentType = response.headers()['content-type'];

        const targetUrls = [
            `https://api.cinemex.com/rest/v2.25/cinemas/${value}/movies/?include_dates=1&initial=1`,
            "https://api.cinemex.com/rest/v2.25/movies/"
        ];

        if (targetUrls.includes(url) && status === 200 && contentType && contentType.includes('application/json')) {
            try {
                const data = await response.json();
                // Use a timestamp to create a unique filename
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filenamePrefix = url.includes('/movies/?') ? 'showtime' : 'movies';
                const filename = `${filenamePrefix}_${timestamp}.json`;
                const filePath = path.join(__dirname, 'queries', filename);

                // Ensure the directory exists
                fs.mkdirSync(path.dirname(filePath), { recursive: true });

                fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
                    if (err) console.error('Error writing file:', err);
                    else console.log(`Saved response to ${filePath}`);
                });
            } catch (error) {
                console.error(`Error saving response from ${url}:`, error);
            }
        }
    });

    // Adjust the URL for page.goto according to the processed value
    await page.goto(`https://cinemex.com/cartelera/${zoneValue}/guadalajara`, { waitUntil: 'networkidle2' });

    console.log('Page has been loaded. Responses from specified fetch requests will be saved.');
}

const zoneValue = process.argv[2];

if (zoneValue) {
    scrapeCinepolis(zoneValue).then(() => {
        console.log('Scraping completed.');
        process.exit(0); // Exit the process successfully
    }).catch((error) => {
        console.error('Scraping error:', error);
        process.exit(1); // Exit with an error code
    });
} else {
    console.error('Zone value not provided.');
    process.exit(1); // Exit with an error code
}
