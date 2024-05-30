const admin = require('firebase-admin');
const functions = require('firebase-functions');

// Initialize Firebase
const serviceAccount = require('./cinebot-7f35b-firebase-adminsdk-y21xb-fca4d93734.json');

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

exports.getFilteredCinemas = functions.https.onRequest(async (req, res) => {
	try {
		const docRefId = req.query.docRefId;
		const movieId = req.query.movieId || '';

		if (!docRefId) {
			res.status(400).send('docRefId is required');
			return;
		}

		// Fetch document from Firestore
		console.log(`Fetching document with ID: ${docRefId} from 'sessions' collection`);
		const doc = await db.collection('sessions').doc(docRefId).get();
		if (!doc.exists) {
			console.error('Document not found!');
			res.status(404).send('Document not found!');
			return;
		}

		console.log('Document located successfully.');
		const data = doc.data();

		if (!data || !data.showtimes || !data.showtimes.cinemas) {
			console.error('No cinemas data found in the document.');
			res.status(404).send('No cinemas data found in the document.');
			return;
		}

		let cinemas = data.showtimes.cinemas;

		// Extract and log the list of cinema names and IDs
		const cinemaList = cinemas.map(cinema => `${cinema.name}, ${cinema.id}`);
		console.log('Cinema list:', cinemaList);

		// Create and print a list of movies (name and id) for each cinema
		cinemas.forEach((cinema, index) => {
			console.log(`Cinema ${index + 1}: ${cinema.name}`);
			if (cinema.movies && cinema.movies.length > 0) {
				cinema.movies.forEach(movie => {
					console.log(`  - Movie ID: ${movie.id}, Name: ${movie.name}`);
				});
			} else {
				console.log('  No movies found for this cinema.');
			}
		});

		// Filter cinemas based on movie ID if provided
		if (movieId) {
			cinemas = cinemas.filter((cinema) => {
				if (!cinema.movies) {
					return false;
				}
				return cinema.movies.some((movie) => movie.id === parseInt(movieId));
			});
		}

		// Extract and log the list of cinema names and IDs after filtering
		const filteredCinemaList = cinemas.map(cinema => `${cinema.name}, ${cinema.id}`);
		console.log('Filtered cinema list:', filteredCinemaList);

		let response = { "filtered cinema list": filteredCinemaList }

		res.json(response);
	} catch (error) {
		console.error('Error:', error);
		res.status(500).send('Internal Server Error');
	}
});
