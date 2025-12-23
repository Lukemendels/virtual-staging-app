import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-11-17.clover" as any, // Explicitly cast to any to avoid further issues if types are weird, but try to match string first. Actually, let's just use the string.
});

export async function POST(request: Request) {
    try {
        const { type, userId } = await request.json();
        const origin = request.headers.get("origin");

        let priceId = process.env.STRIPE_PRICE_ID_SINGLE; // Default to single
        if (type === "pack") {
            priceId = process.env.STRIPE_PRICE_ID_PACK;
        }

        if (!priceId) {
            throw new Error("Stripe Price ID is not defined for the selected type");
        }

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            client_reference_id: userId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${origin}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/dashboard?payment=cancelled`,
        });

        return NextResponse.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error("Stripe Checkout Error:", error);
        return NextResponse.json(
            { error: "Failed to create checkout session" },
            { status: 500 }
        );
    }
}
