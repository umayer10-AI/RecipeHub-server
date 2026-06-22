require('dotenv').config()
const express = require('express');
const cors = require('cors');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.NEXT_PUBLIC_CLIENT}/api/auth/jwks`)
)


const verifyJWT = async (req, res, next) => {
  const header = req.headers.authorization;
  if(!header){
    return res.status(401).json({message: 'Unauthorized'})
  }
  const token = header.split(' ')[1]
  if(!token){
    return res.status(401).json({message: 'Unauthorized'})
  }

  try{
    const { payload } = await jwtVerify(token, JWKS)
    req.user = payload
    next()
  }
  catch(error){
    return res.status(403).json({message: 'Forbidden'})
  }
}

const customerVerify = async (req, res, next) => {
  const user = req.user
  console.log(user)
  if(user.role !== 'customer'){
    return res.status(403).json({message: 'Forbidden'})
  }
  next()
}

const adminVerify = async (req, res, next) => {
  const user = req.user
  console.log(user)
  if(user.role !== 'admin'){
    return res.status(403).json({message: 'Forbidden'})
  }
  next()
}

const run = async() => {
    try {

      const db = client.db('recipeHub')
      const reciepeCollection = db.collection('recipes')
      const saveCollection = db.collection('saves')
      const userCollection = db.collection('user')
      const subcriptionCollection = db.collection('subscriptions')
      const paymentCollection = db.collection('payments')
      const reportCollection = db.collection('reports')
      const featureCollection = db.collection('features')

      app.post('/subscription', async(req,res) => {

        const {session_id: sessionId, priceId, userId, userEmail} = req.body

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

      app.post('/user/payments', async(req,res) => {

        const {session_id: sessionId, price, userId, userEmail,recipeName, recipeId} = req.body

        const isExist = await paymentCollection.findOne({sessionId})
        if(isExist){
          return res.json({message: 'Aready Exist'})
        }

        await paymentCollection.insertOne({
          sessionId,
          price,
          userId,
          userEmail,
          recipeName,
          recipeId,
          paidAt: new Date(),
        })

        res.json({message: 'Payment Successfull'})
      })

      app.get('/user/payments/:email', async(req,res) => {
        const {email} = req.params
        const result = await paymentCollection.find({userEmail: email}).toArray() 
        res.json(result)
      })

      app.get('/user/payments/admin/data', verifyJWT, adminVerify, async(req,res) => {
        const result = await paymentCollection.find().toArray() 
        res.json(result)
      })


      app.get('/api/recipes/:id', async(req,res) => {
        const {id} = req.params
        const result = await reciepeCollection.find({userId: id}).toArray()
        res.json(result)
      })

      app.get('/api/recipes/like/:id', async(req,res) => {
        const {id} = req.params
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

      app.patch('/api/recipes/edit/:id',verifyJWT, customerVerify, async(req,res) => {
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


      app.delete('/api/recipes/delete/:id',verifyJWT, customerVerify, async(req,res) => {
        const {id} = req.params
        const filter = {
          _id: new ObjectId(id)
        }
        const saveDelete = await saveCollection.deleteMany({saveId: id})
        const result = await reciepeCollection.deleteOne(filter)
        res.json(result)
      })


      app.get('/api/recipes', async (req, res) => {
        const {search='', category='', page=1, limit = 8} = req.query;

        const query = {};

        if(category){
          query.category = category;
        }
        if(search) {
          query.$or = [
            {
              recipeName: {
                $regex: search,
                $options: "i",
              },
            },
            {
              ingredients: {
                $regex: search,
                $options: "i",
              },
            },
          ];
        }

        const currentPage = Number(page);
        const perPage = Number(limit);
        const skip = (currentPage-1) * perPage;

        const totalRecipes = await reciepeCollection.countDocuments(query);

        const recipes = await reciepeCollection.find(query).skip(skip).limit(perPage).toArray();

        res.json({
          recipes,
          totalPages: Math.ceil(totalRecipes / perPage),
          currentPage,
          totalRecipes,
        });
      });


      app.get('/api/recipes/single/:id', async(req,res) => {
        const {id} = req.params
        const result = await reciepeCollection.findOne({_id: new ObjectId(id)})
        res.json(result)
      })

      app.post('/api/recipes',verifyJWT, customerVerify, async(req,res) => {
        const m = req.body
        const receipeData = {
          ...m,
          createdAt: new Date()
        }
        const result = await reciepeCollection.insertOne(receipeData)
        res.json(result)
      })

      app.get('/api/recipes/save/data/:id',verifyJWT, customerVerify, async(req,res) => {
        const {id} = req.params
        const result = await saveCollection.find({savedBy: id}).toArray()
        res.json(result)
      })

      app.delete('/api/recipes/save/delete/:id',verifyJWT, customerVerify, async(req,res) => {
        const {id} = req.params
        const result = await saveCollection.deleteOne({_id: new ObjectId(id)})
        res.json(result)
      })


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

      app.get('/api/admin/users',verifyJWT, adminVerify, async(req,res) => {
        const result = await userCollection.find().toArray()
        res.json(result)
      })

      app.get('/api/admin/recipes', verifyJWT, adminVerify, async (req, res) => {
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
      })

      app.patch('/users/block/:id', verifyJWT,adminVerify, async (req, res) => {
      const {id} = req.params
      
      const user = await userCollection.findOne({
        _id: new ObjectId(id)
      });

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

      app.delete('/api/admin/recipe/delete/:id',verifyJWT, adminVerify, async(req,res) => {
        const {id} = req.params
        const result = await reciepeCollection.deleteOne({_id: new ObjectId(id)})
        await featureCollection.deleteOne({recipeId: id})
        res.json(result)
      })

      app.post('/api/admin/recipe/feature',verifyJWT, adminVerify, async (req, res) => {
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

      app.delete('/api/recipes/report/list/delete/:id',verifyJWT, adminVerify, async(req,res) => {
        const {id} = req.params
        const result = await reportCollection.deleteOne({_id: new ObjectId(id)})
        res.json(result)
      })

      app.delete('/api/recipes/report/recipe/list/delete/:id',verifyJWT, adminVerify, async(req,res) => {
        const {id} = req.params
        const result = await reciepeCollection.deleteOne({_id: new ObjectId(id)})
        res.json(result)
      })

      app.get('/api/recipe/like/top', async(req,res) => {
        const result = await reciepeCollection.find().sort({like: -1}).limit(5).toArray()
        res.json(result)
      })

      
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