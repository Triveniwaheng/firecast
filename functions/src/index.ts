import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
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


export const vehicleCheckin = functions.https.onRequest(async (request,response) => {
    const licenseNo = request.body.licenseNo

    console.log("licenseNo: " + licenseNo)

    let user: any
    await db.collection(REF_USER).where('licenseNo', '==', licenseNo).get().then(userSnapshot => {
        if (userSnapshot.empty) {
            return response.status(404).send({
                'status': 404,
                'message': 'user not found'
            })
        }
        userSnapshot.forEach(userDoc => {
            user = userDoc
            return
        })
        return
    })

    console.log("user found: " + {
        "userId": user.id,
        "displayName": user.get('displayName'),
        "licenseNo": user.get("licenseNo")
    })

    await db.collection(REF_HISTORY).add({
        userId: user.id,
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