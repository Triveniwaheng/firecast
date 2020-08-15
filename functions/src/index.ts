import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
// import { request } from 'http';
admin.initializeApp()

const db = admin.firestore()
const timestamp = admin.firestore.Timestamp

const REF_USER: string = 'user'
const REF_HISTORY: string = 'history'
const REF_PARKING: string = 'parking'
const REF_PARKING_SLOT: string = 'parkingSlot'

/**
 * Function to create new user
 * {@param displayName} User's display name
 * {@param password} password of the user
 * {@param licenseNo} user's vehicle license no.
 */
export const createUser = functions.https.onRequest(async (req, response) => {
    const data = req.body
    const licenseNo = data.licenseNo

    try {

        /**
         * Check if the license no. is already registered by a user
         */
        const existingUsers = await db.collection(REF_USER).where('licenseNo', '==', licenseNo).get()
        console.log('Existing users: ', existingUsers)
        console.log('Existing users size: ', existingUsers.size)

        /**
         * If the license no. is already registered by a user return conflict response
         */
        if (existingUsers.size > 0) {
            return response.send({ 'status': 409, 'error': 'license no. already exist' })
        }

        /**
         * If there is no license no. conflicts, create new user
         */
        const user = await db.collection(REF_USER).add({
            displayName: data.displayName,
            password: data.password,
            licenseNo: licenseNo,
            currentParkingId: null
        })

        /**
         * Returning user's details as response
         */
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


/**
 * Function to authenticate user
 * {@param displayName} User's display name
 * {@param password} password of the user
 */
export const signIn = functions.https.onRequest(async (req, response) => {
    const displayName = req.body.displayName
    const password = req.body.password

    try {

        /**
         * Checking if there is a user with same {@param displayName} and {@param password}
         * {@var userSnapshot} has the response from the {@var firestore} database
         */
        let user: any
        const userSnapshot = await db.collection(REF_USER).where('displayName', '==', displayName).where('password', '==', password).get()

        /**
         * If {@var userSnapshot} is empty, return user not found response
         */
        if (userSnapshot.empty) {
            return response.send({ 'status': 404, 'error': 'user not found' })
        }

        /**
         * {@var userSnapshot} is a list, loop through it and assign the user to the {@var user}
         */
        userSnapshot.forEach(userDetails => {
            user = userDetails
        })

        console.log("user found: " + {
            "userId": user.id,
            "displayName": user.get('displayName'),
            "licenseNo": user.get('licenseNo'),
            "password": user.get('password')
        })

        /**
         * Return the user'd details as a response
         */
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


/**
 * This function calls when a vehicle checks in to a parking
 * {@param licenseNo} license no. of the vehicle
 * {@param parking} ID of the parking 
 */
export const vehicleCheckIn = functions.https.onRequest(async (req, response) => {
    const licenseNo = req.body.licenseNo
    const parkingId = req.body.parking

    console.log('License: ', licenseNo, ' parkingId: ', parkingId)

    try {

        /**
         * Check if there is a document in parking collection with {@param parkingId}
         * If the parking is not exist, response parking not found
         */
        const parking = await db.collection(REF_PARKING).doc(parkingId).get()
        if (!parking.exists) {
            return response.status(200).send({
                'status': 204,
                'message': 'parking not found'
            })
        }

        /**
         * Go to the user collection and check if there is any user with license no. {@param licenseNo} 
         * If no user found with license no. {@param licenseNo}, return user not found
         */
        const userSnapshot = await db.collection(REF_USER).where('licenseNo', '==', licenseNo).get()
        if (userSnapshot.empty) {
            return response.status(404).send({
                'status': 404,
                'message': 'user not found'
            })
        }

        /**
         * {@var userSnapshot} is a list, loop through it and assign the user to the {@var user}
         */
        let user: any
        userSnapshot.forEach(userDoc => {
            user = userDoc
        })

        /**
         * Don't allow check in request if the user is currently in a parking 
         */

        if (user.get('currentParkingId') != null) {
            return response.status(401).send({
                'status': 401,
                'message': 'Unauthorized to park, user is currently in a parking'
            })
        }

        /**
         * Send a notification and notify the user that the vehicle has checked in to a parking 
         */
        const notification = {
            title: 'Vehicle checked in',
            body: 'Your vehicle ' + licenseNo + ' has entered the parking ' + parking.get('title'),
        }

        await sendNotificationToUser(user, notification)

        console.log("user: " + {
            "userId": user.id,
            "displayName": user.get('displayName'),
            "licenseNo": user.get("licenseNo")
        })

        /**
         * Create a new history document to history collection to store the details of the new park
         */
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

        /**
         * In the user's collection to the user's document, update the user's current parking to
         * the newly created history
         */
        await db.collection(REF_USER).doc(user.id).update({
            currentParkingId: history.id
        })

        /**
         * Return history id as a response
         */
        console.log("History created: " + history.id)
        return response.status(200).send({ 'historyID': history.id })
    } catch (error) {
        console.log("Can't create history: " + error)
        return response.status(400).send(error)
    }
});


/**
 * This function calls when a vehicle checks out of a parking
 * {@param licenseNo} license no. of the vehicle
 * {@param parking} ID of the parking 
 */
export const vehicleCheckOut = functions.https.onRequest(async (req, response) => {
    const licenseNo = req.body.licenseNo
    const parkingId = req.body.parking

    try {

        /**
         * Check if there is a document in parking collection with {@param parkingId}
         * If the parking is not exist, response parking not found
         */
        const parking = await db.collection(REF_PARKING).doc(parkingId).get()
        if (!parking.exists) {
            return response.status(200).send({
                'status': 204,
                'message': 'parking not found'
            })
        }

        /**
         * Go to the user collection and check if there is any user with license no. {@param licenseNo} 
         * If no user found with license no. {@param licenseNo}, return user not found
         */
        const userSnapshot = await db.collection(REF_USER).where('licenseNo', '==', licenseNo).get()
        if (userSnapshot.empty) {
            return response.status(404).send({
                'status': 404,
                'message': 'user not found'
            })
        }

        /**
         * {@var userSnapshot} is a list, loop through it and assign the user to the {@var user}
         */
        let user
        userSnapshot.forEach(userDoc => {
            user = userDoc
        })

        /**
         * Don't allow check out request if the user is not currently in a parking 
         */

        if (user.get('currentParkingId') == null) {
            return response.status(401).send({
                'status': 401,
                'message': 'Unauthorized to checkout, user is not currently in a parking'
            })
        }


        /**
         * Send a notification and notify the user that the vehicle has checked out from a parking 
         */
        const notification = {
            title: 'Vehicle checked out',
            body: 'Your vehicle ' + licenseNo + ' has left the parking ' + parking.get('title'),
        }

        await sendNotificationToUser(user, notification)

        /**
         * Get the current parking if of the user from the user's document
         */
        const currentParkingId: string = user.get('currentParkingId')

        /**
         * Get the parking details from the histroy collection using the current parking id {@var currentParkingId}
         * and store it to the {@var currentParking}
         */
        const currentParking = await db.collection(REF_HISTORY).doc(currentParkingId).get()

        /**
         * Get the start time {@var startTime},
         * assign endTime {@var endTime} as current time (now)
         * Calculate the duration {@var durationSec},
         * Calculate price {@var totalPrice}
         */
        const startTime = currentParking.get('startTime')
        const endTime = timestamp.fromDate(new Date())
        const durationSec = endTime.seconds - startTime.seconds
        const price = parking.get('price') as number
        const totalPrice = (durationSec / 60) * price
        console.log('Price: ', price, ', Sec: ', durationSec, ', Min: ', (durationSec / 60), ', Totoal: ', totalPrice)

        /**
         * Update the parking details with newly calculated
         * {@var endTime, @var duration, @var price and @var status as gone}
         */
        await db.collection(REF_HISTORY).doc(currentParkingId).update({
            endTime: timestamp.fromDate(new Date()),
            status: 'gone',
            duration: durationSec,
            price: totalPrice,
        })

        /**
         * Set the user's current parking to null as the vehicle checks out from the parking
         */
        await db.collection(REF_USER).doc(user.id).update({
            currentParkingId: null
        })

        /**
         * From the updated parking details, get the parking slot {@var parkingSlot}
         */
        const updatedParking = await db.collection(REF_HISTORY).doc(currentParkingId).get()
        const parkingSlot = updatedParking.get('parkingSlot')

        /**
         * Go to the parking collection and set the parking slot as available,
         * since the vehicle is going out of the parking
         */
        await db.collection(REF_PARKING).doc(parkingId).collection(REF_PARKING_SLOT).doc(String(parkingSlot)).update({
            isAvailable: true
        })

        /**
         * Return the whole park history details as a response
         */
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


/**
 * Function to send notification to the user
 * @param user User to send the notification
 * @param notification The notification content
 */
async function sendNotificationToUser(user, notification) {
    /**
     * Get all the device tokens from the user
     * Device token are auto generated from the mobile app.
     * 
     * If the token is null, just return
     */
    const tokens = user.get('deviceToken') == null || undefined ? null : user.get('deviceToken') as string[]
    if (tokens == null) {
        return
    }

    /**
     * Set the notification to the payload object to send and 
     * send the notification using firebase cloud messanging
     */
    const payload = {
        notification: notification
    };

    const response = await admin.messaging().sendToDevice(tokens, payload);

    /**
     * If the device changed it's token or unregistered or deleted,
     * add those token to the {@var tokensToRemove}, these are the unused tokens
     */
    const tokensToRemove: any[] = [];
    response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
            console.error('Failure sending notification to', tokens[index], error);
            // Cleanup the tokens who are not registered anymore.
            if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {

                /**
                 * Prepare unused token to be removed from the user's document
                 */
                tokensToRemove.push(db.collection(REF_USER).doc(user.id).update({
                    deviceToken: admin.firestore.FieldValue.arrayRemove(tokens[index])
                }));
            }
        }
    });

    /**
     * Remove all the unuse token from the user's document
     */
    console.log('Token to remove: ' + tokensToRemove)
    return Promise.all(tokensToRemove);
}


/**
 * Return all the available license no. 
 */
export const getAllLicenseNo = functions.https.onRequest(async (req, response) => {
    const allUser = await db.collection(REF_USER).get()

    const licenseNo: any[] = []
    allUser.forEach(userDoc => {
        licenseNo.push(userDoc.get('licenseNo'))
    })

    return response.status(200).send(licenseNo)
});


/**
 * Reset all the parking slots for all the parking to available
 */
export const addParkingSlots = functions.https.onRequest(async (req, response) => {
    const parking = await db.collection(REF_PARKING).get()

    const promises: any = []
    parking.forEach(doc => {
        for (let i = 0; i < 20; i++) {
            const slot = db.collection(REF_PARKING).doc(doc.id).collection('parkingSlot').doc(i.toString()).set({
                'isAvailable': true
            })
            promises.push(slot)
        }
    })
    await Promise.all(promises)

    return response.status(200).send('Done')
});


/**
 * Get full details of a park history
 * {@param historyID} id of the history
 */
export const getParkingHistoryDetails = functions.https.onRequest(async (req, response) => {
    const historyID = req.body.historyID

    try {

        /**
         * Check if the history document is exist in the history collection,
         * if it is not exist, return history not found
         */
        const history = await db.collection(REF_HISTORY).doc(historyID).get()
        if (!history.exists) {
            return response.status(200).send({
                'status': 204,
                'message': 'history not found'
            })
        }

        /**
         * Get the parking id of the parking from the history document and 
         * get the parking details using the parking id and store it to the {@var parking}
         */
        let parking = {}
        const parkingID = history.get('parking') == null || undefined ? null : history.get('parking')
        if (parkingID != null) {
            const p = await db.collection(REF_PARKING).doc(parkingID).get()
            parking = {
                address: p.get('address'),
                image: p.get('image'),
                location: p.get('location'),
                title: p.get('title')
            }
        }

        const data = {
            parking: parking,
            duration: history.get('duration'),
            startTime: history.get('startTime'),
            endTime: history.get('endTime'),
            licenseNo: history.get('licenseNo'),
            parkingSlot: history.get('parkingSlot'),
            price: history.get('price'),
            status: history.get('status')
        }

        /**
         * Return the whole history data including parking details as a response
         */
        return response.status(200).send({
            'status': 200,
            'data': data
        })

    } catch (error) {
        console.error(error)
        return response.status(400).send(error)
    }
});

// const axios = require('axios').default;
// const https = require('https');
import { request } from 'http';

exports.onUpdateOrder = functions.firestore.document(REF_USER + '/{userId}').onWrite(async (change, context) => {
    const oldLicenseNo = change.before.get('licenseNo')
    const newLicenseNo = change.after.get('licenseNo')

    console.log('Old no.: ', oldLicenseNo, ' New no.: ', newLicenseNo)
    if (oldLicenseNo != newLicenseNo) {
        console.log('License no. updated')

        try {
            const allUser = await db.collection(REF_USER).get()
            const licenseNo: any[] = []
            allUser.forEach(userDoc => { licenseNo.push(userDoc.get('licenseNo')) })
            console.log('All license nos.: ', licenseNo)

            // const url = 'https://us-central1-final-year-project-d4c31.cloudfunctions.net/getAllLicenseNo/'
            // const a = await axios.post(url, {
            //     firstName: 'Fred',
            //     lastName: 'Flintstone'
            // })

            // const a = await https.get(url)

            // const a = await request({
            // host: 'https://us-central1-final-year-project-d4c31.cloudfunctions.net',
            // path: '/getAllLicenseNo/',
            // method: 'GET',
            // })

            // a.on('finish', () => {
            //     console.log('Request finished.')
            // })


            const a = await performRequest({
                host: 'https://us-central1-final-year-project-d4c31.cloudfunctions.net',
                path: '/getAllLicenseNo/',
                method: 'GET',
            })

            console.log('Response: ', a)
        } catch (error) {
            console.error('Error: ', error)
        }
    }
});


function performRequest(options) {
    return new Promise((resolve, reject) => {
        request(
            options,
            function (response) {
                const { statusCode } = response;
                if (statusCode == undefined || statusCode >= 300) {
                    reject(
                        new Error(response.statusMessage)
                    )
                }
                const chunks: any = [];
                response.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                response.on('end', () => {
                    const result = Buffer.concat(chunks).toString();
                    resolve(JSON.parse(result));
                });
            }
        )
            .end();
    })
}


export const postTest = functions.https.onRequest((req, response) => {
    console.log(req.body)
    return response.send(req.body)
})