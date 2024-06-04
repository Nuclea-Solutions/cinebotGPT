const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucketName = 'cinebot-gpt-bucket';
const fileName = 'showtime.json';

exports.filterShowtimes = async (req, res) => {
  const cinemaName = req.query.cinemaName;
  const movieName = req.query.movieName;

  if (!cinemaName || !movieName) {
    res.status(400).send("Missing required query parameters: cinemaName and movieName");
    return;
  }

  try {
    // Read the file from Google Cloud Storage
    const file = storage.bucket(bucketName).file(fileName);
    const [contents] = await file.download();

    // Parse the JSON file
    const showtimeData = JSON.parse(contents);

    // Find the selected cinema
    const selectedCinema = showtimeData.cinemas.find(c => c.name === cinemaName);
    if (!selectedCinema) {
      res.status(404).send("Selected cinema not found.");
      return;
    }

    // Find the selected movie
    const selectedMovie = selectedCinema.movies.find(movie => movie.name === movieName);
    if (!selectedMovie) {
      res.status(404).send("Selected movie not found in the selected cinema.");
      return;
    }

    // Send the showtimes as a response
    res.status(200).json(selectedMovie.versions.map(version => version.sessions).flat());
  } catch (error) {
    console.error("Error reading showtime file:", error);
    res.status(500).send("Error reading showtime file.");
  }
};
