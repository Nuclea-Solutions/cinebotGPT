import moment from 'moment';
import {parseSessionIsoDateForDisplay,extractTimeZoneFromIsoDate} from './dates';

const openingHour = 9;

const showtimeBelongsToPreviousDay = isoDate => {
  const hour = isoDate.match(/T([0-9]{2}):/)[1];

  return hour < openingHour;
};

const getPreviousDate = isoDate => {
  const d = moment(isoDate);
  d.subtract(1, 'day');

  return d.format('YYYY-MM-DD');
};

export const filterAvailableVersions = versions => {
  const movieStarted = getMovieStartedTimeUnix();

  return versions.map(version => {
    version = Object.assign({}, version);
    version.sessions = version.sessions.filter(session => movieStarted <= session.date);

    return version;
  }).filter(version => version.sessions.length > 0);
};

export const getMovieStartedTimeUnix = () => {
  const now = new Date();
  const offsetMinutes = 20;

  return (now.getTime() / 1000) - offsetMinutes * 60;
};

export const getFilteredVersions = (filters, versions) => {
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

export const getFilteredVersionsStrict = (filters, versions) => versions.filter(version => {
  const showAll = filters.length === 0;
  if (showAll) return true;

  const allFiltersMatched = (filters.filter(value => -1 !== version.type.indexOf(value))).length === filters.length;
  return allFiltersMatched;
});

export const filterVersionsForDate = (versions, date) => {
  const tzOffset = extractTimeZoneFromIsoDate(versions[0].sessions[0].datetime);
  const openingUnix = new Date(date + 'T' + (openingHour < 10 ? '0' : '') + openingHour + ':00:00' + tzOffset).getTime() / 1000;
  const closingUnix = openingUnix + (24 * 60 * 60);
  const movieStarted = getMovieStartedTimeUnix();

  versions = versions.map(version => {
    version = Object.assign({}, version);
    version.sessions = version.sessions.filter(session => {
      const d = session.date;
      return movieStarted <= d && openingUnix <= d && d <= closingUnix;
    });

    return version;
  });

  return versions.filter(version => version.sessions.length > 0);
};

export const filterVersionsByHours = (versions, from, to) => {
  versions = versions.map(version => {
    version = Object.assign({}, version);
    version.sessions = version.sessions.filter(session => {
      const hour = parseSessionIsoDateForDisplay(session.datetime).hour();
      return (from <= hour && hour <= (to - 1))
          || (hour < openingHour && to >= 24);
    });

    return version;
  });

  return versions.filter(version => version.sessions.length > 0);
};

export const getAvailableFilters = versions => {
  if (versions.length < 2) { return []; }

  return versions
      .reduce((carry,version) => {
          let types = version.type;
          const nonLanguages = types.filter(t => !t.match(/^lang_/));
          if (!nonLanguages.length) {
            types.push('2d');
          }
          return carry.concat(types);
      },[])
      .filter((v, i, a) => a.indexOf(v) === i);
};

export const getMovieShowtimesDates = versions => {
  const dates = [];

  versions.forEach(version => {
    version.sessions.forEach(session => {
      if (!showtimeBelongsToPreviousDay(session.datetime)) {
        dates.push(session.datetime.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})T/)[1]);
      } else {
        dates.push(getPreviousDate(session.datetime));
      }
    })
  });

  return dates.filter((v, i, a) => a.indexOf(v) === i).sort();
};

export const getBillboardShowtimesDates = movies => {
  const versions = movies.reduce((carry, movie) => {
    return carry.concat(movie.versions);
  }, []);

  return getMovieShowtimesDates(versions);
};

export const getDateFilterDisplayString = (date) => {
  const now = moment();
  const tomorrow = moment().add(1, 'day');
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
