import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp()

export const getBostonWeather = 
functions.https.onRequest(async (request, response) => {
    try{
        const snapshot = await admin.firestore().doc('cities-weather/boston-ma-us').get()
        const data = snapshot.data()
        console.log(data)
        response.send(data)
    }
    catch (error) {
        console.log(error)
        response.status(500).send(error)
    }
    
    
  });