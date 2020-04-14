import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
//import { user } from 'firebase-functions/lib/providers/auth';
admin.initializeApp()

const db = admin.firestore()
const timestamp = admin.firestore.Timestamp

const REF_USER: string = 'user'
const REF_HISTORY: string = 'history'


export const createUser = functions.https.onRequest(async (request, response) => {
    const data = request.body

    await db.collection(REF_USER).add({
        displayName: data.displayName,
        password: data.password,
        licenseNo: data.licenseNo,
        currentParking: null      
    }).then(ref => {
        console.log("User created: " + ref.id)
        return response.status(200).send({'userID': ref.id})
    }).catch(error => {
        console.log("Can't create user: " + error)
        return response.status(400).send(error)
    })
});

<<<<<<< HEAD
export const signIn = functions.https.onRequest(async (request, response) => {
    const displayName = request.body.displayName
    const password = request.body.password

    let logInData: any
    await db.collection(REF_USER).where('displayName', '==', displayName).where('password', '==', password).get().then(logInSnapshot => {
        if(logInSnapshot.empty) {
            return response.status(404).send({
                'status': 404,
                'message': 'user not found'
            })
        }
        logInSnapshot.forEach(userDetails => {
            logInData = userDetails
            return
        })
        return
    })
    console.log("user found: " +{
        "userId": logInData.id,
        "displayName": logInData.get('displayName'),
        "licenseNo": logInData.get('licenseNo'),
        "password": logInData.get('password')
    })
    return response.status(200).send({
        'displayName': logInData.get('displayName'),
        'licenseNo': logInData.get('licenseNo')
    })
    
})
=======
>>>>>>> 1320d18f00538e8ea5e229ef96da9fb0f7159125

export const vehicleCheckin = functions.https.onRequest(async (request,response) => {
    const licenseNo = request.body.licenseNo

    console.log("licenseNo: " + licenseNo)

<<<<<<< HEAD
    let userContent: any
=======
    let user: any
>>>>>>> 1320d18f00538e8ea5e229ef96da9fb0f7159125
    await db.collection(REF_USER).where('licenseNo', '==', licenseNo).get().then(userSnapshot => {
        if (userSnapshot.empty) {
            return response.status(404).send({
                'status': 404,
                'message': 'user not found'
            })
        }
        userSnapshot.forEach(userDoc => {
<<<<<<< HEAD
            userContent = userDoc
=======
            user = userDoc
>>>>>>> 1320d18f00538e8ea5e229ef96da9fb0f7159125
            return
        })
        return
    })

    console.log("user found: " + {
<<<<<<< HEAD
        "userId": userContent.id,
        "displayName": userContent.get('displayName'),
        "licenseNo": userContent.get("licenseNo")
    })

    await db.collection(REF_HISTORY).add({
        userId: userContent.id,
=======
        "userId": user.id,
        "displayName": user.get('displayName'),
        "licenseNo": user.get("licenseNo")
    })

    await db.collection(REF_HISTORY).add({
        userId: user.id,
>>>>>>> 1320d18f00538e8ea5e229ef96da9fb0f7159125
        licenseNo: licenseNo,
        startTime: timestamp.fromDate(new Date()),
        endTime: null,
        status: null,
        duration: null,
        price: null,
        parkingSlot: null
    }).then(ref => {
        console.log("History created: " + ref.id)
        return response.status(200).send({'historyID': ref.id})
    }).catch(error => {
        console.log("Can't create history: " + error)
        return response.status(400).send(error)
    })
});
