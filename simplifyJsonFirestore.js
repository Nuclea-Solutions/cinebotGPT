const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const moment = require('moment');

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

const openingHour = 9;

const showtimeBelongsToPreviousDay = isoDate => {
  const hour = moment(isoDate).hour();
  return hour < openingHour;
};

const getPreviousDate = isoDate => moment(isoDate).subtract(1, 'day').format('YYYY-MM-DD');

const filterAvailableVersions = versions => {
  const movieStarted = getMovieStartedTimeUnix();
  return versions.map(version => {
    version = { ...version };
    version.sessions = version.sessions.filter(session => session.datetime && movieStarted <= moment(session.datetime).unix());
    return version;
  }).filter(version => version.sessions.length > 0);
};

const getMovieStartedTimeUnix = () => {
  const now = new Date();
  const offsetMinutes = 20;
  return (now.getTime() / 1000) - offsetMinutes * 60;
};

const getFilteredVersions = (filters, versions) => {
  const showAll = filters.length === 0;
  return versions.filter(version => {
    if (showAll) return true;
    const is2d = version.type.every(type => type.match(/^lang_/));
    if (is2d) version.type.push('2d');
    return filters.some(filter => version.type.includes(filter));
  });
};

const getFilteredVersionsStrict = (filters, versions) => versions.filter(version => {
  const showAll = filters.length === 0;
  if (showAll) return true;
  return filters.every(filter => version.type.includes(filter));
});

const filterVersionsForDate = (versions, date) => {
  const tzOffset = extractTimeZoneFromIsoDate(versions[0].sessions[0].datetime);
  const openingUnix = moment.tz(date + 'T' + (openingHour < 10 ? '0' : '') + openingHour + ':00:00', tzOffset).unix();
  const closingUnix = openingUnix + (24 * 60 * 60);
  const movieStarted = getMovieStartedTimeUnix();

  return versions.map(version => {
    version = { ...version };
    version.sessions = version.sessions.filter(session => {
      const d = moment(session.datetime).unix();
      return d && movieStarted <= d && openingUnix <= d && d <= closingUnix;
    });
    return version;
  }).filter(version => version.sessions.length > 0);
};

const filterVersionsByHours = (versions, from, to) => {
  return versions.map(version => {
    version = { ...version };
    version.sessions = version.sessions.filter(session => {
      const hour = parseSessionIsoDateForDisplay(session.datetime).hour();
      return (from <= hour && hour <= (to - 1)) || (hour < openingHour && to >= 24);
    });
    return version;
  }).filter(version => version.sessions.length > 0);
};

const getAvailableFilters = versions => {
  if (versions.length < 2) { return []; }
  return versions.reduce((carry, version) => {
    let types = version.type;
    const nonLanguages = types.filter(t => !t.match(/^lang_/));
    if (!nonLanguages.length) types.push('2d');
    return carry.concat(types);
  }, []).filter((v, i, a) => a.indexOf(v) === i);
};

const getMovieShowtimesDates = versions => {
  const dates = [];
  versions.forEach(version => {
    version.sessions.forEach(session => {
      if (!showtimeBelongsToPreviousDay(session.datetime)) {
        dates.push(session.datetime.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})T/)[1]);
      } else {
        dates.push(getPreviousDate(session.datetime));
      }
    });
  });
  return dates.filter((v, i, a) => a.indexOf(v) === i).sort();
};

const getBillboardShowtimesDates = movies => {
  const versions = movies.reduce((carry, movie) => carry.concat(movie.versions), []);
  return getMovieShowtimesDates(versions);
};

const getDateFilterDisplayString = date => {
  const now = moment();
  const tomorrow = moment().add(1, 'day');
  const d = moment(date, 'YYYY-MM-DD', true).isValid() ? moment(date, 'YYYY-MM-DD') : moment(date, 'X');
  if (now.isSame(d, 'day')) {
    return 'Hoy';
  } else if (tomorrow.isSame(d, 'day')) {
    return 'Mañana';
  } else {
    return d.format('ddd DD MMM').replace(/^([A-Za-záéíóú]+)\./, (match, p1) => p1.charAt(0).toUpperCase() + p1.slice(1));
  }
};

const simplifyJson = data => {
  return data.cinemas.map(cinema => ({
    name: cinema.name,
    id: cinema.id,
    info: [{
      address: cinema.info.address
    }],
    lat: cinema.info.lat,
    lng: cinema.info.lng,
    movies: cinema.movies.map(movie => ({
      name: movie.name,
      id: movie.id,
      versions: movie.versions.map(version => ({
        type: version.type,
        sessions: version.sessions.map(session => ({
          datetime: session.datetime,
          showtime: session.showtime,
          movie_id: session.movie_id,
          cinema_id: session.cinema_id,
          availability: session.availability,
          id: session.id,
          url: session.url,
        }))
      })).filter(version => version.sessions.length > 0) // Ensure versions with no sessions are filtered out
    })).filter(movie => movie.versions.length > 0) // Ensure movies with no versions are filtered out
  })).filter(cinema => cinema.movies.length > 0); // Ensure cinemas with no movies are filtered out
};

const filterMoviesInCinemas = (data, cinemaIds, movieIds) => {
  const cinemaIdSet = new Set(cinemaIds);
  const movieIdSet = new Set(movieIds);

  return {
    cinemas: data.cinemas.filter(cinema => cinemaIds.length === 0 || cinemaIdSet.has(cinema.id)).map(cinema => ({
      name: cinema.name,
      id: cinema.id,
      info: [{
        address: cinema.info.address
      }],
      lat: cinema.lat,
      lng: cinema.lng,
      movies: cinema.movies.filter(movie => movieIds.length === 0 || movieIdSet.has(movie.id)).map(movie => ({
        name: movie.name,
        id: movie.id,
        versions: movie.versions.map(version => ({
          type: version.type,
          sessions: version.sessions.map(session => ({
            datetime: session.datetime,
            showtime: session.showtime,
            movie_id: session.movie_id,
            cinema_id: session.cinema_id,
            availability: session.availability,
            id: session.id,
            url: session.url,
          }))
        })).filter(version => version.sessions.length > 0) // Ensure versions with no sessions are filtered out
      })).filter(movie => movie.versions.length > 0) // Ensure movies with no versions are filtered out
    })).filter(cinema => cinema.movies.length > 0) // Ensure cinemas with no movies are filtered out
  };
};

const writeJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('Simplified JSON file saved successfully.');
  } catch (error) {
    console.error('Error writing JSON file:', error);
  }
};

const parseSessionIsoDateForDisplay = isoDate => {
  const date = moment(isoDate);
  const offset = extractTimeZoneFromIsoDate(isoDate);
  date.zone(offset);
  return date;
};

const extractTimeZoneFromIsoDate = isoDate => isoDate.match(/(-|\+)([0-9]{2}):([0-9]{2})$/)[0];

const main = async () => {
  rl.question('Please enter the document reference ID: ', async docRefId => {
    rl.question('Please enter the cinema IDs (comma-separated, leave blank for all): ', async cinemaIdsStr => {
      rl.question('Please enter the movie IDs (comma-separated, leave blank for all): ', async movieIdsStr => {
        try {
          const cinemaIds = cinemaIdsStr ? cinemaIdsStr.split(',').map(id => parseInt(id.trim(), 10)) : [];
          const movieIds = movieIdsStr ? movieIdsStr.split(',').map(id => parseInt(id.trim(), 10)) : [];
          
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

          const simplifiedData = filterMoviesInCinemas(data.showtimes, cinemaIds, movieIds);

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
    });
  });
};

main();
