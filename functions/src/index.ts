import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp()

const db = admin.firestore()

const REF_USER: string = 'user'
const REF_HISTORY: string = 'history'

export const createUser = functions.https.onRequest(async (request, response) => {
    const data = request.body

    await db.collection(REF_USER).add({
        displayName: data.displayName,
        password: data.password,
        licenseNo: data.licenseNo,
        currentParking: ''        
    }).then(ref => {
        console.log("User created: " + ref.id)
        return response.status(200).send({'userID': ref.id})
    }).catch(error => {
        console.log("Can't create user: " + error)
        return response.status(400).send(error)
    })
});

export const vehicleCheckin = functions.https.onRequest(async (request,response) => {
    const data = request.body.licenseNo

    await db.collection(REF_HISTORY).add({
        userId: data.userId,
        licenseNo: data.licenseNo,
        startTime: data.startTime,
        endTime: data.endTime,
        status: '',
        duration: '',
        price: '',
        parkingSlot: ''
    }).then(ref => {
        console.log("History created: " + ref.id)
        return response.status(200).send({'historyID': ref.id})
    }).catch(error => {
        console.log("Can't create history: " + error)
        return response.status(400).send(error)
    })
});