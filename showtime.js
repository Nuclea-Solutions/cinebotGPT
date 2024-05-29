const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cinebot-7f35b-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

async function scrapeCinepolis(zoneValue) {
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

    const scrapedData = {
        movies: null,
        showtimes: null
    };

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
                if (url.includes('/movies/?')) {
                    scrapedData.showtimes = data;
                } else {
                    scrapedData.movies = data;
                }

                // Check if both data have been fetched and save to Firestore
                if (scrapedData.movies && scrapedData.showtimes) {
                    await saveToFirestore(scrapedData);
                }
            } catch (error) {
                console.error(`Error saving response from ${url}:`, error);
            }
        }
    });

    await page.goto(`https://cinemex.com/cartelera/${zoneValue}/guadalajara`, { waitUntil: 'networkidle2' });

    console.log('Page has been loaded. Responses from specified fetch requests will be saved.');
}

async function saveToFirestore(data) {
    try {
        const docRef = await db.collection('sessions').add(data);
        console.log(`Document successfully written with ID: ${docRef.id}`);
    } catch (error) {
        console.error('Error writing document to Firestore: ', error);
    }
}

const zoneValue = 'zona-35';

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
