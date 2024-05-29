const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucketName = 'cinebot-gpt-bucket';
const fileName = 'movies.json';

exports.readMovies = async (req, res) => {
  try {
    // Read the file from Google Cloud Storage
    const file = storage.bucket(bucketName).file(fileName);
    const [contents] = await file.download();

    // Parse the JSON file
    const movies = JSON.parse(contents);

    // Extract name and id from each movie
    const movieList = movies.map(movie => ({
      id: movie.id,
      name: movie.name
    }));

    // Send the list of movies as a response
    res.status(200).json(movieList);
  } catch (error) {
    console.error('Error reading movies file:', error);
    res.status(500).send('Error reading movies file.');
  }
};
