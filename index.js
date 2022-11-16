const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();


const app = express();
const port = process.env.PORT || 5000;



// ---> middle ware
app.use(cors());
app.use(express.json());

// ---> test
app.get('/', (req, res) => {
    res.send('vision health server is running...')
})

// mongodb connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_USER_PASS}@cluster0.76zc9vk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// ---> working function
async function run() {

    try {
        // ---> collections
        const appointmentServicesCollection = client.db("visionHealthCenter").collection('appointmentServices');
        const bookingsCollection = client.db("visionHealthCenter").collection('bookings');

        //---> get services data
        app.get('/appointmentServices', async (req, res) => {
            const date = req.query.date;
            const query = {};
            const appointmentServices = await appointmentServicesCollection.find(query).toArray();

            // --> query by booked date
            const bookingQuery = { appointmentDate: date }
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
            // --> slot handle
            appointmentServices.forEach(appointService => {
                // -->service
                const appServiceBooked = alreadyBooked.filter(book => book.treatment === appointService.serviceTitle);
                // -->all slots
                const bookedSlots = appServiceBooked.map(book => book.slot);
                // ---> remaining slots
                const remainingSlots = appointService.slots.filter(slot => !bookedSlots.includes(slot));
                appointService.slots = remainingSlots;
            })


            res.send(appointmentServices)
        })

        // ---> booking || post
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                appointmentDate: booking.appointmentDate,
                email: booking.email,
                treatment: booking.treatment
            }

            const alreadyBooked = await bookingsCollection.find(query).toArray();
            // --> date based booking
            if (alreadyBooked.length) {
                const message = `You already booking on ${booking.appointmentDate}`;
                return res.send({ acknowledged: false, message })
            }

            const result = await bookingsCollection.insertOne(booking);
            res.send(result)
        })

    } finally { }

} run().catch(err => console.log(err))




app.listen(port, () => console.log(`vision heath center server is running from port ${port}`))