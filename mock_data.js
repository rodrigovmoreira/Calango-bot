const mongoose = require('mongoose');
async function setup() {
    await mongoose.connect('mongodb://localhost:27017/chatbot-platform');

    // Create Business Config
    const db = mongoose.connection.db;
    const businessConfigId = new mongoose.Types.ObjectId();
    await db.collection('businessconfigs').insertOne({
        _id: businessConfigId,
        businessName: "Test Business",
        createdAt: new Date(),
        updatedAt: new Date()
    });

    // Create User
    const userId = new mongoose.Types.ObjectId();
    const hashedPassword = "$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // dummy
    await db.collection('systemusers').insertOne({
        _id: userId,
        name: "Admin User",
        email: "admin@example.com",
        password: hashedPassword,
        activeBusinessId: businessConfigId,
        businesses: [{ businessId: businessConfigId, role: 'admin' }],
        createdAt: new Date(),
        updatedAt: new Date()
    });

    // Add some Contacts
    const contacts = [
        { name: 'John Doe', phone: '5511999999991', businessId: businessConfigId, tags: ['vip'], notes: 'Likes blue', lastInteraction: new Date() },
        { name: 'Jane Smith', phone: '5511999999992', businessId: businessConfigId, tags: ['lead'], notes: '', lastInteraction: new Date(Date.now() - 86400000) },
    ];
    await db.collection('contacts').insertMany(contacts);

    console.log("Mock data created!");
    process.exit(0);
}
setup().catch(console.error);
