import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    transactions: [{
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        amount: Number,
        description: String,
        reference: String,
        balanceAfter: Number,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Credit money
walletSchema.methods.credit = async function(amount, description, reference = null) {
    this.balance += amount;
    this.transactions.push({
        type: 'credit',
        amount,
        description,
        reference,
        balanceAfter: this.balance
    });
    await this.save();
    return this.balance;
};

// Debit money
walletSchema.methods.debit = async function(amount, description, reference = null) {
    if (this.balance < amount) {
        throw new Error('Insufficient wallet balance');
    }
    this.balance -= amount;
    this.transactions.push({
        type: 'debit',
        amount,
        description,
        reference,
        balanceAfter: this.balance
    });
    await this.save();
    return this.balance;
};

const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;