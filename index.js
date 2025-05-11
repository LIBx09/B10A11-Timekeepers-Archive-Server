const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//middle were
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://timekeeper-s-archive-server.vercel.app",
      "https://timekeeper-s-archive.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_WEB_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unAuthorized Access" });
    }
    req.user = decoded;
    next();
  });
};

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
    const contactCollection = client
      .db("TimekeepersArchiveDB")
      .collection("contact");

    //Jwt APIs
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_WEB_TOKEN, {
        expiresIn: "4h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production" ? true : false,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });
    //Contact data collection
    app.post("/contact", async (req, res) => {
      const contact = req.body;
      const result = await contactCollection.insertOne(contact);
      res.send(result);
    });
    //Artifacts data collection
    //for home page
    app.get("/artifacts/limit", async (req, res) => {
      const limit = 6;
      try {
        const cursor = artifactsCollection
          .find()
          .sort({ likeCount: -1 })
          .limit(limit);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching artifacts:", error.message);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });
    //for show all artifacts page
    app.get("/artifacts", async (req, res) => {
      const cursor = artifactsCollection
        .find()
        .sort({ likeCount: 1 })
        .toArray();
      const result = await cursor;
      res.send(result);
    });

    //for details page
    app.get("/artifacts/:id", async (req, res) => {
      const id = req.params.id;

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
    app.get("/artifacts/liked/:email", verifyToken, async (req, res) => {
      const { email } = req?.params;

      if (req.user.email !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }

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
    //get data by email
    app.get("/artifacts/added/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const { search } = req.query;

      if (req.user.email !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      try {
        const query = { adderEmail: email };

        if (search && search.trim() !== "") {
          query.artifactName = { $regex: search, $options: "i" };
        }

        const addedArtifacts = await artifactsCollection.find(query).toArray();
        res.send(addedArtifacts);
        // console.log("asd", addedArtifacts);
      } catch (error) {
        console.error("Error fetching added artifacts", error.message);
        res.status(500).send({ error: "Failed to fetch added artifacts" });
      }
    });

    //Update single data
    app.put("/artifacts/update/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const filter = { _id: new ObjectId(id) };
        const option = { upsert: true };
        const updateData = req.body;
        const updatedArtifact = {
          $set: {
            artifactName: updateData.artifactName,
            discoveredBy: updateData.discoveredBy,
            artifactType: updateData.artifactType,
            artifactImage: updateData.artifactImage,
            historicalContext: updateData.historicalContext,
            discoveredAt: updateData.discoveredAt,
            presentLocation: updateData.presentLocation,
            createdAt: updateData.createdAt,
          },
        };
        const result = await artifactsCollection.updateOne(
          filter,
          updatedArtifact,
          option
        );
        res.send(result);
      } catch (error) {
        console.error("Error Update not held in artifacts", error.message);
        res.status(500).send({ error: "Failed to update artifacts" });
      }
    });

    //Delete method
    app.delete("/artifacts/delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await artifactsCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/artifacts", verifyToken, async (req, res) => {
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
