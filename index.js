require('dotenv').config()
const express = require('express');
const cors = require('cors');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
      const saveCollection = db.collection('saves')
      const userCollection = db.collection('user')
      const subcriptionCollection = db.collection('subscriptions')
      const reportCollection = db.collection('reports')
      const featureCollection = db.collection('features')

      app.post('/subscription', async(req,res) => {

        const {session_id: sessionId, priceId, userId, userEmail} = req.body

        // console.log("my id",sessionId,
        //   priceId,
        //   userId,
        //   userEmail)

        const isExist = await subcriptionCollection.findOne({sessionId})
        if(isExist){
          return res.json({message: 'Aready Exist'})
        }

        await subcriptionCollection.insertOne({
          sessionId,
          priceId,
          userId,
          userEmail,
        })

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

      app.get('/api/recipes/like/:id', async(req,res) => {
        const {id} = req.params
        // console.log(id)
        const result = await reciepeCollection.find({userId: id}).toArray()
        const count = result.reduce((a,b) => a + Number(b.like), 0)
        res.json(count)
      })

      app.patch('/api/recipes/like/count/:id', async (req, res) => {
        const { id } = req.params;

        const recipe = await reciepeCollection.findOne({
          _id: new ObjectId(id)
        });

        if (!recipe) {
          return res.status(404).json({ message: "Recipe not found" });
        }

        const currentLike = Number(recipe.like || 0);

        const result = await reciepeCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              like: currentLike + 1
            }
          }
        );

        res.json(result);
      });

      app.patch('/api/recipes/edit/:id', async(req,res) => {
        const {id} = req.params
        const m = req.body
        console.log(id,m)
        const filter = {
          _id: new ObjectId(id)
        }
        const update = {
          $set: m
        }
        const result = await reciepeCollection.updateOne(filter,update)
        res.json(result)
      })

      app.get('/api/recipes', async(req,res) => {
        const result = await reciepeCollection.find().toArray()
        res.json(result)
      })


      app.delete('/api/recipes/delete/:id', async(req,res) => {
        const {id} = req.params
        const filter = {
          _id: new ObjectId(id)
        }
        const result = await reciepeCollection.deleteOne(filter)
        res.json(result)
      })

      app.get('/api/recipes', async(req,res) => {
        const result = await reciepeCollection.find().toArray()
        res.json(result)
      })

      app.get('/api/recipes/single/:id', async(req,res) => {
        const {id} = req.params
        // console.log(id)
        const result = await reciepeCollection.findOne({_id: new ObjectId(id)})
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

      // app.get('/api/recipes/save/data/:id', async(req,res) => {
      //   const {id} = req.params
      //   const result = await saveCollection.find({userId: id}).toArray()
      //   res.json(result)
      // })

      app.get('/api/recipes/save/data/:id', async(req,res) => {
        const {id} = req.params
        const result = await saveCollection.find({savedBy: id}).toArray()
        res.json(result)
      })

      app.delete('/api/recipes/save/delete/:id', async(req,res) => {
        const {id} = req.params
        // console.log(id)
        const result = await saveCollection.deleteOne({_id: new ObjectId(id)})
        res.json(result)
      })

      // app.post('/api/recipes/save', async(req,res) => {
      //   const m = req.body
      //   const {saveId} = m

      //   const isExist = await saveCollection.findOne({saveId})
      //   if(isExist){
      //     return res.json({message: 'Aready Exist'})
      //   }

      //   const result = await saveCollection.insertOne(m)
      //   res.json(result)
      // })



      app.post('/api/recipes/save', async(req,res) => {
        const m = req.body

        const isExist = await saveCollection.findOne({
          saveId: m.saveId,
          savedBy: m.savedBy
        })

        if(isExist){
          return res.json({message: 'Already Exist'})
        }

        const result = await saveCollection.insertOne(m)
        res.json(result)
      })

      // app.post('/api/recipes/report', async(req,res) => {
      //   const m = req.body
      //   const reportData = {
      //     ...m,
      //     createdAt: new Date()
      //   }
      //   const result = await reportCollection.insertOne(reportData)
      //   res.json(result)
      // })

      app.post("/api/recipes/report", async (req, res) => {
        const reportData = req.body;

        const isExist = await reportCollection.findOne({
          recipeId: reportData.recipeId,
          reportedBy: reportData.reportedBy,
        });

        if (isExist) {
          return res.json({ alreadyReported: true });
        }

        const result = await reportCollection.insertOne({
          ...reportData,
          createdAt: new Date(),
        });

        res.json(result);
      });

      app.get("/api/recipes/report/status/:recipeId/:userId", async (req, res) => {
        const { recipeId, userId } = req.params;

        const isReported = await reportCollection.findOne({
          recipeId,
          reportedBy: userId,
        });

        res.json({ isReported: !!isReported });
      });

      app.get('/api/admin/users',async(req,res) => {
        const result = await userCollection.find().toArray()
        res.json(result)
      })

      // app.get('/api/admin/recipes',async(req,res) => {
      //   const result = await reciepeCollection.find().toArray()
      //   res.json(result)
      // })

      app.get('/api/admin/recipes', async (req, res) => {
        const recipes = await reciepeCollection.find().toArray();

        const featuredRecipes = await featureCollection.find().toArray();

        const featuredIds = featuredRecipes.map(
          item => item.recipeId
        );

        const updatedRecipes = recipes.map(recipe => ({
          ...recipe,
          featured: featuredIds.includes(recipe._id.toString()),
        }));

        res.json(updatedRecipes);
      });

      app.get('/api/admin/premium',async(req,res) => {
        const result = await userCollection.find({plan: 'pro'}).toArray()
        res.json(result)
        // console.log(result.length)
      })

      app.patch('/users/block/:id', async (req, res) => {
      const {id} = req.params
      
      const user = await userCollection.findOne({
        _id: new ObjectId(id)
      });
      // console.log(user)

      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            isBlock: !user.isBlock,
          },
        }
      );

        res.send(result);
      });

      app.delete('/api/admin/recipe/delete/:id', async(req,res) => {
        const {id} = req.params
        const result = await reciepeCollection.deleteOne({_id: new ObjectId(id)})
        res.json(result)
      })

      // app.post('/api/admin/recipe/feature', async(req,res) => {
      //   const m = req.body
      //   const result = await featureCollection.insertOne(m)
      //   res.json(result)
      // })

      app.post('/api/admin/recipe/feature', async (req, res) => {
        const recipe = req.body;

        const existing = await featureCollection.findOne({
          recipeId: recipe._id,
        });

        if (existing) {
          await featureCollection.deleteOne({
            recipeId: recipe._id,
          });

          return res.json({
            action: "removed",
          });
        }

        const result = await featureCollection.insertOne({
          ...recipe,
          recipeId: recipe._id,
          featuredAt: new Date(),
        });

        res.json({
          action: "added",
          insertedId: result.insertedId,
        });
      });

      app.get('/api/admin/recipe/feature', async(req,res) => {
        const result = await featureCollection.find().toArray()
        res.json(result)
      })

      app.get('/api/recipes/report/list', async(req,res) => {
        const result = await reportCollection.find().toArray()
        res.json(result)
      })

      app.delete('/api/recipes/report/list/delete/:id', async(req,res) => {
        const {id} = req.params
        const result = await reportCollection.deleteOne({_id: new ObjectId(id)})
        res.json(result)
      })

      app.delete('/api/recipes/report/recipe/list/delete/:id', async(req,res) => {
        const {id} = req.params
        const result = await reciepeCollection.deleteOne({_id: new ObjectId(id)})
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