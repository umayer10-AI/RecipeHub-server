require('dotenv').config()
const express = require('express');
const cors = require('cors');
const app = express()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const uri = process.env.MONGODB_URL

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const run = async() => {
    try {
      await client.connect();

      const db = client.db('recipeHub')
      const reciepeCollection = db.collection('recipes')
      const subcriptionCollection = db.collection('subscriptions')

      app.post('/subscription', async(req,res) => {
        const {sessionId, priceId, userId} = req.body
        await subcriptionCollection.insertOne({
          sessionId,
          priceId,
          userId,
        })

        // const isExist = await subcriptionCollection.findOne({sessionId})
        // if(isExist){
        //   return res.json({message: 'Aready Exist'})
        // }

        await userCollection.updateOne(
          {_id: new ObjectId(userId)},
          { $set: { plan: 'pro'}}
        )

        res.json({message: 'Payment Successfull'})
      })


      app.get('/api/recipes/:id', async(req,res) => {
        const {id} = req.params
        // console.log(id)
        const result = await reciepeCollection.find({userId: id}).toArray()
        res.json(result)
      })

      app.post('/api/recipes', async(req,res) => {
        const m = req.body
        const receipeData = {
          ...m,
          createdAt: new Date()
        }
        const result = await reciepeCollection.insertOne(receipeData)
        res.json(result)
      })

      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } 
    finally {
      // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World Umayer')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})