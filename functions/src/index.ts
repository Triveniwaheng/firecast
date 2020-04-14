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


export const vehicleCheckin = functions.https.onRequest(async (request,response) => {
    const licenseNo = request.body.licenseNo

    console.log("licenseNo: " + licenseNo)

    let userContent: any
    await db.collection(REF_USER).where('licenseNo', '==', licenseNo).get().then(userSnapshot => {
        if (userSnapshot.empty) {
            return response.status(404).send({
                'status': 404,
                'message': 'user not found'
            })
        }
        userSnapshot.forEach(userDoc => {
            userContent = userDoc
            return
        })
        return
    })

    console.log("user found: " + {
        "userId": userContent.id,
        "displayName": userContent.get('displayName'),
        "licenseNo": userContent.get("licenseNo")
    })

    await db.collection(REF_HISTORY).add({
        userId: userContent.id,
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


export const vehicleCheckOut = functions.https.onRequest(async (request,response) => {
    const licenseNo = request.body.licenseNo

    try {
        const userSnapshot = await db.collection(REF_USER).where('licenseNo', '==', licenseNo).get()
        if (userSnapshot.empty) {
            response.status(404).send({
                'status': 404,
                'message': 'user not found'
            })
        }

        let user 
        userSnapshot.forEach(userDoc => {
            user = userDoc
        })

        const currentHistoryId = user.get('currentParking')

    } catch (error) {

    }


});