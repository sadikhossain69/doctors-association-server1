const express = require('express');
const req = require('express/lib/request');
const res = require('express/lib/response');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000
require('dotenv').config()
const cors = require('cors');

app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ppmrx.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect()
        console.log('db connected');

        const serviceCollection = client.db('doctors_association').collection('services')
        const bookingCollection = client.db('doctors_association').collection('bookings')

        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = serviceCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query)
            if(exists) {
                return res.send({success: false, booking: exists})
            }
            const result = await bookingCollection.insertOne(booking)
            res.send({success: true, result})
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