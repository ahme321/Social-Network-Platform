const mongoose = require('mongoose');
const connectToDatabase = async () => {
try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database Connected!');
} catch (err) {
    console.error('Database Connection Failed:', err);
    process.exit(1);
}
};

module.exports = connectToDatabase;