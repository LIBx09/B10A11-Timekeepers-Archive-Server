const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//middle were
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iciu9bb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const artifactsCollection = client
      .db("TimekeepersArchiveDB")
      .collection("artifacts");

    //Artifacts data collection
    //for home page
    app.get("/artifacts/limit", async (req, res) => {
      const limit = 6;
      const cursor = artifactsCollection.find().limit(limit);
      const result = await cursor.toArray();
      res.send(result);
    });
    //for show all artifacts page
    app.get("/artifacts", async (req, res) => {
      const cursor = artifactsCollection.find().toArray();
      const result = await cursor;
      res.send(result);
    });
    //for details page
    app.get("/artifacts/:id", async (req, res) => {
      const id = req.params.id;

      // Validate the id
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid ID format" });
      }

      try {
        const query = { _id: new ObjectId(id) };
        const result = await artifactsCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ error: "Artifact not found" });
        }

        res.send(result);
      } catch (error) {
        console.error("Error fetching artifact:", error.message);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });
    //for like/unlike
    app.post("/artifacts/like-unlike/:id", async (req, res) => {
      const { id } = req.params; // Artifact ID from the URL
      const { email } = req.body; // User email from the request body

      // Validate the ID
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid ID format" });
      }

      try {
        // Fetch the artifact by ID
        const artifact = await artifactsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!artifact) {
          return res.status(404).send({ error: "Artifact not found" });
        }

        let update;

        // Check if the artifact has a `likedBy` field
        if (artifact.likedBy && artifact.likedBy.includes(email)) {
          // User already liked: Remove like
          update = {
            $pull: { likedBy: email }, // Remove user email
            $inc: { likeCount: -1 }, // Decrement the likeCount
          };
          if (artifact.likedBy.length === 1) {
            update.$unset = { likedBy: "" };
          }
        } else {
          // User not liked: Add like
          update = {
            $push: { likedBy: email }, // Add user email (create likedBy field if it doesn't exist)
            $inc: { likeCount: 1 }, // Increment the likeCount
          };
        }

        // Update the artifact in the database
        await artifactsCollection.updateOne({ _id: new ObjectId(id) }, update);

        res.status(200).send({ message: "Like/Unlike toggled successfully" });
      } catch (error) {
        console.error("Error updating like/unlike:", error.message);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Timekeeper's Archive Server Running");
});

app.listen(port, () => {
  console.log(`Timekeeper's Archive Server is Running on Port: ${port}`);
});
