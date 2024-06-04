const admin = require('firebase-admin');
const functions = require('firebase-functions');
const moment = require('moment');

// Initialize Firebase
const serviceAccount = require('./cinebot-7f35b-firebase-adminsdk-y21xb-fca4d93734.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const openingHour = 9;

// Static date for reference
const staticDate = moment('2024-05-31T12:29:00');

const showtimeBelongsToPreviousDay = isoDate => {
  const hour = isoDate.match(/T([0-9]{2}):/)[1];
  return hour < openingHour;
};

const getPreviousDate = isoDate => {
  const d = moment(isoDate);
  d.subtract(1, 'day');
  return d.format('YYYY-MM-DD');
};

const filterAvailableVersions = versions => {
  const movieStarted = getMovieStartedTimeUnix();
  return versions.map(version => {
    version = Object.assign({}, version);
    version.sessions = version.sessions.filter(session => movieStarted <= session.date);
    return version;
  }).filter(version => version.sessions.length > 0);
};

const getMovieStartedTimeUnix = () => {
  const offsetMinutes = 20;
  return (staticDate.valueOf() / 1000) - offsetMinutes * 60;
};

const getFilteredVersions = (filters, versions) => {
  const showAll = filters.length === 0;
  return versions.filter(version => {
    if (showAll) return true;
    const is2d = version.type.filter(type => !type.match(/^lang_/)).length === 0;
    if (is2d) {
      version.type.push('2d');
    }
    const atLeastOneFilterMatched = (filters.filter(value => -1 !== version.type.indexOf(value))).length > 0;
    return atLeastOneFilterMatched;
  });
};

const getFilteredVersionsStrict = (filters, versions) => versions.filter(version => {
  const showAll = filters.length === 0;
  if (showAll) return true;
  const allFiltersMatched = (filters.filter(value => -1 !== version.type.indexOf(value))).length === filters.length;
  return allFiltersMatched;
});

const filterVersionsForDate = (versions, date) => {
  const tzOffset = extractTimeZoneFromIsoDate(versions[0].sessions[0].datetime);
  const openingUnix = new Date(date + 'T' + (openingHour < 10 ? '0' : '') + openingHour + ':00:00' + tzOffset).getTime() / 1000;
  const closingUnix = openingUnix + (24 * 60 * 60);
  const movieStarted = getMovieStartedTimeUnix();

  return versions.map(version => {
    version = Object.assign({}, version);
    version.sessions = version.sessions.filter(session => {
      if (!session.datetime) {
        console.warn('Skipping session with missing datetime:', session);
        return false;
      }
      const d = session.date;
      return movieStarted <= d && openingUnix <= d && d <= closingUnix;
    });
    return version;
  }).filter(version => version.sessions.length > 0);
};

const filterVersionsByHours = (versions, from, to) => {
  return versions.map(version => {
    version = Object.assign({}, version);
    version.sessions = version.sessions.filter(session => {
      if (!session.datetime) {
        console.warn('Skipping session with missing datetime:', session);
        return false;
      }
      const hour = parseSessionIsoDateForDisplay(session.datetime).hour();
      return (from <= hour && hour <= (to - 1))
          || (hour < openingHour && to >= 24);
    });
    return version;
  }).filter(version => version.sessions.length > 0);
};

const getAvailableFilters = versions => {
  if (versions.length < 2) { return []; }
  return versions
      .reduce((carry, version) => {
          let types = version.type;
          const nonLanguages = types.filter(t => !t.match(/^lang_/));
          if (!nonLanguages.length) {
            types.push('2d');
          }
          return carry.concat(types);
      }, [])
      .filter((v, i, a) => a.indexOf(v) === i);
};

const getMovieShowtimesDates = versions => {
  const dates = [];
  versions.forEach(version => {
    version.sessions.forEach(session => {
      if (!session.datetime) {
        console.warn('Skipping session with missing datetime:', session);
        return;
      }
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
  const versions = movies.reduce((carry, movie) => {
    return carry.concat(movie.versions);
  }, []);
  return getMovieShowtimesDates(versions);
};

const getDateFilterDisplayString = date => {
  const now = staticDate;
  const tomorrow = moment(staticDate).add(1, 'day');
  const d = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) ? moment(date, 'YYYY-MM-DD') : moment(date, 'X');
  if (now.startOf('day') <= d && d <= now.endOf('day')) {
    return 'Hoy';
  } else if (tomorrow.startOf('day') <= d && d <= tomorrow.endOf('day')) {
    return 'Mañana';
  } else {
    let s = d.format('ddd DD MMM');
    s = s.substr(0, 1).toUpperCase() + s.substr(1).replace(/^([A-Za-záéíóú]+)\./, '$1');
    return s;
  }
};

const extractTimeZoneFromIsoDate = isoDate => {
  const match = isoDate.match(/([+-]\d{2}:\d{2})$/);
  return match ? match[1] : '';
};

const parseSessionIsoDateForDisplay = isoDate => {
  return moment(isoDate);
};

exports.filterShowtime = functions.https.onRequest(async (req, res) => {
  try {
    const { docRefId, movieId, date, fromHour, toHour, filters } = req.query;
    const parsedFilters = filters ? filters.split(',') : [];
    
    if (!docRefId) {
      res.status(400).send('docRefId is required');
      return;
    }

    const doc = await db.collection('sessions').doc(docRefId).get();
    if (!doc.exists) {
      res.status(404).send('Document not found!');
      return;
    }

    const data = doc.data();
    if (!data || !data.showtimes || !data.showtimes.cinemas) {
      res.status(404).send('No cinemas data found in the document.');
      return;
    }

    let cinemas = data.showtimes.cinemas;

    if (movieId) {
      const movieIds = movieId.split(',').map(id => parseInt(id));
      cinemas = cinemas.filter(cinema => cinema.movies && cinema.movies.some(movie => movieIds.includes(movie.id)));
    }

    if (date) {
      cinemas.forEach(cinema => {
        cinema.movies.forEach(movie => {
          movie.versions = filterVersionsForDate(movie.versions, date);
        });
      });
    }

    if (fromHour && toHour) {
      cinemas.forEach(cinema => {
        cinema.movies.forEach(movie => {
          movie.versions = filterVersionsByHours(movie.versions, parseInt(fromHour), parseInt(toHour));
        });
      });
    }

    if (parsedFilters.length > 0) {
      cinemas.forEach(cinema => {
        cinema.movies.forEach(movie => {
          movie.versions = getFilteredVersions(parsedFilters, movie.versions);
        });
      });
    }

    cinemas = cinemas.filter(cinema => cinema.movies.some(movie => movie.versions.length > 0));

    const filteredCinemaList = cinemas.map(cinema => `${cinema.name}, ${cinema.id}`);
    res.json({ "filtered cinema list": filteredCinemaList });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});