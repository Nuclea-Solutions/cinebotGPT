//selectMovie.js

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Select an option:');
console.log('1. Select a specific movie');
console.log('2. Recommend a movie');

rl.question('Enter your choice (1 or 2): ', (choice) => {
  switch(choice) {
    case '1':
      const readLatestMovieFile = () => {
        const directoryPath = path.join(__dirname, 'queries'); // Adjust the path as needed
        fs.readdir(directoryPath, (err, files) => {
          if (err) {
            console.log('Unable to scan directory: ' + err);
            rl.close();
            return;
          }

          const movieFiles = files.filter(file => file.startsWith('movies_') && file.endsWith('.json'))
            .sort((a, b) => fs.statSync(path.join(directoryPath, b)).mtime.getTime() - fs.statSync(path.join(directoryPath, a)).mtime.getTime());

          if (movieFiles.length === 0) {
            console.log('No movie files found.');
            rl.close();
            return;
          }

          fs.readFile(path.join(directoryPath, movieFiles[0]), 'utf8', (err, data) => {
            if (err) {
              console.log('Error reading file: ' + err);
              rl.close();
              return;
            }

            const movies = JSON.parse(data);
            const movieList = movies.map((movie, index) => `${index + 1}: ${movie.name}`);
            console.log('Select a movie by entering its number:');
            movieList.forEach(movie => console.log(movie));

            rl.question('Enter the movie number: ', (number) => {
              const index = parseInt(number, 10) - 1;
              if (index >= 0 && index < movies.length) {
                console.log(`You selected: ${movies[index].name}`);
                rl.close();
              } else {
                console.log('Invalid movie number. Please run the script again and select a valid number.');
                rl.close();
              }
            });
          });
        });
      };

      readLatestMovieFile();
      break;

    case '2':
      console.log('You chose to recommend a movie. Here\'s a recommendation for you: The Shawshank Redemption.');
      rl.close();
      break;

    default:
      console.log('Invalid choice. Please run the script again and select either 1 or 2.');
      rl.close();
  }
});
