const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''
const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey;

export async function fetchGeminiWithRetry(payload: any, maxRetries = 5) {
    if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
    }
    const delays = [1000, 2000, 4000, 8000, 16000];

    for (let i = 0; i < maxRetries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60-second timeout

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const message = `HTTP error! status: ${response.status}. ${JSON.stringify(errorData)}`;
                const status = response.status;
                
                // Don't retry on client errors (except 429)
                if (status >= 400 && status < 500 && status !== 429) {
                    throw new Error(message);
                }
                
                throw new Error(message);
            }
            
            const result = await response.json();
            return result;
        } catch (error: any) {
            // If the error message indicates a non-retryable error, throw it immediately
            const isNonRetryable = error.message.includes("status: 400") || 
                                  error.message.includes("status: 401") || 
                                  error.message.includes("status: 403") || 
                                  error.message.includes("status: 404");

            if (i === maxRetries - 1 || isNonRetryable) throw error;
            
            console.warn(`Attempt ${i + 1} failed: ${error.message}. Retrying...`);
            await new Promise(resolve => setTimeout(resolve, delays[i]));
        }
    }
}
