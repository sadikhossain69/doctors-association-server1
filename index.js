const express = require('express');
const req = require('express/lib/request');
const res = require('express/lib/response');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000
require('dotenv').config()
const cors = require('cors');
const jwt = require('jsonwebtoken');

app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ppmrx.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        res.status(401).send({ message: 'Unauthorized Access' })
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded
        next()
    })
}

async function run() {
    try {
        await client.connect()
        console.log('db connected');

        const serviceCollection = client.db('doctors_association').collection('services')
        const bookingCollection = client.db('doctors_association').collection('bookings')
        const userCollection = client.db('doctors_association').collection('users')
        const doctorCollection = client.db('doctors_association').collection('doctors')

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded?.email
            const requsterAccount = await userCollection.findOne({ email: requester })
            if (requsterAccount.role === 'admin') {
                next()
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
        }

        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = serviceCollection.find(query).project({ name: 1 })
            const result = await cursor.toArray()
            res.send(result)
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking)
            res.send({ success: true, result })
        })

        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient
            const decodedEmail = req.decoded?.email
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings)
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date;

            const services = await serviceCollection.find().toArray();

            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();

            services.forEach(service => {
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                const bookedSlots = serviceBookings.map(book => book.slot);
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                service.slots = available;
            });
            res.send(services);
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin })
        })

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token: token });
        })

        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })

        app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctors = await doctorCollection.find().toArray()
            res.send(doctors)
        })

        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body
            const result = await doctorCollection.insertOne(doctor)
            res.send(result)
        })

        app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params?.email;
            const filter = { email: email };
            const result = await doctorCollection.deleteOne(filter);
            res.send(result);
        })
    }
    finally {


    }
}

run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('Hello From Doctor Uncle')
})

app.listen(port, () => {
    console.log("Server is running", port);
})