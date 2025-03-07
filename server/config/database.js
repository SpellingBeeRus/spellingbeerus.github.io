import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://beespelling:apetid35@cluster0.5xvj7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
        
        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            retryWrites: true,
            retryReads: true
        });
        console.log('MongoDB успешно подключена');
    } catch (error) {
        console.error('Ошибка подключения к MongoDB:', error.message);
        process.exit(1);
    }
};

export default connectDB; 