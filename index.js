const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();


const app = express();
const port = process.env.PORT || 5000;



// -----> middle ware
app.use(cors());
app.use(express.json());

// -----> test
app.get('/', (req, res) => {
    res.send('vision health server is running...')
})

//-----> mongodb connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_USER_PASS}@cluster0.76zc9vk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// ---> custom middle ware for jwt
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

// -----> working function
async function run() {
    try {
        // -----> collections
        const appointmentServicesCollection = client.db("visionHealthCenter").collection('appointmentServices');
        const bookingsCollection = client.db("visionHealthCenter").collection('bookings');
        const usersCollection = client.db("visionHealthCenter").collection('users');
        const doctorsCollection = client.db("visionHealthCenter").collection('doctors');

        //-----> get services data
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
                // --> remaining slots
                const remainingSlots = appointService.slots.filter(slot => !bookedSlots.includes(slot));
                appointService.slots = remainingSlots;
            })
            res.send(appointmentServices)
        })

        // -----> booking with email query
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }


            const query = { email: email };
            const booking = await bookingsCollection.find(query).toArray();
            res.send(booking)
        })



        // -----> booking || post
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
        });

        // ---> jwt 
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' });
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
        })

        // ---> get users data
        app.get('/users', async (req, res) => {
            const query = {};
            const result = await usersCollection.find(query).toArray();
            res.send(result)

        })

        // --->store users data  || Post
        app.post('/users', async (req, res) => {
            const user = req.body;
            const users = await usersCollection.insertOne(user);
            res.send(users)
        })

        // ---> check isAdmin
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'Admin' })
        })

        // ---> update user info
        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }

            const user = await usersCollection.findOne(query);

            if (user?.role !== 'Admin') {
                return res.status(403).send('forbidden access')
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateUserDoc = {
                $set: {
                    role: 'Admin'
                },
            };
            const result = await usersCollection.updateOne(filter, updateUserDoc, options);
            res.send(result)
        })

        // ---> appointment Specialty
        app.get("/appointmentSpecialty", async (req, res) => {
            const query = {};
            const result = await appointmentServicesCollection.find(query).project({ serviceTitle: 1 }).toArray();
            res.send(result)
        })



        // ---> doctors data collect
        app.post('/doctors', async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result)
        })



    } finally { }

} run().catch(err => console.log(err))




app.listen(port, () => console.log(`vision heath center server is running from port ${port}`))