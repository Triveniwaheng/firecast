import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp()

export const getUsersData = 
functions.https.onRequest((request, response) => {
    admin.firestore().collection('User').get()
    .then(allUsers => {
        // in this query allUsers has all the user
    
        const userList: any[] = []
        // accessing all the users
        allUsers.forEach(eachUser => {
            // eachUser is the individual user
            const  user = {
                'Name': eachUser.get('name'),
                'License Plate': eachUser.get('license')
                // …...
                // …..
            }
            userList.push(user)
        })
        console.log(userList)
        response.send(userList)
    })
    
    .catch(error => {
        console.log(error)
        response.status(500).send(error)
    })
})

export const getHistoryData = 
functions.https.onRequest((request, response) => {
    admin.firestore().collection('History').get()
    .then(allHistory => {
        // in this query allUsers has all the user
    
        const historyList: any[] = []
        // accessing all the users
        allHistory.forEach(eachUser => {
            // eachUser is the individual user
            const  history = {
                'User Id': eachUser.get('userId'),
                'Duration': eachUser.get('duration'),
                'Start Time': eachUser.get('startTime'),
                'End Time': eachUser.get('endTime')
                // …..
            }
            historyList.push(history)
        })
        console.log(historyList)
        response.send(historyList)
    })
    
    .catch(error => {
        console.log(error)
        response.status(500).send(error)
    })
})




//export const getUsers = functions.https.onRequest((request, response) => {
  //admin.firestore().doc('').get()
  //.then(snapshot => {
    //  const data = snapshot.data()
      //console.log(data)
      //response.send(data)
  //})
  //.catch(error => {
    //  console.log(error)
      //response.status(500).send(error)
  //})
//});
