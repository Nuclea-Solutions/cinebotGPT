// cinemaSelection.js

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const queriesDirPath = path.join(__dirname, 'queries');

const readLatestShowtimeFile = () => {
  fs.readdir(queriesDirPath, (err, files) => {
    if (err) {
      console.error('Unable to read queries directory:', err);
      return rl.close();
    }

    const showtimeFiles = files.filter(file => file.startsWith('showtime_') && file.endsWith('.json'));
    if (showtimeFiles.length === 0) {
      console.error('No showtime files found.');
      return rl.close();
    }

    // Sort files by modification time to find the latest
    showtimeFiles.sort((a, b) => {
      const fullPathA = path.join(queriesDirPath, a);
      const fullPathB = path.join(queriesDirPath, b);
      return fs.statSync(fullPathB).mtime - fs.statSync(fullPathA).mtime;
    });

    const latestShowtimeFile = showtimeFiles[0];
    const latestShowtimeFilePath = path.join(queriesDirPath, latestShowtimeFile);

    fs.readFile(latestShowtimeFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error(`Unable to read file ${latestShowtimeFile}:`, err);
        return rl.close();
      }

      const showtimeData = JSON.parse(data);
      listCinemas(showtimeData.cinemas);
    });
  });
};

const listCinemas = (cinemas) => {
  console.log('Available Cinemas:');
  cinemas.forEach((cinema, index) => {
    console.log(`${index + 1}: ${cinema.name}`);
  });

  rl.question('Select a cinema by number: ', (number) => {
    const index = parseInt(number, 10) - 1;
    if (index >= 0 && index < cinemas.length) {
      console.log(`You selected: ${cinemas[index].name}`);
      proceedAfterCinemaSelection(cinemas[index]); // Call to function that continues the flow
    } else {
      console.error('Invalid cinema number.');
      rl.close(); // Close the readline interface in case of invalid input
    }
  });
};

const proceedAfterCinemaSelection = (selectedCinema) => {
  // Code to continue after cinema selection goes here
  console.log(`Continuing with cinema: ${selectedCinema.name}`);
  // Example: fetchShowtimesForCinema(selectedCinema.id);

  // Remember to close the readline interface when the entire process is complete
  rl.close();
};

readLatestShowtimeFile();
