import mongoose from 'mongoose';

async function setup() {
    await mongoose.connect('mongodb://localhost:27017/chatbot-platform');

    const db = mongoose.connection.db;

    // Clear collections
    await db.collection('businessconfigs').deleteMany({});
    await db.collection('systemusers').deleteMany({});
    await db.collection('contacts').deleteMany({});

    const businessConfigId = new mongoose.Types.ObjectId();
    await db.collection('businessconfigs').insertOne({
        _id: businessConfigId,
        businessName: "Test Business",
        createdAt: new Date(),
        updatedAt: new Date()
    });

    const userId = new mongoose.Types.ObjectId();
    // Using simple password with a mock login bypass if needed, but since we just need the frontend,
    // let's just make sure the backend runs and frontend can hit it if we bypass auth or just run the frontend alone.
    // Actually wait, MongoDB is not installed in the sandbox. "mongod: command not found".

    console.log("Mock data created!");
    process.exit(0);
}
setup().catch(console.error);
