import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-11-17.clover" as any, // Match the version used in checkout route
});

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("Stripe-Signature") as string;

    let event: Stripe.Event;

    // 1. Verify the signature (Security)
    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET as string
        );
    } catch (error: any) {
        console.error("Webhook Signature Verification Failed:", error.message);
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
    }

    // 2. Handle the "Payment Succeeded" event
    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        // We need to look up the line items to know if they bought 1 credit or 5 credits
        // because the 'credits' metadata is stored on the Product in Stripe.
        try {
            const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
                expand: ["line_items.data.price.product"],
            });

            const userId = session.client_reference_id;
            const lineItems = expandedSession.line_items?.data || [];

            let totalCreditsToAdd = 0;

            for (const item of lineItems) {
                const product = item.price?.product as Stripe.Product;
                const quantity = item.quantity || 1;

                // Read the 'credits' metadata you set in Stripe Dashboard
                const creditsPerUnit = parseInt(product.metadata.credits || "0", 10);

                if (creditsPerUnit > 0) {
                    totalCreditsToAdd += (creditsPerUnit * quantity);
                }
            }

            // 3. Update the User in Firestore
            if (userId && totalCreditsToAdd > 0) {
                console.log(`Adding ${totalCreditsToAdd} credits to user ${userId}`);
                // Use set with merge to ensure document exists
                await db.collection("users").doc(userId).set({
                    credits: FieldValue.increment(totalCreditsToAdd),
                }, { merge: true });
            }
        } catch (err) {
            console.error("Error processing checkout session:", err);
            return new NextResponse("Internal Server Error", { status: 500 });
        }
    }

    return new NextResponse("Received", { status: 200 });
}