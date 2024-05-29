const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucketName = 'cinebot-gpt-bucket';
const fileName = 'showtime.json';

exports.fetchCinemas = async (req, res) => {
  try {
    // Read the file from Google Cloud Storage
    const file = storage.bucket(bucketName).file(fileName);
    const [contents] = await file.download();

    // Parse the JSON file
    const data = JSON.parse(contents);

    // Extract name, value (id), and coordinates (lat, lng) from each cinema
    const cinemas = data.cinemas.map(cinema => ({
      name: cinema.name,
      value: cinema.id,
      coordinates: {
        lat: cinema.lat,
        lng: cinema.lng
      }
    }));

    // Send the list of cinemas as a response
    res.status(200).json(cinemas);
  } catch (error) {
    console.error('Error reading cinemas file:', error);
    res.status(500).send('Error reading cinemas file.');
  }
};
