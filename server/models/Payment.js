import mongoose, { Schema } from "mongoose";

const PaymentSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        productId: {
            type: String,
            required: true,
        },
        razorpayOrderId: {
            type: String,
            required: true,
            unique: true,
        },
        razorpayPaymentId: {
            type: String,
            unique: true,
            sparse: true,
        },
        amountPaise: {
            type: Number,
            required: true,
            validate: {
                validator: Number.isInteger,
                message: "{VALUE} is not an integer amount in paise",
            },
        },
        currency: {
            type: String,
            default: "INR",
        },
        status: {
            type: String,
            enum: ["created", "paid", "failed", "refunded"],
            default: "created",
            index: true,
        },
        unitsGranted: {
            type: Number,
            default: 0,
            validate: {
                validator: Number.isInteger,
                message: "{VALUE} is not an integer",
            },
        },
        paidAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

PaymentSchema.index({ userId: 1, createdAt: -1 });

export const Payment = mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
