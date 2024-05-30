#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase
const serviceAccount = require('./cinebot-7f35b-firebase-adminsdk-y21xb-fca4d93734.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  try {
    // Dynamically import inquirer
    const inquirer = await import('inquirer');

    // Step 1: Ask for doc ref id
    const { docRefId } = await inquirer.default.prompt({
      type: 'input',
      name: 'docRefId',
      message: 'Please enter the document reference ID:',
    });

    // Step 2: Ask for movie id (optional)
    const { movieId } = await inquirer.default.prompt({
      type: 'input',
      name: 'movieId',
      message: 'Please enter the movie ID (optional):',
      default: '',
    });

    // Fetch document from Firestore
    console.log(`Fetching document with ID: ${docRefId} from 'sessions' collection`);
    const doc = await db.collection('sessions').doc(docRefId).get();
    if (!doc.exists) {
      console.error('Document not found!');
      return;
    }

    console.log('Document located successfully.');
    const data = doc.data();
    
    if (!data || !data.showtimes || !data.showtimes.cinemas) {
      console.error('No cinemas data found in the document.');
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

    // Display cinemas
    if (cinemas.length > 0) {
      console.log('Available Cinemas:');
      cinemas.forEach((cinema, index) => {
        console.log(`${index + 1}. ${cinema.name} - ${cinema.info.address}`);
      });
    } else {
      console.log('No cinemas found for the given movie ID.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
