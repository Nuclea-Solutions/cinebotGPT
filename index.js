require('dotenv').config(); // Cargar variables de entorno desde el archivo .env
var admin = require("firebase-admin");

// Cargar la clave de servicio desde la variable de entorno
var serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cinebot-7f35b-default-rtdb.firebaseio.com" // Opcional para Firestore
});

var db = admin.firestore();

// Datos para el documento en la colección 'sessions'
var sessionData = {
  movies: "https://example.com/movies",
  showtimes: "https://example.com/showtimes"
};

// Crear un documento en la colección 'sessions'
db.collection('sessions').doc('exampleSession').set(sessionData)
  .then(() => {
    console.log('Document successfully written!');
    // Obtener el Documento
    return db.collection('sessions').doc('exampleSession').get();
  })
  .then((doc) => {
    if (doc.exists) {
      console.log('Document data:', doc.data());
      // Eliminar el Documento (opcional, si no deseas eliminarlo, puedes comentar estas líneas)
      // return db.collection('sessions').doc('exampleSession').delete();
    } else {
      console.log('No such document!');
    }
  })
  .then(() => {
    console.log('Document successfully deleted!'); // Este mensaje aparecerá si se elimina el documento
  })
  .catch((error) => {
    console.error('Error: ', error);
  });
