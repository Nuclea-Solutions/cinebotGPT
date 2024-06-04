const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Initialize Firebase
const serviceAccount = require('./cinebot-7f35b-firebase-adminsdk-y21xb-fca4d93734.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const simplifyJson = data => {
  return data.cinemas.map(cinema => ({
    name: cinema.name,
    id: cinema.id,
    movies: cinema.movies.map(movie => ({
      title: movie.title,
      versions: movie.versions.map(version => ({
        type: version.type,
        sessions: version.sessions.map(session => ({
          datetime: session.datetime,
          showtime: session.showtime,
        }))
      }))
    }))
  }));
};

const writeJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('Simplified JSON file saved successfully.');
  } catch (error) {
    console.error('Error writing JSON file:', error);
  }
};

const main = async () => {
  rl.question('Please enter the document reference ID: ', async docRefId => {
    try {
      const doc = await db.collection('sessions').doc(docRefId).get();
      if (!doc.exists) {
        console.error('Document not found!');
        rl.close();
        return;
      }

      const data = doc.data();
      if (!data || !data.showtimes || !data.showtimes.cinemas) {
        console.error('No cinemas data found in the document.');
        rl.close();
        return;
      }

      const simplifiedData = simplifyJson(data.showtimes);

      const outputDir = path.join(__dirname, 'showtimes', 'simplify'); // Path to the output directory
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const outputFilePath = path.join(outputDir, 'simplified.json'); // Path to save the simplified JSON file

      writeJsonFile(outputFilePath, simplifiedData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      rl.close();
    }
  });
};

main();
