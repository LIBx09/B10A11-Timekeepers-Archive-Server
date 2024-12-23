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
      const { id } = req.params;
      const { email } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid ID format" });
      }

      try {
        const artifact = await artifactsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!artifact) {
          return res.status(404).send({ error: "Artifact not found" });
        }

        let update;
        if (!artifact.likedBy) {
          artifact.likedBy = [];
        }

        if (artifact.likedBy && artifact.likedBy.includes(email)) {
          update = {
            $pull: { likedBy: email },
            $inc: { likeCount: -1 },
          };
          if (artifact.likedBy === 1) {
            update.$unset = { likedBy: "" };
          }
        } else {
          update = {
            $push: { likedBy: email },
            $inc: { likeCount: 1 },
          };
        }

        const result = await artifactsCollection.updateOne(
          { _id: new ObjectId(id) },
          update
        );

        const updatedArtifact = await artifactsCollection.findOne({
          _id: new ObjectId(id),
        });

        res.status(200).send({
          result,
          message: "Like/Unlike toggled successfully",
          likeCount: updatedArtifact.likeCount,
          likedBy: updatedArtifact.likedBy,
        });
      } catch (error) {
        console.error("Error updating like/unlike:", error.message);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // for display only like data in page
    app.get("/artifacts/liked/:email", async (req, res) => {
      const { email } = req?.params;
      console.log("Fetching liked artifacts for email:", email);
      try {
        const likedArtifacts = await artifactsCollection
          .find({ likedBy: email })
          .toArray();
        res.status(200).send(likedArtifacts);
      } catch (error) {
        console.error("Error fetching liked artifacts:", error.message);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    app.get("/artifacts/added/:email", async (req, res) => {
      const email = req.params.email;
      console.log("Querying artifacts for email:", email);
      try {
        const query = { adderEmail: email };
        const addedArtifacts = await artifactsCollection.find(query).toArray();
        if (!addedArtifacts) {
          return res.status(404).send({ message: "No Added artifacts found" });
        }
        res.send(addedArtifacts);
      } catch (error) {
        console.error("Error fetching added artifacts", error.message);
        res.status(500).send({ error: "Failed to fetch added artifacts" });
      }
    });

    app.post("/artifacts", async (req, res) => {
      const newArtifact = req.body;
      const result = await artifactsCollection.insertOne(newArtifact);
      res.send(result);
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
