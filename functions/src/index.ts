import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp()

const db = admin.firestore()
const timestamp = admin.firestore.Timestamp

const REF_USER: string = 'user'
const REF_HISTORY: string = 'history'
const REF_PARKING: string = 'parking'
const REF_PARKING_SLOT: string = 'parkingSlot'


export const createUser = functions.https.onRequest(async (request, response) => {
    const data = request.body
    const licenseNo = data.licenseNo.toLowerCase()

    try {

        const existingUsers = await db.collection(REF_USER).where('licenseNo', '==', licenseNo).get()
        console.log('Existing users: ', existingUsers)
        console.log('Existing users size: ', existingUsers.size)
        if (existingUsers.size > 0) {
            return response.send({ 'status': 409, 'error': 'license no. already exist' })
        }

        const user = await db.collection(REF_USER).add({
            displayName: data.displayName,
            password: data.password,
            licenseNo: licenseNo,
            currentParkingId: null
        })

        console.log("User created: " + user.id)
        return response.send({
            'status': 200,
            'data': {
                'userId': user.id,
                'displayName': data.displayName,
                'licenseNo': licenseNo
            }
        })

    } catch (error) {

        console.error("Can't create user: " + error)
        return response.send({ 'status': 400, 'error': error })
    }
});


export const signIn = functions.https.onRequest(async (request, response) => {
    const displayName = request.body.displayName
    const password = request.body.password

    try {

        let user: any
        const userSnapshot = await db.collection(REF_USER).where('displayName', '==', displayName).where('password', '==', password).get()

        if (userSnapshot.empty) {
            return response.send({ 'status': 404, 'error': 'user not found' })
        }

        userSnapshot.forEach(userDetails => {
            user = userDetails
        })

        console.log("user found: " + {
            "userId": user.id,
            "displayName": user.get('displayName'),
            "licenseNo": user.get('licenseNo'),
            "password": user.get('password')
        })

        return response.status(200).send({
            'status': 200,
            'data': {
                'userId': user.id,
                'displayName': user.get('displayName'),
                'licenseNo': user.get('licenseNo')
            }
        })

    } catch (error) {
        console.error("sign in error: " + error)
        return response.status(400).send({ 'status': 400, 'error': error })
    }

})


export const vehicleCheckIn = functions.https.onRequest(async (request, response) => {
    const licenseNo = request.body.licenseNo.toLowerCase()
    const parkingId = request.body.parking

    console.log('License: ', licenseNo, ' parkingId: ', parkingId)

    try {
        const userSnapshot = await db.collection(REF_USER).where('licenseNo', '==', licenseNo).get()
        if (userSnapshot.empty) {
            return response.status(404).send({
                'status': 404,
                'message': 'user not found'
            })
        }

        const parking = await db.collection(REF_PARKING).doc(parkingId).get()
        if (!parking.exists) {
            return response.status(200).send({
                'status': 204,
                'message': 'parking not found'
            })
        }

        let user: any
        userSnapshot.forEach(userDoc => {
            user = userDoc
        })

        // Send notification to the user
        const notification = {
            title: 'Vehicle checked in',
            body: 'Your vehicle ' + licenseNo + ' has entered the parking' + parking.get('title'),
        }

        await sendNotificationToUser(user, notification)

        console.log("user: " + {
            "userId": user.id,
            "displayName": user.get('displayName'),
            "licenseNo": user.get("licenseNo")
        })

        const history = await db.collection(REF_HISTORY).add({
            userId: user.id,
            licenseNo: licenseNo,
            startTime: timestamp.fromDate(new Date()),
            endTime: null,
            status: 'parking',
            duration: null,
            price: null,
            parkingSlot: null,
            parking: parkingId
        })

        await db.collection(REF_USER).doc(user.id).update({
            currentParkingId: history.id
        })

        console.log("History created: " + history.id)
        return response.status(200).send({ 'historyID': history.id })
    } catch (error) {
        console.log("Can't create history: " + error)
        return response.status(400).send(error)
    }
});


export const vehicleCheckOut = functions.https.onRequest(async (request, response) => {
    const licenseNo = request.body.licenseNo.toLowerCase()
    const parkingId = request.body.parking
    const pricePerMin = 2

    try {

        const parking = await db.collection(REF_PARKING).doc(parkingId).get()
        if (!parking.exists) {
            return response.status(200).send({
                'status': 204,
                'message': 'parking not found'
            })
        }

        const userSnapshot = await db.collection(REF_USER).where('licenseNo', '==', licenseNo).get()
        if (userSnapshot.empty) {
            return response.status(404).send({
                'status': 404,
                'message': 'user not found'
            })
        }

        let user
        userSnapshot.forEach(userDoc => {
            user = userDoc
        })

        // Send notification to the user
        const notification = {
            title: 'Vehicle checked out',
            body: 'Your vehicle ' + licenseNo + ' has left the parking' + parking.get('title'),
        }

        await sendNotificationToUser(user, notification)

        const currentParkingId: string = user.get('currentParkingId')
        const currentParking = await db.collection(REF_HISTORY).doc(currentParkingId).get()

        const startTime = currentParking.get('startTime')
        const endTime = timestamp.fromDate(new Date())
        const durationSec = endTime.seconds - startTime.seconds
        const totalPrice = (durationSec / 60) * pricePerMin

        await db.collection(REF_HISTORY).doc(currentParkingId).update({
            endTime: timestamp.fromDate(new Date()),
            status: 'gone',
            duration: durationSec,
            price: totalPrice,
        })

        await db.collection(REF_USER).doc(user.id).update({
            currentParkingId: null
        })

        const updatedParking = await db.collection(REF_HISTORY).doc(currentParkingId).get()
        const parkingSlot = updatedParking.get('parkingSlot')

        await db.collection(REF_PARKING).doc(parkingId).collection(REF_PARKING_SLOT).doc(String(parkingSlot)).update({
            isAvailable: true
        })

        const responseTOReturn = {
            userId: updatedParking.get('userId'),
            licenseNo: updatedParking.get('licenseNo'),
            startTime: updatedParking.get('startTime'),
            endTime: updatedParking.get('endTime'),
            status: updatedParking.get('status'),
            duration: updatedParking.get('duration'),
            price: updatedParking.get('price'),
            parkingSlot: updatedParking.get('parkingSlot')
        }

        return response.status(200).send(JSON.stringify(responseTOReturn))
    } catch (error) {
        console.error(error)
        return response.status(400).send(error)
    }
});


async function sendNotificationToUser(user, notification) {
    const tokens = user.get('deviceToken') == null || undefined ? null : user.get('deviceToken') as string[]
    if (tokens == null) {
        return
    }

    const payload = {
        notification: notification
    };

    const response = await admin.messaging().sendToDevice(tokens, payload);

    const tokensToRemove: any[] = [];
    response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
            console.error('Failure sending notification to', tokens[index], error);
            // Cleanup the tokens who are not registered anymore.
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                tokensToRemove.push(db.collection(REF_USER).doc(user.id).update({
                    deviceToken: admin.firestore.FieldValue.arrayRemove(tokens[index])
                }));
            }
        }
    });
    console.log('Token to remove: ' + tokensToRemove)
    return Promise.all(tokensToRemove);
}

export const getAllLicenseNo = functions.https.onRequest(async (request, response) => {
    const allUser = await db.collection(REF_USER).get()

    const licenseNo: any[] = []
    allUser.forEach(userDoc => {
        licenseNo.push(userDoc.get('licenseNo'))
    })

    return response.status(200).send(licenseNo)
});


export const addParkingSlots = functions.https.onRequest(async (request, response) => {
    const parking = await db.collection(REF_PARKING).get()

    const promises: any = []
    parking.forEach(doc => {
        for (let i=0; i<20; i++) {
            const slot = db.collection(REF_PARKING).doc(doc.id).collection('parkingSlot').doc(i.toString()).set({
                'isAvailable': true
            })
            promises.push(slot)
        }
    })
    await Promise.all(promises)

    return response.status(200).send('Done')
});