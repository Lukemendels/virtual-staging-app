export async function callVertexWithRetry<T>(
    fn: () => Promise<Response>,
    maxRetries = 3
): Promise<T> {
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            const response = await fn();

            if (response.status === 429) {
                throw new Error("429 Resource Exhausted");
            }

            if (!response.ok) {
                // If it's not a 429, throw immediately (unless we want to retry 503s too, but spec says 429)
                // Actually, let's parse the error to see if we should retry or throw
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `Vertex AI Error: ${response.statusText}`);
            }

            return await response.json();

        } catch (error: any) {
            if (error.message.includes("429") || error.message.includes("Resource Exhausted")) {
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    console.log(`[Vertex Retry] Attempt ${attempt + 1} failed (429). Retrying in ${delay}ms...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    attempt++;
                    continue;
                } else {
                    console.error("[Vertex Retry] Max retries exceeded.");
                    const serviceBusyError = new Error("Service busy");
                    (serviceBusyError as any).status = 503;
                    throw serviceBusyError;
                }
            }
            throw error;
        }
    }

    throw new Error("Unexpected retry loop exit");
}
